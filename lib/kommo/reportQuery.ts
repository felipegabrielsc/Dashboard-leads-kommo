import type { SupabaseClient } from "@supabase/supabase-js";
import { kommoCredentials } from "./client";
import { kommoStore, loadAccountSnapshot } from "./db";
import { parseCommercialFilters } from "./filters";
import { buildCommercialReport, reportGrain, seriesLabel } from "./metrics";
import { pageSales } from "./salesPage";
import { errorText, rpcMissing } from "./rpcError";
import type { CommercialFilters, CommercialReport, SaleRow, StatusKind } from "./types";

const INSTALL_NOTICE =
  "A leitura ainda percorre todos os negócios antes de filtrar. Execute supabase/kommo-relatorios.sql no SQL Editor para calcular os indicadores no banco.";

const UPDATE_NOTICE =
  "A consulta comercial no Supabase está desatualizada. Execute novamente supabase/kommo-relatorios.sql no SQL Editor. Até lá, a tela percorre todos os negócios e demora mais para abrir.";

const PUBLIC_READ_NOTICE =
  "O Supabase ainda não libera esta leitura para quem não entrou. Execute supabase/kommo-leitura-publica.sql no SQL Editor.";

type FastReport = {
  ok: true;
  report: CommercialReport;
  salesTotal: number;
};

type FastMiss = {
  ok: false;
  notice: string;
};

const KINDS = new Set<StatusKind>(["unsorted", "open", "won", "lost"]);

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numOrNull(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function kindOf(value: unknown): StatusKind {
  return typeof value === "string" && KINDS.has(value as StatusKind) ? (value as StatusKind) : "open";
}

function saleOf(value: unknown): SaleRow | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = num(row.id);
  if (!id) return null;
  return {
    id,
    name: typeof row.name === "string" && row.name ? row.name : `Negócio ${id}`,
    price: num(row.price),
    closedAt: typeof row.closedAt === "string" ? row.closedAt : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    pipelineName: typeof row.pipelineName === "string" ? row.pipelineName : "",
    statusName: typeof row.statusName === "string" ? row.statusName : "",
    userName: typeof row.userName === "string" && row.userName ? row.userName : "Sem responsável",
    url: typeof row.url === "string" ? row.url : "",
  };
}

function reportOf(payload: unknown, filters: CommercialFilters): FastReport | null {
  const body = asRecord(payload);
  const metrics = asRecord(body?.metrics);
  if (!body || !metrics) return null;
  const grain = body.grain === "day" || body.grain === "week" || body.grain === "month" ? body.grain : reportGrain(filters);
  const series = asArray(body.series).flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.key !== "string") return [];
    return [{
      key: row.key,
      label: seriesLabel(row.key, grain),
      leads: num(row.leads),
      sales: num(row.sales),
      revenue: num(row.revenue),
    }];
  });
  const sellers = asArray(body.sellers).flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.name !== "string") return [];
    const id = row.id == null ? null : num(row.id);
    return [{
      id: id || null,
      name: row.name,
      leads: num(row.leads),
      sales: num(row.sales),
      revenue: num(row.revenue),
      conversion: numOrNull(row.conversion),
    }];
  });
  const funnels = asArray(body.funnels).flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const stages = asArray(row.stages).flatMap((stage) => {
      const current = asRecord(stage);
      if (!current) return [];
      return [{
        statusId: num(current.statusId),
        name: typeof current.name === "string" ? current.name : "",
        kind: kindOf(current.kind),
        count: num(current.count),
        value: num(current.value),
      }];
    });
    return [{
      pipelineId: num(row.pipelineId),
      pipelineName: typeof row.pipelineName === "string" ? row.pipelineName : "",
      stages,
    }];
  });
  const sales = asArray(body.salesPreview).flatMap((item) => {
    const sale = saleOf(item);
    return sale ? [sale] : [];
  });
  return {
    ok: true,
    salesTotal: num(body.salesTotal),
    report: {
      metrics: {
        newLeads: num(metrics.newLeads),
        wonCount: num(metrics.wonCount),
        revenue: num(metrics.revenue),
        averageTicket: numOrNull(metrics.averageTicket),
        conversionPeriod: numOrNull(metrics.conversionPeriod),
        conversionCohort: numOrNull(metrics.conversionCohort),
        lostCount: num(metrics.lostCount),
        openCount: num(metrics.openCount),
        openValue: num(metrics.openValue),
        wonWithoutClose: num(metrics.wonWithoutClose),
      },
      grain,
      series,
      sellers,
      funnels,
      sales,
    },
  };
}

