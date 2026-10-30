-- Vendas importadas da planilha V4. Rode no SQL Editor depois de supabase/kommo.sql.
-- Estas tabelas não alteram lançamentos, orçamentos, histórico nem negócios do Kommo.
-- Só a importação ativa entra nos indicadores. Uma planilha nova substitui a anterior.
-- Recompra é N° da compra maior que 1. O vínculo com o Kommo só existe quando alguém marca a linha.

create table if not exists public.v4_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_hash text not null,
  imported_by uuid,
  imported_at timestamptz not null default now(),
  row_count integer not null default 0,
  first_count integer not null default 0,
  repurchase_count integer not null default 0,
  total_amount numeric not null default 0,
  first_amount numeric not null default 0,
  repurchase_amount numeric not null default 0,
  status text not null default 'active' check (status in ('active', 'replaced')),
  replaced_at timestamptz
);

create unique index if not exists v4_import_batches_active_hash
  on public.v4_import_batches (file_hash)
  where status = 'active';

create unique index if not exists v4_import_batches_one_active
  on public.v4_import_batches ((true))
  where status = 'active';

create table if not exists public.v4_sales (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.v4_import_batches (id) on delete cascade,
  source_row integer not null,
  sale_date date not null,
  customer_name text not null,
  customer_key text not null,
  amount numeric not null check (amount >= 0),
  purchase_number integer not null check (purchase_number >= 1),
  is_repurchase boolean not null,
  seller_name text not null default '',
  raw_material_cost numeric,
  tax_cost numeric,
  operational_cost numeric,
  profit numeric,
  kommo_lead_id bigint,
  already_in_kommo boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists v4_sales_batch_idx on public.v4_sales (import_batch_id);
create index if not exists v4_sales_date_idx on public.v4_sales (sale_date);
create index if not exists v4_sales_repurchase_date_idx on public.v4_sales (is_repurchase, sale_date);

alter table public.v4_import_batches enable row level security;
alter table public.v4_sales enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['v4_import_batches', 'v4_sales']
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
    execute format('drop policy if exists "public read %1$s" on public.%1$s', tbl);
    execute format('create policy "public read %1$s" on public.%1$s for select to anon using (true)', tbl);
    execute format('grant select on public.%1$s to anon', tbl);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', tbl);
    execute format('grant select, insert, update, delete on public.%1$s to service_role', tbl);
  end loop;
end $$;

create or replace function public.v4_commit_import(
  p_file_name text,
  p_file_hash text,
  p_rows jsonb
) returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_purchase integer;
  v_amount numeric;
  v_repurchase boolean;
  v_lead bigint;
  v_flag boolean;
  v_rows integer := 0;
  v_first_count integer := 0;
  v_repurchase_count integer := 0;
  v_total numeric := 0;
  v_first numeric := 0;
  v_repurchase_amount numeric := 0;
begin
  if p_file_hash is null or btrim(p_file_hash) = '' then
    return jsonb_build_object('ok', false, 'error', 'hash');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return jsonb_build_object('ok', false, 'error', 'rows');
  end if;
  if exists (
    select 1 from public.v4_import_batches
    where status = 'active' and file_hash = p_file_hash
  ) then
    return jsonb_build_object('ok', false, 'error', 'same');
  end if;

  update public.v4_import_batches
  set status = 'replaced', replaced_at = now()
  where status = 'active';

  insert into public.v4_import_batches (file_name, file_hash, imported_by, status)
  values (left(coalesce(nullif(btrim(p_file_name), ''), 'planilha.xlsx'), 200), p_file_hash, auth.uid(), 'active')
  returning id into v_id;

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    v_purchase := (v_item->>'purchaseNumber')::integer;
    v_amount := (v_item->>'amount')::numeric;
    v_repurchase := v_purchase > 1;
    v_lead := nullif(v_item->>'kommoLeadId', '')::bigint;
    v_flag := v_lead is not null and coalesce((v_item->>'alreadyInKommo')::boolean, false);
    if not v_flag then
      v_lead := null;
    end if;

    insert into public.v4_sales (
      import_batch_id,
      source_row,
      sale_date,
      customer_name,
      customer_key,
      amount,
      purchase_number,
      is_repurchase,
      seller_name,
      raw_material_cost,
      tax_cost,
      operational_cost,
      profit,
      kommo_lead_id,
      already_in_kommo
    ) values (
      v_id,
      (v_item->>'sourceRow')::integer,
      (v_item->>'saleDate')::date,
      left(coalesce(v_item->>'customerName', ''), 200),
      left(coalesce(v_item->>'customerKey', ''), 200),
      v_amount,
      v_purchase,
      v_repurchase,
      left(coalesce(v_item->>'sellerName', ''), 120),
      nullif(v_item->>'rawMaterialCost', '')::numeric,
      nullif(v_item->>'taxCost', '')::numeric,
      nullif(v_item->>'operationalCost', '')::numeric,
      nullif(v_item->>'profit', '')::numeric,
      v_lead,
      v_flag
    );

    v_rows := v_rows + 1;
    v_total := v_total + v_amount;
    if v_repurchase then
      v_repurchase_count := v_repurchase_count + 1;
      v_repurchase_amount := v_repurchase_amount + v_amount;
    else
      v_first_count := v_first_count + 1;
      v_first := v_first + v_amount;
    end if;
  end loop;

  update public.v4_import_batches
  set row_count = v_rows,
      first_count = v_first_count,
      repurchase_count = v_repurchase_count,
      total_amount = v_total,
      first_amount = v_first,
      repurchase_amount = v_repurchase_amount
  where id = v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'rowCount', v_rows,
    'firstCount', v_first_count,
    'repurchaseCount', v_repurchase_count,
    'totalAmount', v_total,
    'firstAmount', v_first,
    'repurchaseAmount', v_repurchase_amount
  );
end;
$$;

revoke all on function public.v4_commit_import(text, text, jsonb) from public;
revoke all on function public.v4_commit_import(text, text, jsonb) from anon;
grant execute on function public.v4_commit_import(text, text, jsonb) to authenticated;
