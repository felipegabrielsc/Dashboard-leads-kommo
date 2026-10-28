-- Comercial Kommo. Rode no SQL Editor, mesmo que o schema.sql já tenha sido executado.
-- Estas tabelas não mexem nos lançamentos, orçamentos ou histórico atuais.
-- Só quem está logado lê. A sincronização grava com a sessão de quem clicou, ou com a service role no agendamento.

create table if not exists public.kommo_pipelines (
  account_id bigint not null,
  id bigint not null,
  name text not null,
  is_main boolean not null default false,
  is_archive boolean not null default false,
  sort integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (account_id, id)
);

create table if not exists public.kommo_statuses (
  account_id bigint not null,
  id bigint not null,
  pipeline_id bigint not null,
  name text not null,
  sort integer not null default 0,
  kind text not null default 'open' check (kind in ('unsorted', 'open', 'won', 'lost')),
  color text not null default '',
  updated_at timestamptz not null default now(),
  primary key (account_id, id)
);

create table if not exists public.kommo_users (
  account_id bigint not null,
  id bigint not null,
  name text not null,
  email text not null default '',
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (account_id, id)
);

create table if not exists public.kommo_leads (
  account_id bigint not null,
  id bigint not null,
  name text not null default '',
  price numeric not null default 0,
  pipeline_id bigint,
  status_id bigint,
  responsible_user_id bigint,
  created_at timestamptz,
  updated_at timestamptz,
  closed_at timestamptz,
  status_kind text not null default 'open' check (status_kind in ('unsorted', 'open', 'won', 'lost')),
  is_deleted boolean not null default false,
  kommo_url text not null default '',
  synced_at timestamptz not null default now(),
  primary key (account_id, id)
);

create index if not exists kommo_leads_created_idx on public.kommo_leads (account_id, created_at);
create index if not exists kommo_leads_closed_idx on public.kommo_leads (account_id, closed_at);
create index if not exists kommo_leads_kind_idx on public.kommo_leads (account_id, status_kind);
create index if not exists kommo_leads_user_idx on public.kommo_leads (account_id, responsible_user_id);
create index if not exists kommo_leads_pipeline_idx on public.kommo_leads (account_id, pipeline_id);

create table if not exists public.kommo_sync_state (
  account_id bigint primary key,
  subdomain text not null default '',
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error text not null default '',
  cursor_updated_at timestamptz,
  full_reconcile_at timestamptz,
  phase text not null default 'idle' check (phase in ('idle', 'pipelines', 'leads', 'deleted')),
  resume_url text not null default '',
  mode text not null default 'full' check (mode in ('full', 'incremental')),
  run_started_at timestamptz,
  pages_done integer not null default 0,
  upserted integer not null default 0,
  seen_updated_at timestamptz
);

create table if not exists public.kommo_sync_logs (
  id bigint generated always as identity primary key,
  account_id bigint,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  mode text not null,
  ok boolean not null default false,
  pages integer not null default 0,
  upserted integer not null default 0,
  message text not null default ''
);

alter table public.kommo_pipelines enable row level security;
alter table public.kommo_statuses enable row level security;
alter table public.kommo_users enable row level security;
alter table public.kommo_leads enable row level security;
alter table public.kommo_sync_state enable row level security;
alter table public.kommo_sync_logs enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'kommo_pipelines',
    'kommo_statuses',
    'kommo_users',
    'kommo_leads',
    'kommo_sync_state',
    'kommo_sync_logs'
  ]
  loop
    execute format('drop policy if exists "authenticated read %1$s" on public.%1$s', tbl);
    execute format('drop policy if exists "authenticated insert %1$s" on public.%1$s', tbl);
    execute format('drop policy if exists "authenticated update %1$s" on public.%1$s', tbl);
    execute format('drop policy if exists "authenticated delete %1$s" on public.%1$s', tbl);
    execute format('create policy "authenticated read %1$s" on public.%1$s for select to authenticated using (true)', tbl);
    execute format('create policy "authenticated insert %1$s" on public.%1$s for insert to authenticated with check (true)', tbl);
    execute format('create policy "authenticated update %1$s" on public.%1$s for update to authenticated using (true) with check (true)', tbl);
    execute format('create policy "authenticated delete %1$s" on public.%1$s for delete to authenticated using (true)', tbl);
    execute format('revoke all on public.%1$s from anon', tbl);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', tbl);
  end loop;
end $$;

grant usage, select on sequence public.kommo_sync_logs_id_seq to authenticated;
