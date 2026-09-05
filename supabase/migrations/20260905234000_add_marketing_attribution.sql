create table if not exists public.marketing_attribution_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in ('offer_click')),
  offer_id text not null,
  channel text not null default 'unknown',
  campaign text not null default 'unknown',
  landing_page text,
  referrer_host text,
  anonymous_id text,
  user_agent_family text
);

create index if not exists marketing_attribution_events_created_at_idx
  on public.marketing_attribution_events (created_at desc);
create index if not exists marketing_attribution_events_offer_idx
  on public.marketing_attribution_events (offer_id, created_at desc);
create index if not exists marketing_attribution_events_channel_idx
  on public.marketing_attribution_events (channel, campaign, created_at desc);

alter table public.marketing_attribution_events enable row level security;

comment on table public.marketing_attribution_events is
  'Fail-soft marketing attribution only. Never authoritative for realized revenue or fulfillment.';
