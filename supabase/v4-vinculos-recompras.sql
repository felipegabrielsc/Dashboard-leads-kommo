-- Vínculo com o Kommo depois da importação e recompra lançada à mão.
-- Rode no SQL Editor depois de supabase/v4-vendas.sql. Não altera lançamentos, orçamentos nem negócios do Kommo.
-- A recompra manual não pertence a nenhuma planilha: uma importação nova não apaga essas linhas.
-- O vínculo marca a venda como já registrada no Kommo e tira a linha da receita consolidada.

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
  check (already_in_kommo = (kommo_lead_id is not null));

create index if not exists v4_sales_manual_date_idx on public.v4_sales (sale_date) where source = 'manual';
create index if not exists v4_sales_kommo_lead_idx on public.v4_sales (kommo_lead_id) where kommo_lead_id is not null;

alter table public.v4_sales alter column created_by set default auth.uid();
