-- Indicadores comerciais calculados no Postgres.
-- Rode no SQL Editor depois de supabase/kommo.sql.
-- Não altera lançamentos, orçamentos, histórico nem as tabelas do Kommo.
-- As fórmulas seguem lib/kommo/metrics.ts: fuso America/Sao_Paulo, venda ganha
-- exige status_kind = won e closed_at no período, carteira aberta ignora o período.

create index if not exists kommo_leads_won_closed_idx
  on public.kommo_leads (account_id, closed_at)
  where is_deleted = false and status_kind = 'won';

create index if not exists kommo_leads_created_open_idx
  on public.kommo_leads (account_id, created_at)
  where is_deleted = false;

create or replace function public.kommo_commercial_report(
  p_account_id bigint,
  p_from date,
  p_to date,
  p_pipeline_id bigint default null,
  p_user_id bigint default null,
  p_grain text default null
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_days integer;
  v_grain text;
  v_new integer;
  v_won integer;
  v_lost integer;
  v_cohort integer;
  v_open integer;
  v_open_value float8;
  v_revenue float8;
  v_without integer;
  v_series jsonb;
  v_sellers jsonb;
  v_funnels jsonb;
  v_preview jsonb;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'periodo invalido';
  end if;

  v_days := (p_to - p_from) + 1;
  if p_grain in ('day', 'week', 'month') then
    v_grain := p_grain;
  elsif v_days <= 45 then
    v_grain := 'day';
  elsif v_days <= 180 then
    v_grain := 'week';
  else
    v_grain := 'month';
  end if;

  select count(*)::int into v_new
  from public.kommo_leads l
  where l.account_id = p_account_id
    and l.is_deleted = false
    and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
    and (p_user_id is null or l.responsible_user_id = p_user_id)
    and l.created_at is not null
    and (l.created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to;

  select count(*)::int, coalesce(sum(l.price), 0)::float8
    into v_won, v_revenue
  from public.kommo_leads l
  where l.account_id = p_account_id
    and l.is_deleted = false
    and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
    and (p_user_id is null or l.responsible_user_id = p_user_id)
    and l.status_kind = 'won'
    and l.closed_at is not null
    and (l.closed_at at time zone 'America/Sao_Paulo')::date between p_from and p_to;

  select count(*)::int into v_lost
  from public.kommo_leads l
  where l.account_id = p_account_id
    and l.is_deleted = false
    and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
    and (p_user_id is null or l.responsible_user_id = p_user_id)
    and l.status_kind = 'lost'
    and l.closed_at is not null
    and (l.closed_at at time zone 'America/Sao_Paulo')::date between p_from and p_to;

  select count(*)::int into v_cohort
  from public.kommo_leads l
  where l.account_id = p_account_id
    and l.is_deleted = false
    and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
    and (p_user_id is null or l.responsible_user_id = p_user_id)
    and l.status_kind = 'won'
    and l.created_at is not null
    and (l.created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to;

  select count(*)::int, coalesce(sum(l.price), 0)::float8
    into v_open, v_open_value
  from public.kommo_leads l
  where l.account_id = p_account_id
    and l.is_deleted = false
    and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
    and (p_user_id is null or l.responsible_user_id = p_user_id)
    and l.status_kind = 'open';

  select count(*)::int into v_without
  from public.kommo_leads l
  where l.account_id = p_account_id
    and l.is_deleted = false
    and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
    and (p_user_id is null or l.responsible_user_id = p_user_id)
    and l.status_kind = 'won'
    and l.closed_at is null;

  with created as (
    select
      case v_grain
        when 'month' then to_char((l.created_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM')
        when 'week' then to_char(date_trunc('week', (l.created_at at time zone 'America/Sao_Paulo')::date)::date, 'YYYY-MM-DD')
        else to_char((l.created_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')
      end as key,
      count(*)::int as leads
    from public.kommo_leads l
    where l.account_id = p_account_id
      and l.is_deleted = false
      and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
      and (p_user_id is null or l.responsible_user_id = p_user_id)
      and l.created_at is not null
      and (l.created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
    group by 1
  ),
  won as (
    select
      case v_grain
        when 'month' then to_char((l.closed_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM')
        when 'week' then to_char(date_trunc('week', (l.closed_at at time zone 'America/Sao_Paulo')::date)::date, 'YYYY-MM-DD')
        else to_char((l.closed_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')
      end as key,
      count(*)::int as sales,
      coalesce(sum(l.price), 0)::float8 as revenue
    from public.kommo_leads l
    where l.account_id = p_account_id
      and l.is_deleted = false
      and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
      and (p_user_id is null or l.responsible_user_id = p_user_id)
      and l.status_kind = 'won'
      and l.closed_at is not null
      and (l.closed_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
    group by 1
  ),
  keys as (
    select key from created
    union
    select key from won
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'key', k.key,
    'leads', coalesce(c.leads, 0),
    'sales', coalesce(w.sales, 0),
    'revenue', coalesce(w.revenue, 0)
  ) order by k.key), '[]'::jsonb)
  into v_series
  from keys k
  left join created c on c.key = k.key
  left join won w on w.key = k.key;

  with created as (
    select l.responsible_user_id as user_id, count(*)::int as leads
    from public.kommo_leads l
    where l.account_id = p_account_id
      and l.is_deleted = false
      and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
      and (p_user_id is null or l.responsible_user_id = p_user_id)
      and l.created_at is not null
      and (l.created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
    group by 1
  ),
  won as (
    select l.responsible_user_id as user_id, count(*)::int as sales, coalesce(sum(l.price), 0)::float8 as revenue
    from public.kommo_leads l
    where l.account_id = p_account_id
      and l.is_deleted = false
      and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
      and (p_user_id is null or l.responsible_user_id = p_user_id)
      and l.status_kind = 'won'
      and l.closed_at is not null
      and (l.closed_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
    group by 1
  ),
  people as (
    select user_id from created
    union
    select user_id from won
  ),
  rows as (
    select
      p.user_id as id,
      coalesce(nullif(u.name, ''), 'Sem responsável') as seller_name,
      coalesce(c.leads, 0) as leads,
      coalesce(w.sales, 0) as sales,
      coalesce(w.revenue, 0)::float8 as revenue,
      case when coalesce(c.leads, 0) = 0 then null else coalesce(w.sales, 0)::float8 / c.leads end as conversion
    from people p
    left join created c on c.user_id is not distinct from p.user_id
    left join won w on w.user_id is not distinct from p.user_id
    left join public.kommo_users u
      on u.account_id = p_account_id
     and u.id = p.user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'name', seller_name,
    'leads', leads,
    'sales', sales,
    'revenue', revenue,
    'conversion', conversion
  ) order by revenue desc, sales desc, seller_name asc), '[]'::jsonb)
  into v_sellers
  from rows;

  select coalesce(jsonb_agg(funnel order by pipeline_name), '[]'::jsonb)
  into v_funnels
  from (
    select
      p.name as pipeline_name,
      jsonb_build_object(
        'pipelineId', p.id,
        'pipelineName', p.name,
        'stages', coalesce((
          select jsonb_agg(jsonb_build_object(
            'statusId', s.id,
            'name', s.name,
            'kind', s.kind,
            'count', coalesce(c.cnt, 0),
            'value', coalesce(c.val, 0)
          ) order by s.sort, s.id)
          from public.kommo_statuses s
          left join (
            select l.status_id, count(*)::int as cnt, coalesce(sum(l.price), 0)::float8 as val
            from public.kommo_leads l
            where l.account_id = p_account_id
              and l.is_deleted = false
              and l.pipeline_id = p.id
              and (p_user_id is null or l.responsible_user_id = p_user_id)
              and l.status_id is not null
            group by l.status_id
          ) c on c.status_id = s.id
          where s.account_id = p.account_id
            and s.pipeline_id = p.id
        ), '[]'::jsonb)
      ) as funnel
    from public.kommo_pipelines p
    where p.account_id = p_account_id
      and (p_pipeline_id is null or p.id = p_pipeline_id)
      and exists (
        select 1 from public.kommo_statuses s
        where s.account_id = p.account_id and s.pipeline_id = p.id
      )
  ) funnels;

  select coalesce(jsonb_agg(row_json), '[]'::jsonb)
  into v_preview
  from (
    select jsonb_build_object(
      'id', l.id,
      'name', coalesce(nullif(l.name, ''), 'Negócio ' || l.id),
      'price', l.price::float8,
      'closedAt', l.closed_at,
      'createdAt', l.created_at,
      'pipelineName', coalesce(p.name, ''),
      'statusName', coalesce(s.name, ''),
      'userName', coalesce(nullif(u.name, ''), 'Sem responsável'),
      'url', coalesce(l.kommo_url, '')
    ) as row_json
    from public.kommo_leads l
    left join public.kommo_pipelines p
      on p.account_id = l.account_id and p.id = l.pipeline_id
    left join public.kommo_statuses s
      on s.account_id = l.account_id and s.pipeline_id = l.pipeline_id and s.id = l.status_id
    left join public.kommo_users u
      on u.account_id = l.account_id and u.id = l.responsible_user_id
    where l.account_id = p_account_id
      and l.is_deleted = false
      and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
      and (p_user_id is null or l.responsible_user_id = p_user_id)
      and l.status_kind = 'won'
      and l.closed_at is not null
      and (l.closed_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
    order by l.closed_at desc nulls last, l.id desc
    limit 8
  ) preview;

  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'newLeads', v_new,
      'wonCount', v_won,
      'revenue', v_revenue,
      'averageTicket', case when v_won = 0 then null else v_revenue / v_won end,
      'conversionPeriod', case when v_new = 0 then null else v_won::float8 / v_new end,
      'conversionCohort', case when v_new = 0 then null else v_cohort::float8 / v_new end,
      'lostCount', v_lost,
      'openCount', v_open,
      'openValue', v_open_value,
      'wonWithoutClose', v_without
    ),
    'grain', v_grain,
    'series', v_series,
    'sellers', v_sellers,
    'funnels', v_funnels,
    'salesTotal', v_won,
    'salesPreview', v_preview
  );
end;
$$;

create or replace function public.kommo_commercial_sales(
  p_account_id bigint,
  p_from date,
  p_to date,
  p_pipeline_id bigint default null,
  p_user_id bigint default null,
  p_query text default '',
  p_limit integer default 50,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_query text;
  v_limit integer;
  v_offset integer;
  v_sales_total integer;
  v_match_total integer;
  v_sales jsonb;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'periodo invalido';
  end if;

  v_query := replace(replace(replace(lower(btrim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_');
  v_limit := least(100, greatest(1, coalesce(p_limit, 50)));
  v_offset := greatest(0, coalesce(p_offset, 0));

  select count(*)::int into v_sales_total
  from public.kommo_leads l
  where l.account_id = p_account_id
    and l.is_deleted = false
    and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
    and (p_user_id is null or l.responsible_user_id = p_user_id)
    and l.status_kind = 'won'
    and l.closed_at is not null
    and (l.closed_at at time zone 'America/Sao_Paulo')::date between p_from and p_to;

  select count(*)::int into v_match_total
  from public.kommo_leads l
  where l.account_id = p_account_id
    and l.is_deleted = false
    and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
    and (p_user_id is null or l.responsible_user_id = p_user_id)
    and l.status_kind = 'won'
    and l.closed_at is not null
    and (l.closed_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
    and (
      v_query = ''
      or l.id::text like '%' || v_query || '%' escape '\'
      or lower(coalesce(nullif(l.name, ''), 'Negócio ' || l.id)) like '%' || v_query || '%' escape '\'
    );

  select coalesce(jsonb_agg(row_json), '[]'::jsonb)
  into v_sales
  from (
    select jsonb_build_object(
      'id', l.id,
      'name', coalesce(nullif(l.name, ''), 'Negócio ' || l.id),
      'price', l.price::float8,
      'closedAt', l.closed_at,
      'createdAt', l.created_at,
      'pipelineName', coalesce(p.name, ''),
      'statusName', coalesce(s.name, ''),
      'userName', coalesce(nullif(u.name, ''), 'Sem responsável'),
      'url', coalesce(l.kommo_url, '')
    ) as row_json
    from public.kommo_leads l
    left join public.kommo_pipelines p
      on p.account_id = l.account_id and p.id = l.pipeline_id
    left join public.kommo_statuses s
      on s.account_id = l.account_id and s.pipeline_id = l.pipeline_id and s.id = l.status_id
    left join public.kommo_users u
      on u.account_id = l.account_id and u.id = l.responsible_user_id
    where l.account_id = p_account_id
      and l.is_deleted = false
      and (p_pipeline_id is null or l.pipeline_id = p_pipeline_id)
      and (p_user_id is null or l.responsible_user_id = p_user_id)
      and l.status_kind = 'won'
      and l.closed_at is not null
      and (l.closed_at at time zone 'America/Sao_Paulo')::date between p_from and p_to
      and (
        v_query = ''
        or l.id::text like '%' || v_query || '%' escape '\'
        or lower(coalesce(nullif(l.name, ''), 'Negócio ' || l.id)) like '%' || v_query || '%' escape '\'
      )
    order by l.closed_at desc nulls last, l.id desc
    limit v_limit
    offset v_offset
  ) page;

  return jsonb_build_object(
    'sales', v_sales,
    'salesTotal', v_sales_total,
    'matchTotal', v_match_total
  );
end;
$$;

revoke all on function public.kommo_commercial_report(bigint, date, date, bigint, bigint, text) from public;
grant execute on function public.kommo_commercial_report(bigint, date, date, bigint, bigint, text) to anon;
grant execute on function public.kommo_commercial_report(bigint, date, date, bigint, bigint, text) to authenticated;

revoke all on function public.kommo_commercial_sales(bigint, date, date, bigint, bigint, text, integer, integer) from public;
grant execute on function public.kommo_commercial_sales(bigint, date, date, bigint, bigint, text, integer, integer) to anon;
grant execute on function public.kommo_commercial_sales(bigint, date, date, bigint, bigint, text, integer, integer) to authenticated;
