create table if not exists public.revenue_validation_evidence (
  id uuid primary key default gen_random_uuid(),
  test_name text not null,
  status text not null check (status in ('passed','failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.revenue_validation_evidence enable row level security;
revoke all on table public.revenue_validation_evidence from anon, authenticated;
grant all on table public.revenue_validation_evidence to service_role;
