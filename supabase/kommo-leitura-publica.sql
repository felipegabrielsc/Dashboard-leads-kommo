-- Leitura pública do Comercial e de Vendas.
-- Rode no SQL Editor depois de supabase/kommo.sql.
-- Quem não entrou passa a ver as duas telas. Gravação, configurações e importação continuam só para quem está logado.

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
    'v4_import_batches',
    'v4_sales'
  ]
  loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;
    execute format('drop policy if exists "public read %1$s" on public.%1$s', tbl);
    execute format('create policy "public read %1$s" on public.%1$s for select to anon using (true)', tbl);
    execute format('grant select on public.%1$s to anon', tbl);
  end loop;
end $$;

do $$
begin
  if to_regprocedure('public.kommo_commercial_report(bigint,date,date,bigint,bigint,text)') is not null then
    grant execute on function public.kommo_commercial_report(bigint, date, date, bigint, bigint, text) to anon;
  end if;
  if to_regprocedure('public.kommo_commercial_sales(bigint,date,date,bigint,bigint,text,integer,integer)') is not null then
    grant execute on function public.kommo_commercial_sales(bigint, date, date, bigint, bigint, text, integer, integer) to anon;
  end if;
end $$;
