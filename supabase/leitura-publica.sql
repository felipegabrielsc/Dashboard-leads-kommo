-- Rode este arquivo se o schema.sql antigo já foi executado.
-- Libera a leitura para qualquer visitante e mantém alteração só para quem está logado.

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

revoke insert, update, delete on public.categories from anon;
revoke insert, update, delete on public.days from anon;
revoke insert, update, delete on public.day_counts from anon;
revoke insert, update, delete on public.analysis_leads from anon;

grant select on public.categories to anon;
grant select on public.days to anon;
grant select on public.day_counts to anon;
revoke select on table public.analysis_leads from anon;
revoke select (id, phone, day, description) on public.analysis_leads from anon;
grant select (id, day, description) on public.analysis_leads to anon;
