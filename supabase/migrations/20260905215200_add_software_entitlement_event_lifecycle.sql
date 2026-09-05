create table if not exists public.billing_provider_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);
alter table public.billing_provider_events enable row level security;
revoke all on table public.billing_provider_events from anon, authenticated;
grant all on table public.billing_provider_events to service_role;

create or replace function public.process_software_entitlement_event(
  p_event_id text,
  p_event_type text,
  p_action text,
  p_subscription_id text,
  p_customer_id text default null,
  p_customer_email_hash text default null,
  p_product_sku text default null,
  p_tier text default null,
  p_period_end timestamptz default null
) returns table(result text, entitlement_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_claimed integer;
  v_id uuid;
  v_status text;
begin
  if p_event_id is null or p_event_id='' or p_subscription_id is null or p_subscription_id='' then
    raise exception 'missing_event_or_subscription_identity';
  end if;

  insert into public.billing_provider_events(event_id,event_type) values(p_event_id,p_event_type)
  on conflict(event_id) do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed=0 then
    select id into v_id from public.software_entitlements where provider_subscription_id=p_subscription_id limit 1;
    return query select 'duplicate'::text,v_id;
    return;
  end if;

  if p_action='active' then
    if coalesce(p_customer_email_hash,'')='' or coalesce(p_product_sku,'')='' or coalesce(p_tier,'')='' then
      raise exception 'active_entitlement_missing_identity';
    end if;
    insert into public.software_entitlements(
      provider,provider_subscription_id,provider_customer_id,customer_email_hash,product_sku,tier,status,current_period_end
    ) values(
      'stripe',p_subscription_id,p_customer_id,p_customer_email_hash,p_product_sku,p_tier,'active',p_period_end
    )
    on conflict(provider_subscription_id) do update set
      provider_customer_id=excluded.provider_customer_id,
      customer_email_hash=excluded.customer_email_hash,
      product_sku=excluded.product_sku,
      tier=excluded.tier,
      status='active',
      current_period_end=excluded.current_period_end,
      updated_at=now()
    returning id into v_id;
    v_status='active';
  elsif p_action in ('past_due','paused','revoked','cancelled') then
    update public.software_entitlements set status=p_action,updated_at=now()
    where provider_subscription_id=p_subscription_id returning id into v_id;
    v_status=p_action;
  else
    raise exception 'unsupported_entitlement_action';
  end if;

  if v_id is not null then
    insert into public.revenue_outbox(event_type,aggregate_type,aggregate_id,payload)
    values('entitlement.'||v_status,'software_entitlement',v_id,
      jsonb_build_object('subscription_id',p_subscription_id,'product_sku',p_product_sku,'status',v_status,'provider_event_id',p_event_id));
  end if;

  return query select 'processed'::text,v_id;
end; $$;

revoke execute on function public.process_software_entitlement_event(text,text,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.process_software_entitlement_event(text,text,text,text,text,text,text,text,timestamptz) to service_role;
