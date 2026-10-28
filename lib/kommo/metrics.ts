import { formatMonth, monthKey, weekStart } from "../format";
import type { CommercialFilters, CommercialLead, CommercialReport, SaleRow, Stage, StatusKind } from "./types";

const ZONE = "America/Sao_Paulo";

export function dayInSaoPaulo(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function inPeriod(iso: string | null, filters: CommercialFilters): boolean {
  const day = dayInSaoPaulo(iso);
  return Boolean(day && day >= filters.from && day <= filters.to);
}

function scoped(lead: CommercialLead, filters: CommercialFilters): boolean {
  if (lead.isDeleted) return false;
  if (filters.pipelineId && lead.pipelineId !== filters.pipelineId) return false;
  if (filters.userId && lead.userId !== filters.userId) return false;
  return true;
}

function dedupe(leads: CommercialLead[]): CommercialLead[] {
  const byId = new Map<number, CommercialLead>();
  for (const lead of leads) {
    const current = byId.get(lead.id);
    if (!current) {
      byId.set(lead.id, lead);
      continue;
    }
    const currentStamp = current.updatedAt || "";
    const nextStamp = lead.updatedAt || "";
    if (nextStamp >= currentStamp) byId.set(lead.id, lead);
  }
  return [...byId.values()];
}

function inclusiveDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

export function reportGrain(filters: CommercialFilters): CommercialReport["grain"] {
  const days = inclusiveDays(filters.from, filters.to);
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

function bucketKey(day: string, grain: CommercialReport["grain"]): string {
  if (grain === "month") return monthKey(day);
  if (grain === "week") return weekStart(day);
  return day;
}

function bucketLabel(key: string, grain: CommercialReport["grain"]): string {
  if (grain === "month") return formatMonth(key);
  const [, month, day] = key.split("-");
  return `${day}/${month}`;
}

function ratio(part: number, total: number): number | null {
  if (!total) return null;
  return part / total;
}

function emptyBucket(key: string, grain: CommercialReport["grain"]) {
  return { key, label: bucketLabel(key, grain), leads: 0, sales: 0, revenue: 0 };
}

export function buildCommercialReport(
  input: CommercialLead[],
  stages: Stage[],
  filters: CommercialFilters,
): CommercialReport {
  const leads = dedupe(input).filter((lead) => scoped(lead, filters));
  const grain = reportGrain(filters);
  const created = leads.filter((lead) => inPeriod(lead.createdAt, filters));
  const won = leads.filter((lead) => lead.statusKind === "won" && inPeriod(lead.closedAt, filters));
  const lost = leads.filter((lead) => lead.statusKind === "lost" && inPeriod(lead.closedAt, filters));
  const cohortWon = created.filter((lead) => lead.statusKind === "won");
  const open = leads.filter((lead) => lead.statusKind === "open");
  const revenue = won.reduce((sum, lead) => sum + lead.price, 0);
  const wonWithoutClose = leads.filter((lead) => lead.statusKind === "won" && !lead.closedAt).length;

  const series = new Map<string, ReturnType<typeof emptyBucket>>();
  function bucket(day: string | null) {
    if (!day || day < filters.from || day > filters.to) return null;
    const key = bucketKey(day, grain);
    const current = series.get(key);
    if (current) return current;
    const createdBucket = emptyBucket(key, grain);
    series.set(key, createdBucket);
    return createdBucket;
  }
  for (const lead of created) {
    const row = bucket(dayInSaoPaulo(lead.createdAt));
    if (row) row.leads += 1;
  }
  for (const lead of won) {
    const row = bucket(dayInSaoPaulo(lead.closedAt));
    if (!row) continue;
    row.sales += 1;
    row.revenue += lead.price;
  }

  const sellers = new Map<string, CommercialReport["sellers"][number]>();
  function seller(id: number | null, name: string) {
    const key = id == null ? "none" : String(id);
    const current = sellers.get(key);
    if (current) return current;
    const createdSeller = { id, name: name || "Sem responsável", leads: 0, sales: 0, revenue: 0, conversion: null };
    sellers.set(key, createdSeller);
    return createdSeller;
  }
  for (const lead of created) seller(lead.userId, lead.userName).leads += 1;
  for (const lead of won) {
    const row = seller(lead.userId, lead.userName);
    row.sales += 1;
    row.revenue += lead.price;
  }
  for (const row of sellers.values()) row.conversion = ratio(row.sales, row.leads);

  const visibleStages = stages
    .filter((stage) => !filters.pipelineId || stage.pipelineId === filters.pipelineId)
    .sort((a, b) => a.pipelineName.localeCompare(b.pipelineName, "pt-BR") || a.sort - b.sort || a.statusId - b.statusId);
  const funnels = new Map<number, CommercialReport["funnels"][number]>();
  for (const stage of visibleStages) {
    const funnel = funnels.get(stage.pipelineId) || {
      pipelineId: stage.pipelineId,
      pipelineName: stage.pipelineName,
      stages: [],
    };
    funnel.stages.push({ statusId: stage.statusId, name: stage.name, kind: stage.kind, count: 0, value: 0 });
    funnels.set(stage.pipelineId, funnel);
  }
  for (const lead of leads) {
    if (!lead.pipelineId || !lead.statusId) continue;
    const funnel = funnels.get(lead.pipelineId);
    const stage = funnel?.stages.find((item) => item.statusId === lead.statusId);
    if (!stage) continue;
    stage.count += 1;
    stage.value += lead.price;
  }

  const sales: SaleRow[] = won
    .map((lead) => ({
      id: lead.id,
      name: lead.name,
      price: lead.price,
      closedAt: lead.closedAt,
      createdAt: lead.createdAt,
      pipelineName: stages.find((stage) => stage.pipelineId === lead.pipelineId)?.pipelineName || "",
      statusName: lead.statusName,
      userName: lead.userName || "Sem responsável",
      url: lead.url,
    }))
    .sort((a, b) => (b.closedAt || "").localeCompare(a.closedAt || "") || b.id - a.id);

  return {
    metrics: {
      newLeads: created.length,
      wonCount: won.length,
      revenue,
      averageTicket: won.length ? revenue / won.length : null,
      conversionPeriod: ratio(won.length, created.length),
      conversionCohort: ratio(cohortWon.length, created.length),
      lostCount: lost.length,
      openCount: open.length,
      openValue: open.reduce((sum, lead) => sum + lead.price, 0),
      wonWithoutClose,
    },
    grain,
    series: [...series.values()].sort((a, b) => a.key.localeCompare(b.key)),
    sellers: [...sellers.values()].sort((a, b) => b.revenue - a.revenue || b.sales - a.sales || a.name.localeCompare(b.name, "pt-BR")),
    funnels: [...funnels.values()],
    sales,
  };
}

export function kindLabel(kind: StatusKind): string {
  if (kind === "won") return "Ganho";
  if (kind === "lost") return "Perdido";
  if (kind === "unsorted") return "Triagem";
  return "Aberto";
}
