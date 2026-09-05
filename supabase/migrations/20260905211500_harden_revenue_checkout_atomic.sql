alter table public.revenue_orders drop column if exists customer_name;

create or replace function public.get_runtime_secret(p_key text)
returns text
language sql
security definer
set search_path = revenue_private, pg_temp
as $$
  select value
  from revenue_private.runtime_secrets
  where key = p_key
  limit 1
$$;

revoke all on function public.get_runtime_secret(text) from public, anon, authenticated;
grant execute on function public.get_runtime_secret(text) to service_role;

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
)
returns table(order_id uuid, fulfillment_status text, duplicate boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_status text;
begin
  if p_provider <> 'stripe' then
    raise exception 'unsupported_provider';
  end if;
  if p_payment_status <> 'paid' then
    raise exception 'payment_not_paid';
  end if;

  select id, revenue_orders.fulfillment_status
    into v_order_id, v_status
  from public.revenue_orders
  where provider = p_provider
    and provider_source_id = p_provider_source_id
  limit 1;

  if v_order_id is not null then
    return query select v_order_id, v_status, true;
    return;
  end if;

  begin
    insert into public.revenue_orders (
      provider,
      provider_event_id,
      provider_source_id,
      offer_id,
      offer_kind,
      amount_total,
      currency,
      payment_status,
      fulfillment_status,
      customer_email_hash,
      metadata
    ) values (
      p_provider,
      p_provider_event_id,
      p_provider_source_id,
      p_offer_id,
      p_offer_kind,
      p_amount_total,
      p_currency,
      p_payment_status,
      p_fulfillment_status,
      p_customer_email_hash,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning id, revenue_orders.fulfillment_status into v_order_id, v_status;
  exception when unique_violation then
    select id, revenue_orders.fulfillment_status
      into v_order_id, v_status
    from public.revenue_orders
    where provider = p_provider
      and (
        provider_source_id = p_provider_source_id
        or provider_event_id = p_provider_event_id
      )
    order by created_at asc
    limit 1;

    if v_order_id is null then
      raise;
    end if;

    return query select v_order_id, v_status, true;
    return;
  end;

  if p_offer_kind = 'service' then
    insert into public.revenue_service_intake (
      order_id,
      offer_id,
      status,
      intake_payload
    ) values (
      v_order_id,
      p_offer_id,
      'intake_required',
      coalesce(p_intake_payload, '{}'::jsonb)
    );
  end if;

  return query select v_order_id, v_status, false;
end;
$$;

revoke all on function public.record_revenue_checkout(
  text,text,text,text,text,bigint,text,text,text,text,jsonb,jsonb
) from public, anon, authenticated;

grant execute on function public.record_revenue_checkout(
  text,text,text,text,text,bigint,text,text,text,text,jsonb,jsonb
) to service_role;
