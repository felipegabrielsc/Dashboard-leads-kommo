-- Rode este arquivo se o schema.sql antigo já foi executado.
-- Guarda o nome, o WhatsApp e a validade que saem no PDF do catálogo.
-- Também esconde o e-mail do histórico de quem não está logado.

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

revoke select on table public.change_log from anon;
grant select (id, created_at, kind, day, category_id, summary) on public.change_log to anon;
