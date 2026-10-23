-- Rode este arquivo se a tabela de orçamentos já existe.
-- Separa corte e vinco das caixas comuns. Quem já tem a nota "corte e vinco" passa para essa seção.

alter table public.quotes add column if not exists family text not null default 'padrao';

alter table public.quotes drop constraint if exists quotes_family_check;
alter table public.quotes add constraint quotes_family_check check (family in ('padrao', 'corte_vinco'));

update public.quotes
set family = 'corte_vinco'
where family = 'padrao' and note ilike '%vinco%';
