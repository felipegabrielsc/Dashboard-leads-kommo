-- Vínculo com o Kommo depois da importação e recompra lançada à mão.
-- Rode no SQL Editor depois de supabase/v4-vendas.sql. Não altera lançamentos, orçamentos nem negócios do Kommo.
-- A recompra manual não pertence a nenhuma planilha: uma importação nova não apaga essas linhas.
-- O vínculo liga a venda ao lead do cliente no Kommo. A primeira compra e as recompras do mesmo cliente podem apontar para o mesmo lead.
-- Só a venda marcada como já contada no Kommo (already_in_kommo) sai da receita consolidada. As demais vinculadas continuam somando.

alter table public.v4_sales alter column import_batch_id drop not null;

alter table public.v4_sales add column if not exists source text not null default 'planilha';
alter table public.v4_sales add column if not exists created_by uuid;
alter table public.v4_sales add column if not exists updated_at timestamptz;
alter table public.v4_sales add column if not exists linked_by uuid;
alter table public.v4_sales add column if not exists linked_at timestamptz;

alter table public.v4_sales drop constraint if exists v4_sales_source_check;
alter table public.v4_sales add constraint v4_sales_source_check
  check (source in ('planilha', 'manual'));

alter table public.v4_sales drop constraint if exists v4_sales_origin_check;
alter table public.v4_sales add constraint v4_sales_origin_check
  check ((source = 'manual') = (import_batch_id is null));

alter table public.v4_sales drop constraint if exists v4_sales_manual_repurchase_check;
alter table public.v4_sales add constraint v4_sales_manual_repurchase_check
  check (source <> 'manual' or (is_repurchase and purchase_number >= 2));

alter table public.v4_sales drop constraint if exists v4_sales_repurchase_number_check;
alter table public.v4_sales add constraint v4_sales_repurchase_number_check
  check (is_repurchase = (purchase_number > 1));

alter table public.v4_sales drop constraint if exists v4_sales_link_check;
alter table public.v4_sales add constraint v4_sales_link_check
  check (not already_in_kommo or kommo_lead_id is not null);

create index if not exists v4_sales_manual_date_idx on public.v4_sales (sale_date) where source = 'manual';
create index if not exists v4_sales_kommo_lead_idx on public.v4_sales (kommo_lead_id) where kommo_lead_id is not null;

alter table public.v4_sales alter column created_by set default auth.uid();

-- A importação passa a guardar o lead do cliente mesmo quando a venda continua somando.
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
