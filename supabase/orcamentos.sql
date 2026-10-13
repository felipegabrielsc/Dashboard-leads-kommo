-- Rode este arquivo se o schema.sql antigo já foi executado.
-- Cria a tabela de orçamentos. Só quem está logado lê, importa e apaga.

create table if not exists public.quotes (
  id text primary key,
  width integer not null check (width > 0),
  depth integer not null check (depth > 0),
  height integer not null check (height > 0),
  material text not null default '',
  note text not null default '',
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
