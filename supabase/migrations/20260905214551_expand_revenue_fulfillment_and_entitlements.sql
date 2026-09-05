create table if not exists public.revenue_work_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.revenue_orders(id) on delete cascade,
  offer_id text not null,
  status text not null default 'queued' check (status in ('queued','assigned','in_progress','blocked','completed','cancelled')),
  intake_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenue_outbox (
  id bigserial primary key,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','dispatched','failed')),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz
);

create table if not exists public.software_entitlements (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  provider_subscription_id text unique,
  provider_customer_id text,
  customer_email_hash text not null,
  product_sku text not null,
  tier text not null,
  status text not null check (status in ('active','past_due','paused','revoked','cancelled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(customer_email_hash, product_sku)
);

alter table public.revenue_work_orders enable row level security;
alter table public.revenue_outbox enable row level security;
alter table public.software_entitlements enable row level security;
revoke all on table public.revenue_work_orders, public.revenue_outbox, public.software_entitlements from anon, authenticated;
grant all on table public.revenue_work_orders, public.revenue_outbox, public.software_entitlements to service_role;
grant usage, select on sequence public.revenue_outbox_id_seq to service_role;

create index if not exists revenue_work_orders_status_idx on public.revenue_work_orders(status, created_at);
create index if not exists revenue_outbox_status_idx on public.revenue_outbox(status, created_at);
create index if not exists software_entitlements_status_idx on public.software_entitlements(status, product_sku);

create or replace function public.record_revenue_checkout(
  p_provider text,
  p_provider_event_id text,
  p_provider_source_id text,
  p_offer_id text,
  p_offer_kind text,
  p_amount_total bigint,
  p_currency text,
  p_payment_status text,
  p_fulfillment_status text,
  p_customer_email_hash text,
  p_metadata jsonb,
  p_intake_payload jsonb default '{}'::jsonb
) returns table(order_id uuid, fulfillment_status text, duplicate boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_order_id uuid;
  v_status text;
  v_work_order_id uuid;
begin
  if p_provider <> 'stripe' then raise exception 'unsupported_provider'; end if;
  if p_payment_status <> 'paid' then raise exception 'payment_not_paid'; end if;

  select id, revenue_orders.fulfillment_status into v_order_id, v_status
  from public.revenue_orders where provider=p_provider and provider_source_id=p_provider_source_id limit 1;
  if v_order_id is not null then return query select v_order_id, v_status, true; return; end if;

  begin
    insert into public.revenue_orders(provider,provider_event_id,provider_source_id,offer_id,offer_kind,amount_total,currency,payment_status,fulfillment_status,customer_email_hash,metadata)
    values(p_provider,p_provider_event_id,p_provider_source_id,p_offer_id,p_offer_kind,p_amount_total,p_currency,p_payment_status,p_fulfillment_status,p_customer_email_hash,coalesce(p_metadata,'{}'::jsonb))
    returning id, revenue_orders.fulfillment_status into v_order_id,v_status;
  exception when unique_violation then
    select id,revenue_orders.fulfillment_status into v_order_id,v_status from public.revenue_orders
    where provider=p_provider and (provider_source_id=p_provider_source_id or provider_event_id=p_provider_event_id)
    order by created_at asc limit 1;
    if v_order_id is null then raise; end if;
    return query select v_order_id,v_status,true; return;
  end;

  if p_offer_kind='service' then
    insert into public.revenue_service_intake(order_id,offer_id,status,intake_payload)
    values(v_order_id,p_offer_id,'intake_required',coalesce(p_intake_payload,'{}'::jsonb));

    insert into public.revenue_work_orders(order_id,offer_id,status,intake_payload)
    values(v_order_id,p_offer_id,'queued',coalesce(p_intake_payload,'{}'::jsonb))
    returning id into v_work_order_id;

    insert into public.revenue_outbox(event_type,aggregate_type,aggregate_id,payload)
    values('customer_ops.work_order_created','revenue_work_order',v_work_order_id,
      jsonb_build_object('order_id',v_order_id,'offer_id',p_offer_id,'status','queued'));
  elsif p_offer_kind='digital' then
    insert into public.revenue_outbox(event_type,aggregate_type,aggregate_id,payload)
    values('fulfillment.digital_ready','revenue_order',v_order_id,
      jsonb_build_object('order_id',v_order_id,'sku',p_offer_id,'status',p_fulfillment_status));
  end if;

  return query select v_order_id,v_status,false;
end; $$;

revoke execute on function public.record_revenue_checkout(text,text,text,text,text,bigint,text,text,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.record_revenue_checkout(text,text,text,text,text,bigint,text,text,text,text,jsonb,jsonb) to service_role;
