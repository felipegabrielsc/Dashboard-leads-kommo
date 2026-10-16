-- Rode este arquivo se o schema.sql antigo já foi executado.
-- Cria o histórico de alterações e esconde o telefone de quem não está logado.

create table if not exists public.change_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor text not null,
  kind text not null,
  day date,
  category_id text,
  summary text not null
);

create index if not exists change_log_created_at_idx on public.change_log (created_at desc);

alter table public.change_log enable row level security;

drop policy if exists "public read change_log" on public.change_log;
drop policy if exists "authenticated insert change_log" on public.change_log;

create policy "public read change_log" on public.change_log for select to anon, authenticated using (true);
create policy "authenticated insert change_log" on public.change_log for insert to authenticated with check (true);

revoke insert, update, delete on public.change_log from anon;
revoke select on table public.change_log from anon;
grant select (id, created_at, kind, day, category_id, summary) on public.change_log to anon;
grant select, insert on public.change_log to authenticated;

revoke select on table public.analysis_leads from anon;
revoke select (id, phone, day, description) on public.analysis_leads from anon;
grant select (id, day, description) on public.analysis_leads to anon;