export async function queryCommercialReport(
  supabase: SupabaseClient,
  accountId: number,
  filters: CommercialFilters,
): Promise<FastReport | FastMiss> {
  const { data, error } = await supabase.rpc("kommo_commercial_report", {
    p_account_id: accountId,
    p_from: filters.from,
    p_to: filters.to,
    p_pipeline_id: filters.pipelineId,
    p_user_id: filters.userId,
    p_grain: reportGrain(filters),
  });
  if (error) {
    const text = errorText(error);
    const notice = rpcMissing(error)
      ? INSTALL_NOTICE
      : /permission denied|42501/i.test(text)
        ? PUBLIC_READ_NOTICE
        : /full join|0a000/i.test(text)
          ? UPDATE_NOTICE
          : INSTALL_NOTICE;
    return { ok: false, notice };
  }
  const parsed = reportOf(data, filters);
  if (!parsed) return { ok: false, notice: INSTALL_NOTICE };
  return parsed;
}

export async function queryCommercialSales(
  supabase: SupabaseClient,
  accountId: number,
  filters: CommercialFilters,
  query: string,
  page: number,
  pageSize: number,
): Promise<{ sales: SaleRow[]; salesTotal: number; matchTotal: number } | null> {
  const { data, error } = await supabase.rpc("kommo_commercial_sales", {
    p_account_id: accountId,
    p_from: filters.from,
    p_to: filters.to,
    p_pipeline_id: filters.pipelineId,
    p_user_id: filters.userId,
    p_query: query,
    p_limit: pageSize,
    p_offset: Math.max(0, page - 1) * pageSize,
  });
  if (error) return null;
  const body = asRecord(data);
  if (!body) return null;
  return {
    sales: asArray(body.sales).flatMap((item) => {
      const sale = saleOf(item);
      return sale ? [sale] : [];
    }),
    salesTotal: num(body.salesTotal),
    matchTotal: num(body.matchTotal),
  };
}

export async function loadFilterLists(supabase: SupabaseClient, accountId: number) {
  const [pipelines, users] = await Promise.all([
    supabase.from("kommo_pipelines").select("id,name,is_archive,sort").eq("account_id", accountId).limit(200),
    supabase.from("kommo_users").select("id,name").eq("account_id", accountId).order("name").limit(500),
  ]);
  if (pipelines.error) throw pipelines.error;
  if (users.error) throw users.error;
  return {
    pipelines: (pipelines.data || [])
      .filter((row) => !row.is_archive)
      .sort((a, b) => (a.sort || 0) - (b.sort || 0))
      .map((row) => ({ id: Number(row.id), name: String(row.name || "") })),
    users: (users.data || []).map((row) => ({ id: Number(row.id), name: String(row.name || "") })),
  };
}

export const AGGREGATE_NOTICE = INSTALL_NOTICE;

export async function loadPagedSales(
  supabase: SupabaseClient,
  search: URLSearchParams,
  fallbackSales: SaleRow[],
  aggregated: boolean,
  page: number,
  pageSize: number,
) {
  const query = (search.get("q") || "").trim().toLowerCase();
  if (!aggregated) return pageSales(fallbackSales, query, page, pageSize);
  const filters = parseCommercialFilters(search);
  const credentials = kommoCredentials();
  if ("error" in filters || !credentials) return pageSales(fallbackSales, query, page, pageSize);
  try {
    const state = await kommoStore(supabase).getState(credentials.subdomain);
    if (!state) return pageSales([], query, page, pageSize);
    const pageResult = await queryCommercialSales(supabase, state.accountId, filters, query, page, pageSize);
    if (pageResult) return { ...pageResult, page, pageSize };
    const snapshot = await loadAccountSnapshot(supabase, state.accountId);
    const report = buildCommercialReport(snapshot.leads, snapshot.stages, filters);
    return pageSales(report.sales, query, page, pageSize);
  } catch {
    return pageSales(fallbackSales, query, page, pageSize);
  }
}
