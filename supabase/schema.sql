-- Cole este arquivo no SQL Editor do Supabase (uma vez).
-- Cria as tabelas, deixa qualquer pessoa ler e só quem está logado alterar,
-- esconde o telefone de quem não entrou, grava o histórico de alterações
-- e carrega o histórico da planilha.

create table if not exists public.categories (
  id text primary key,
  label text not null,
  group_id text not null check (group_id in ('interesse', 'sem_retorno', 'perdidos')),
  builtin boolean not null default false,
  position integer not null default 0
);

create table if not exists public.days (
  day date primary key,
  review text not null default 'ok' check (review in ('ok', 'pendente')),
  pending_count integer not null default 0 check (pending_count >= 0),
  declared_quantity integer
);

create table if not exists public.day_counts (
  day date not null references public.days(day) on delete cascade,
  category_id text not null references public.categories(id) on delete cascade,
  value integer not null check (value >= 0),
  primary key (day, category_id)
);

create table if not exists public.analysis_leads (
  id text primary key,
  phone text not null,
  day date,
  description text not null default ''
);

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

alter table public.categories enable row level security;
alter table public.days enable row level security;
alter table public.day_counts enable row level security;
alter table public.analysis_leads enable row level security;
alter table public.change_log enable row level security;

drop policy if exists "authenticated manage categories" on public.categories;
drop policy if exists "authenticated manage days" on public.days;
drop policy if exists "authenticated manage day_counts" on public.day_counts;
drop policy if exists "authenticated manage analysis_leads" on public.analysis_leads;
drop policy if exists "public read categories" on public.categories;
drop policy if exists "public read days" on public.days;
drop policy if exists "public read day_counts" on public.day_counts;
drop policy if exists "public read analysis_leads" on public.analysis_leads;
drop policy if exists "authenticated insert categories" on public.categories;
drop policy if exists "authenticated update categories" on public.categories;
drop policy if exists "authenticated delete categories" on public.categories;
drop policy if exists "authenticated insert days" on public.days;
drop policy if exists "authenticated update days" on public.days;
drop policy if exists "authenticated delete days" on public.days;
drop policy if exists "authenticated insert day_counts" on public.day_counts;
drop policy if exists "authenticated update day_counts" on public.day_counts;
drop policy if exists "authenticated delete day_counts" on public.day_counts;
drop policy if exists "authenticated insert analysis_leads" on public.analysis_leads;
drop policy if exists "authenticated update analysis_leads" on public.analysis_leads;
drop policy if exists "authenticated delete analysis_leads" on public.analysis_leads;

create policy "public read categories" on public.categories for select to anon, authenticated using (true);
create policy "public read days" on public.days for select to anon, authenticated using (true);
create policy "public read day_counts" on public.day_counts for select to anon, authenticated using (true);
create policy "public read analysis_leads" on public.analysis_leads for select to anon, authenticated using (true);

create policy "authenticated insert categories" on public.categories for insert to authenticated with check (true);
create policy "authenticated update categories" on public.categories for update to authenticated using (true) with check (true);
create policy "authenticated delete categories" on public.categories for delete to authenticated using (true);
create policy "authenticated insert days" on public.days for insert to authenticated with check (true);
create policy "authenticated update days" on public.days for update to authenticated using (true) with check (true);
create policy "authenticated delete days" on public.days for delete to authenticated using (true);
create policy "authenticated insert day_counts" on public.day_counts for insert to authenticated with check (true);
create policy "authenticated update day_counts" on public.day_counts for update to authenticated using (true) with check (true);
create policy "authenticated delete day_counts" on public.day_counts for delete to authenticated using (true);
create policy "authenticated insert analysis_leads" on public.analysis_leads for insert to authenticated with check (true);
create policy "authenticated update analysis_leads" on public.analysis_leads for update to authenticated using (true) with check (true);
create policy "authenticated delete analysis_leads" on public.analysis_leads for delete to authenticated using (true);

