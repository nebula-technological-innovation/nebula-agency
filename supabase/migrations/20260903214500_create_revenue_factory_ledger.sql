create schema if not exists revenue_private;

create table if not exists public.revenue_orders (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe')),
  provider_event_id text not null,
  provider_source_id text not null,
  offer_id text not null,
  offer_kind text not null check (offer_kind in ('service','digital','unknown')),
  amount_total bigint,
  currency text,
  payment_status text not null,
  fulfillment_status text not null,
  customer_email_hash text,
  customer_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_event_id),
  unique(provider, provider_source_id)
);

create table if not exists public.revenue_service_intake (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.revenue_orders(id) on delete cascade,
  offer_id text not null,
  status text not null default 'intake_required' check (status in ('intake_required','qualified','scheduled','in_progress','completed','cancelled')),
  intake_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists revenue_private.runtime_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.revenue_orders enable row level security;
alter table public.revenue_service_intake enable row level security;
alter table revenue_private.runtime_secrets enable row level security;

revoke all on table public.revenue_orders from anon, authenticated;
revoke all on table public.revenue_service_intake from anon, authenticated;
revoke all on table revenue_private.runtime_secrets from anon, authenticated;

grant all on table public.revenue_orders to service_role;
grant all on table public.revenue_service_intake to service_role;
grant all on table revenue_private.runtime_secrets to service_role;
grant usage on schema revenue_private to service_role;
revoke all on schema revenue_private from anon, authenticated;

create index if not exists revenue_orders_offer_created_idx on public.revenue_orders (offer_id, created_at desc);
create index if not exists revenue_orders_fulfillment_idx on public.revenue_orders (fulfillment_status, created_at desc);
create index if not exists revenue_service_intake_status_idx on public.revenue_service_intake (status, created_at desc);

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