drop policy if exists "public read change_log" on public.change_log;
drop policy if exists "authenticated insert change_log" on public.change_log;
create policy "public read change_log" on public.change_log for select to anon, authenticated using (true);
create policy "authenticated insert change_log" on public.change_log for insert to authenticated with check (true);

revoke insert, update, delete on public.categories from anon;
revoke insert, update, delete on public.days from anon;
revoke insert, update, delete on public.day_counts from anon;
revoke insert, update, delete on public.analysis_leads from anon;

grant select on public.categories to anon;
grant select on public.days to anon;
grant select on public.day_counts to anon;
revoke select on table public.analysis_leads from anon;
grant select (id, day, description) on public.analysis_leads to anon;

revoke insert, update, delete on public.change_log from anon;
revoke select on table public.change_log from anon;
grant select (id, created_at, kind, day, category_id, summary) on public.change_log to anon;

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.days to authenticated;
grant select, insert, update, delete on public.day_counts to authenticated;
grant select, insert, update, delete on public.analysis_leads to authenticated;
grant select, insert on public.change_log to authenticated;

create table if not exists public.quotes (
  id text primary key,
  width integer not null check (width > 0),
  depth integer not null check (depth > 0),
  height integer not null check (height > 0),
  material text not null default '',
  note text not null default '',
  family text not null default 'padrao' check (family in ('padrao', 'corte_vinco')),
  tiers jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.quotes enable row level security;

drop policy if exists "authenticated read quotes" on public.quotes;
drop policy if exists "authenticated insert quotes" on public.quotes;
drop policy if exists "authenticated update quotes" on public.quotes;
drop policy if exists "authenticated delete quotes" on public.quotes;
create policy "authenticated read quotes" on public.quotes for select to authenticated using (true);
create policy "authenticated insert quotes" on public.quotes for insert to authenticated with check (true);
create policy "authenticated update quotes" on public.quotes for update to authenticated using (true) with check (true);
create policy "authenticated delete quotes" on public.quotes for delete to authenticated using (true);

revoke all on public.quotes from anon;
grant select, insert, update, delete on public.quotes to authenticated;

create table if not exists public.catalog_profile (
  id text primary key,
  company_name text not null default '',
  whatsapp text not null default '',
  valid_until date
);

alter table public.catalog_profile enable row level security;

drop policy if exists "authenticated read catalog_profile" on public.catalog_profile;
drop policy if exists "authenticated insert catalog_profile" on public.catalog_profile;
drop policy if exists "authenticated update catalog_profile" on public.catalog_profile;
create policy "authenticated read catalog_profile" on public.catalog_profile for select to authenticated using (true);
create policy "authenticated insert catalog_profile" on public.catalog_profile for insert to authenticated with check (true);
create policy "authenticated update catalog_profile" on public.catalog_profile for update to authenticated using (true) with check (true);

revoke all on public.catalog_profile from anon;
grant select, insert, update on public.catalog_profile to authenticated;

insert into public.categories (id, label, group_id, builtin, position) values
('comprou', 'Comprou', 'interesse', true, 0),
('interessado_sem_resposta', 'Interessado mas sem resposta', 'interesse', true, 1),
('compra_futura', 'Compra Futura', 'interesse', true, 2),
('sem_retorno', 'Sem Retorno', 'sem_retorno', true, 3),
('orcamento_insuficiente', 'Orçamento insuficiente', 'perdidos', true, 4),
('produto_nao_encaixa', 'O produto não se encaixa à necessidade', 'perdidos', true, 5),
('nao_satisfeito', 'Não satisfeito com as condições', 'perdidos', true, 6),
('concorrente', 'Comprado do concorrente', 'perdidos', true, 7),
('curriculo', 'Currículo (busca de emprego)', 'perdidos', true, 8),
('fora_regiao', 'Fora da região', 'perdidos', true, 9),
('engano', 'Engano', 'perdidos', true, 10),
('outros', 'Outros (Não contabilizado aos leads)', 'perdidos', true, 11)
on conflict (id) do nothing;

insert into public.days (day, review, pending_count, declared_quantity) values
('2026-06-23', 'ok', 0, null),
('2026-06-24', 'ok', 0, null),
('2026-06-25', 'ok', 0, null),
('2026-06-26', 'ok', 0, null),
('2026-06-27', 'ok', 0, 6),
('2026-06-28', 'ok', 0, null),
('2026-06-29', 'ok', 0, null),
('2026-06-30', 'ok', 0, null),
('2026-07-01', 'ok', 0, null),
('2026-07-02', 'ok', 0, null),
('2026-07-03', 'ok', 0, null),
('2026-07-04', 'ok', 0, null),
('2026-07-05', 'ok', 0, null),
('2026-07-06', 'ok', 0, null),
('2026-07-07', 'ok', 0, null),
('2026-07-08', 'ok', 0, null),
('2026-07-09', 'ok', 0, null),
('2026-07-10', 'ok', 0, 14),
('2026-07-11', 'ok', 0, null),
('2026-07-12', 'ok', 0, null),
('2026-07-13', 'ok', 0, null),
('2026-07-14', 'ok', 0, null),
('2026-07-15', 'ok', 0, null),
('2026-07-16', 'ok', 0, null),
('2026-07-17', 'ok', 0, null),
('2026-07-18', 'ok', 0, null),
('2026-07-19', 'ok', 0, null),
('2026-07-20', 'ok', 0, null),
('2026-07-21', 'ok', 0, null),
('2026-07-22', 'ok', 0, null),
('2026-07-23', 'ok', 0, null),
('2026-07-24', 'ok', 0, null),
('2026-07-25', 'ok', 0, null),
('2026-07-26', 'ok', 0, 16),
('2026-07-27', 'ok', 0, 22),
('2026-07-28', 'ok', 0, null),
('2026-07-29', 'ok', 0, 12),
('2026-08-19', 'ok', 0, null),
('2026-08-20', 'ok', 0, null),
('2026-08-21', 'ok', 0, null),
('2026-08-22', 'ok', 0, null),
('2026-08-23', 'ok', 0, null),
('2026-08-24', 'ok', 0, null),
('2026-08-25', 'ok', 0, null),
('2026-08-26', 'ok', 0, 34),
('2026-08-27', 'ok', 0, null),
('2026-08-28', 'ok', 0, null),
('2026-08-29', 'ok', 0, null),
('2026-08-30', 'ok', 0, null),
('2026-08-31', 'ok', 0, 31),
('2026-09-01', 'ok', 0, null),
('2026-09-02', 'ok', 0, null),
('2026-09-03', 'ok', 0, 31),
('2026-09-04', 'ok', 0, 19),
('2026-09-05', 'ok', 0, null),
('2026-09-06', 'ok', 0, null),
('2026-09-07', 'ok', 0, null),
('2026-09-08', 'ok', 0, null),
('2026-09-09', 'ok', 0, 28),
('2026-09-10', 'ok', 0, null),
('2026-09-11', 'pendente', 1, 11),
('2026-09-12', 'ok', 0, null),
('2026-09-13', 'ok', 0, null),
('2026-09-14', 'ok', 0, null),
('2026-09-15', 'ok', 0, 8),
('2026-09-16', 'ok', 0, null),
('2026-09-17', 'ok', 0, null),
('2026-09-18', 'ok', 0, null),
('2026-09-19', 'ok', 0, null),
('2026-09-20', 'ok', 0, null),
('2026-09-21', 'ok', 0, null),
('2026-09-22', 'ok', 0, null),
('2026-09-23', 'ok', 0, null),
('2026-09-24', 'ok', 0, null),
('2026-09-25', 'ok', 0, 13),
('2026-09-26', 'ok', 0, null),
('2026-09-27', 'ok', 0, null),
('2026-09-28', 'ok', 0, null),
('2026-09-29', 'pendente', 1, null),
('2026-09-30', 'ok', 0, null),
('2026-10-01', 'ok', 0, null)
on conflict (day) do nothing;

insert into public.day_counts (day, category_id, value) values
('2026-06-23', 'interessado_sem_resposta', 2),
('2026-06-23', 'compra_futura', 2),
('2026-06-23', 'sem_retorno', 8),
('2026-06-23', 'orcamento_insuficiente', 1),
('2026-06-23', 'produto_nao_encaixa', 1),
('2026-06-23', 'nao_satisfeito', 1),
('2026-06-23', 'curriculo', 4),
('2026-06-23', 'engano', 2),
('2026-06-24', 'sem_retorno', 5),
('2026-06-24', 'engano', 2),
('2026-06-25', 'interessado_sem_resposta', 1),
('2026-06-25', 'compra_futura', 3),
('2026-06-25', 'sem_retorno', 3),
('2026-06-25', 'curriculo', 1),
('2026-06-25', 'engano', 2),
('2026-06-26', 'sem_retorno', 8),
('2026-06-26', 'curriculo', 2),
('2026-06-27', 'sem_retorno', 4),
('2026-06-27', 'engano', 2),
('2026-06-27', 'outros', 1),
('2026-06-28', 'interessado_sem_resposta', 2),
('2026-06-28', 'sem_retorno', 2),
('2026-06-28', 'curriculo', 1),
('2026-06-28', 'engano', 2),
('2026-06-29', 'compra_futura', 1),
('2026-06-29', 'sem_retorno', 5),
('2026-06-29', 'curriculo', 3),
('2026-06-29', 'engano', 1),
('2026-06-30', 'interessado_sem_resposta', 3),
('2026-06-30', 'sem_retorno', 11),
('2026-06-30', 'curriculo', 4),
('2026-06-30', 'engano', 1),
('2026-07-01', 'interessado_sem_resposta', 1),
('2026-07-01', 'sem_retorno', 3),
('2026-07-01', 'curriculo', 1),
('2026-07-01', 'engano', 2),
('2026-07-02', 'interessado_sem_resposta', 3),
('2026-07-02', 'sem_retorno', 5),
('2026-07-02', 'curriculo', 3),
('2026-07-03', 'interessado_sem_resposta', 2),
('2026-07-03', 'sem_retorno', 10),
('2026-07-03', 'curriculo', 3),
('2026-07-03', 'engano', 3),
('2026-07-04', 'comprou', 1),
('2026-07-04', 'interessado_sem_resposta', 2),
('2026-07-04', 'compra_futura', 1),
('2026-07-04', 'sem_retorno', 7),
('2026-07-04', 'produto_nao_encaixa', 1),
('2026-07-04', 'engano', 1),
('2026-07-05', 'interessado_sem_resposta', 1),
('2026-07-05', 'sem_retorno', 6),
('2026-07-05', 'curriculo', 2),
('2026-07-06', 'sem_retorno', 12),
('2026-07-06', 'curriculo', 3),
('2026-07-06', 'engano', 3),
('2026-07-07', 'comprou', 1),
('2026-07-07', 'interessado_sem_resposta', 1),
('2026-07-07', 'sem_retorno', 16),
('2026-07-07', 'produto_nao_encaixa', 1),
('2026-07-07', 'curriculo', 3),
('2026-07-07', 'engano', 2),
('2026-07-08', 'compra_futura', 1),
('2026-07-08', 'sem_retorno', 9),
('2026-07-08', 'curriculo', 2),
('2026-07-09', 'interessado_sem_resposta', 2),
('2026-07-09', 'sem_retorno', 4),
('2026-07-09', 'curriculo', 3),
('2026-07-09', 'engano', 3),
('2026-07-10', 'sem_retorno', 8),
('2026-07-10', 'curriculo', 4),
('2026-07-10', 'engano', 2),
('2026-07-10', 'outros', 1),
('2026-07-11', 'interessado_sem_resposta', 1),
('2026-07-11', 'compra_futura', 1),
('2026-07-11', 'sem_retorno', 6),
('2026-07-11', 'engano', 3),
('2026-07-12', 'sem_retorno', 5),
('2026-07-13', 'interessado_sem_resposta', 4),
('2026-07-13', 'sem_retorno', 8),
('2026-07-13', 'curriculo', 2),
('2026-07-13', 'engano', 3),
('2026-07-14', 'interessado_sem_resposta', 2),
('2026-07-14', 'sem_retorno', 7),
('2026-07-14', 'curriculo', 7),
('2026-07-14', 'engano', 3),
('2026-07-15', 'interessado_sem_resposta', 3),
('2026-07-15', 'sem_retorno', 4),
('2026-07-15', 'produto_nao_encaixa', 1),
('2026-07-15', 'concorrente', 1),
('2026-07-15', 'curriculo', 5),
('2026-07-15', 'engano', 6),
('2026-07-16', 'sem_retorno', 4),
('2026-07-16', 'produto_nao_encaixa', 1),
('2026-07-16', 'concorrente', 1),
('2026-07-16', 'curriculo', 5),
('2026-07-16', 'engano', 1),
('2026-07-17', 'interessado_sem_resposta', 2),
('2026-07-17', 'compra_futura', 1),
('2026-07-17', 'sem_retorno', 4),
('2026-07-17', 'orcamento_insuficiente', 1),
('2026-07-17', 'curriculo', 3),
('2026-07-17', 'engano', 2),
('2026-07-18', 'interessado_sem_resposta', 2),
('2026-07-18', 'sem_retorno', 3),
('2026-07-18', 'curriculo', 5),
('2026-07-18', 'engano', 3),
('2026-07-19', 'interessado_sem_resposta', 2),
('2026-07-19', 'sem_retorno', 6),
('2026-07-19', 'curriculo', 7),
('2026-07-19', 'engano', 4),
('2026-07-20', 'sem_retorno', 5),
('2026-07-20', 'curriculo', 14),
('2026-07-20', 'engano', 1),
('2026-07-21', 'interessado_sem_resposta', 3),
('2026-07-21', 'sem_retorno', 3),
('2026-07-21', 'produto_nao_encaixa', 1),
('2026-07-21', 'curriculo', 15),
('2026-07-22', 'interessado_sem_resposta', 2),
('2026-07-22', 'sem_retorno', 4),
('2026-07-22', 'curriculo', 5),
('2026-07-22', 'engano', 5),
('2026-07-23', 'compra_futura', 1),
('2026-07-23', 'sem_retorno', 6),
('2026-07-23', 'curriculo', 6),
('2026-07-24', 'interessado_sem_resposta', 4),
('2026-07-24', 'sem_retorno', 7),
('2026-07-24', 'curriculo', 8),
('2026-07-24', 'engano', 3),
('2026-07-25', 'interessado_sem_resposta', 2),
('2026-07-25', 'sem_retorno', 7),
('2026-07-25', 'curriculo', 4),
('2026-07-25', 'engano', 5),
('2026-07-26', 'interessado_sem_resposta', 2),
('2026-07-26', 'sem_retorno', 7),
('2026-07-26', 'curriculo', 3),
('2026-07-26', 'engano', 4),
('2026-07-26', 'outros', 1),
('2026-07-27', 'interessado_sem_resposta', 1),
('2026-07-27', 'compra_futura', 1),
('2026-07-27', 'sem_retorno', 7),
('2026-07-27', 'curriculo', 11),
('2026-07-27', 'engano', 2),
('2026-07-27', 'outros', 1),
('2026-07-28', 'interessado_sem_resposta', 1),
('2026-07-28', 'sem_retorno', 9),
('2026-07-28', 'curriculo', 7),
('2026-07-28', 'engano', 2),
('2026-07-29', 'interessado_sem_resposta', 3),
('2026-07-29', 'sem_retorno', 5),
('2026-07-29', 'curriculo', 1),
('2026-07-29', 'engano', 3),
('2026-07-29', 'outros', 2),
('2026-08-19', 'sem_retorno', 12),
('2026-08-19', 'orcamento_insuficiente', 1),
('2026-08-19', 'curriculo', 10),
('2026-08-19', 'engano', 3),
('2026-08-20', 'compra_futura', 1),
('2026-08-20', 'sem_retorno', 18),
('2026-08-20', 'curriculo', 14),
('2026-08-20', 'engano', 2),
('2026-08-21', 'sem_retorno', 9),
('2026-08-21', 'curriculo', 6),
('2026-08-21', 'engano', 3),
('2026-08-22', 'compra_futura', 2),
('2026-08-22', 'sem_retorno', 13),
('2026-08-22', 'curriculo', 5),
('2026-08-22', 'engano', 5),
('2026-08-23', 'compra_futura', 1),
('2026-08-23', 'sem_retorno', 19),
('2026-08-23', 'curriculo', 5),
('2026-08-23', 'engano', 3),
('2026-08-24', 'interessado_sem_resposta', 1),
('2026-08-24', 'compra_futura', 1),
('2026-08-24', 'sem_retorno', 10),
('2026-08-24', 'curriculo', 23),
('2026-08-24', 'engano', 3),
('2026-08-25', 'sem_retorno', 9),
('2026-08-25', 'curriculo', 9),
('2026-08-25', 'engano', 2),
('2026-08-26', 'sem_retorno', 9),
('2026-08-26', 'curriculo', 24),
('2026-08-26', 'engano', 1),
('2026-08-26', 'outros', 2),
('2026-08-27', 'sem_retorno', 6),
('2026-08-27', 'curriculo', 14),
('2026-08-27', 'engano', 1),
('2026-08-28', 'interessado_sem_resposta', 1),
('2026-08-28', 'sem_retorno', 6),
('2026-08-28', 'curriculo', 7),
('2026-08-29', 'sem_retorno', 8),
('2026-08-29', 'curriculo', 4),
('2026-08-29', 'engano', 3),
('2026-08-30', 'sem_retorno', 10),
('2026-08-30', 'curriculo', 9),
('2026-08-30', 'engano', 3),
('2026-08-31', 'interessado_sem_resposta', 2),
('2026-08-31', 'sem_retorno', 12),
('2026-08-31', 'curriculo', 14),
('2026-08-31', 'engano', 3),
('2026-08-31', 'outros', 3),
('2026-09-01', 'sem_retorno', 13),
('2026-09-01', 'curriculo', 23),
('2026-09-01', 'engano', 5),
('2026-09-02', 'compra_futura', 1),
('2026-09-02', 'sem_retorno', 7),
('2026-09-02', 'curriculo', 20),
('2026-09-02', 'engano', 6),
('2026-09-03', 'sem_retorno', 8),
('2026-09-03', 'curriculo', 19),
('2026-09-03', 'engano', 4),
('2026-09-03', 'outros', 1),
('2026-09-04', 'compra_futura', 1),
('2026-09-04', 'sem_retorno', 2),
('2026-09-04', 'curriculo', 14),
('2026-09-04', 'engano', 2),
('2026-09-04', 'outros', 2),
('2026-09-05', 'comprou', 1),
('2026-09-05', 'sem_retorno', 6),
('2026-09-05', 'curriculo', 6),
('2026-09-05', 'engano', 3),
('2026-09-06', 'interessado_sem_resposta', 1),
('2026-09-06', 'sem_retorno', 6),
('2026-09-06', 'curriculo', 5),
('2026-09-07', 'sem_retorno', 8),
('2026-09-07', 'curriculo', 9),
('2026-09-07', 'engano', 3),
('2026-09-08', 'interessado_sem_resposta', 1),
('2026-09-08', 'sem_retorno', 6),
('2026-09-08', 'curriculo', 15),
('2026-09-08', 'engano', 7),
('2026-09-09', 'sem_retorno', 12),
('2026-09-09', 'curriculo', 16),
('2026-09-09', 'outros', 1),
('2026-09-10', 'compra_futura', 1),
('2026-09-10', 'sem_retorno', 4),
('2026-09-10', 'curriculo', 12),
('2026-09-10', 'engano', 1),
('2026-09-11', 'sem_retorno', 5),
('2026-09-11', 'curriculo', 5),
('2026-09-11', 'engano', 1),
('2026-09-11', 'outros', 1),
('2026-09-12', 'comprou', 1),
('2026-09-12', 'sem_retorno', 4),
('2026-09-12', 'concorrente', 1),
('2026-09-12', 'curriculo', 7),
('2026-09-12', 'engano', 1),
('2026-09-13', 'sem_retorno', 6),
('2026-09-13', 'curriculo', 7),
('2026-09-13', 'engano', 1),
('2026-09-14', 'sem_retorno', 7),
('2026-09-14', 'curriculo', 15),
('2026-09-14', 'engano', 2),
('2026-09-15', 'sem_retorno', 3),
('2026-09-15', 'curriculo', 5),
('2026-09-15', 'outros', 1),
('2026-09-16', 'compra_futura', 2),
('2026-09-16', 'sem_retorno', 6),
('2026-09-16', 'curriculo', 10),
('2026-09-16', 'engano', 3),
('2026-09-17', 'sem_retorno', 4),
('2026-09-17', 'curriculo', 22),
('2026-09-17', 'engano', 2),
('2026-09-18', 'interessado_sem_resposta', 1),
('2026-09-18', 'sem_retorno', 4),
('2026-09-18', 'curriculo', 4),
('2026-09-18', 'engano', 1),
('2026-09-19', 'sem_retorno', 8),
('2026-09-19', 'curriculo', 2),
('2026-09-20', 'sem_retorno', 7),
('2026-09-20', 'curriculo', 5),
('2026-09-20', 'engano', 4),
('2026-09-21', 'interessado_sem_resposta', 1),
('2026-09-21', 'sem_retorno', 9),
('2026-09-21', 'curriculo', 11),
('2026-09-21', 'engano', 2),
('2026-09-22', 'sem_retorno', 6),
('2026-09-22', 'curriculo', 8),
('2026-09-22', 'engano', 2),
('2026-09-23', 'sem_retorno', 3),
('2026-09-23', 'curriculo', 12),
('2026-09-24', 'sem_retorno', 3),
('2026-09-24', 'curriculo', 7),
('2026-09-24', 'engano', 1),
('2026-09-25', 'interessado_sem_resposta', 2),
('2026-09-25', 'sem_retorno', 3),
('2026-09-25', 'curriculo', 6),
('2026-09-25', 'engano', 2),
('2026-09-25', 'outros', 1),
('2026-09-26', 'sem_retorno', 2),
('2026-09-26', 'curriculo', 3),
('2026-09-26', 'engano', 1),
('2026-09-27', 'sem_retorno', 4),
('2026-09-27', 'engano', 2),
('2026-09-28', 'sem_retorno', 11),
('2026-09-28', 'curriculo', 7),
('2026-09-29', 'sem_retorno', 3),
('2026-09-29', 'curriculo', 7),
('2026-09-29', 'engano', 1),
('2026-09-30', 'sem_retorno', 4),
('2026-09-30', 'curriculo', 2),
('2026-10-01', 'sem_retorno', 3),
('2026-10-01', 'curriculo', 5),
('2026-10-01', 'engano', 2)
on conflict (day, category_id) do nothing;

insert into public.analysis_leads (id, phone, day, description) values
('analise-1', '5511942192114', '2026-09-11', ''),
('analise-2', '5519990093000', '2026-09-29', '')
on conflict (id) do nothing;
