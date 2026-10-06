import { NON_COMMERCIAL_IDS, PURCHASE_ID, categoryValue, sumCategories } from "./categories";
import { formatDate, formatMonth, monthKey, weekStart } from "./format";
import type { AnalysisLead, Category, DayRecord, GroupId } from "./types";

export type Totals = {
  byCategory: Record<string, number>;
  interesse: number;
  comprou: number;
  semRetorno: number;
  perdidos: number;
  outros: number;
  curriculo: number;
  engano: number;
  classified: number;
  analysis: number;
  totalGeral: number;
  taxaInteresse: number;
  taxaComercial: number;
  conversao: number;
  days: number;
  pendingDays: number;
  divergentDays: number;
  avgPerDay: number;
  busiest: { date: string; total: number } | null;
};

export function isDivergent(day: DayRecord): boolean {
  if (day.declaredQuantity == null) return false;
  const classified = Object.values(day.counts).reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
  return day.declaredQuantity !== classified;
}

export function emptyTotals(analysis = 0): Totals {
  return {
    byCategory: {},
    interesse: 0,
    comprou: 0,
    semRetorno: 0,
    perdidos: 0,
    outros: 0,
    curriculo: 0,
    engano: 0,
    classified: 0,
    analysis,
    totalGeral: analysis,
    taxaInteresse: 0,
    taxaComercial: 0,
    conversao: 0,
    days: 0,
    pendingDays: 0,
    divergentDays: 0,
    avgPerDay: 0,
    busiest: null,
  };
}

function rate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return part / whole;
}

/**
 * Mesma leitura da aba Dashboard da planilha:
 * interessados = sem resposta + compra futura (e motivos novos do grupo, exceto Comprou)
 * total geral = interessados + comprou + perdidos + sem retorno + em análise
 * taxa = (interessados + comprou) / total geral
 */
export function computeTotals(
  days: DayRecord[],
  analysisCount: number,
  categories: Category[],
): Totals {
  const byCategory: Record<string, number> = {};
  for (const category of categories) byCategory[category.id] = 0;

  let pendingDays = 0;
  let divergentDays = 0;
  let busiest: { date: string; total: number } | null = null;

  for (const day of days) {
    if (day.review === "pendente") pendingDays += 1;
    if (isDivergent(day)) divergentDays += 1;
    let dayTotal = 0;
    for (const category of categories) {
      const value = categoryValue(day.counts, category.id);
      byCategory[category.id] += value;
      dayTotal += value;
    }
    if (!busiest || dayTotal > busiest.total) busiest = { date: day.date, total: dayTotal };
  }

  const sumGroup = (group: GroupId, exclude = new Set<string>()) =>
    categories.reduce((total, category) => {
      if (category.group !== group || exclude.has(category.id)) return total;
      return total + (byCategory[category.id] || 0);
    }, 0);

  const comprou = byCategory[PURCHASE_ID] || 0;
  const interesse = sumGroup("interesse", new Set([PURCHASE_ID]));
  const semRetorno = sumGroup("sem_retorno");
  const perdidos = sumGroup("perdidos");
  const classified = interesse + comprou + semRetorno + perdidos;
  const totalGeral = classified + analysisCount;
  const nonCommercial = NON_COMMERCIAL_IDS.reduce(
    (total, id) => total + (byCategory[id] || 0),
    0,
  );
  const interestedPool = interesse + comprou;

  return {
    byCategory,
    interesse,
    comprou,
    semRetorno,
    perdidos,
    outros: byCategory.outros || 0,
    curriculo: byCategory.curriculo || 0,
    engano: byCategory.engano || 0,
    classified,
    analysis: analysisCount,
    totalGeral,
    taxaInteresse: rate(interestedPool, totalGeral),
    taxaComercial: rate(interestedPool, totalGeral - nonCommercial),
    conversao: rate(comprou, interestedPool),
    days: days.length,
    pendingDays,
    divergentDays,
    avgPerDay: days.length ? classified / days.length : 0,
    busiest: busiest && busiest.total > 0 ? busiest : null,
  };
}

export type MonthRow = Totals & { month: string; label: string };

export function buildMonthRows(
  days: DayRecord[],
  analysis: AnalysisLead[],
  categories: Category[],
): MonthRow[] {
  const months = new Set<string>();
  for (const day of days) months.add(monthKey(day.date));
  for (const lead of analysis) if (lead.date) months.add(monthKey(lead.date));

  return [...months].sort().map((month) => {
    const monthDays = days.filter((day) => monthKey(day.date) === month);
    const monthAnalysis = analysis.filter((lead) => monthKey(lead.date) === month).length;
    return {
      month,
      label: formatMonth(month),
      ...computeTotals(monthDays, monthAnalysis, categories),
    };
  });
}

export type Bucket = {
  key: string;
  label: string;
  interesse: number;
  comprou: number;
  semRetorno: number;
  perdidos: number;
  total: number;
};

export function buildBuckets(days: DayRecord[], categories: Category[]): Bucket[] {
  const span =
    days.length < 2
      ? days.length
      : Math.round(
          (Date.parse(days[days.length - 1]?.date || days[0].date) -
            Date.parse(days[0].date)) /
            86400000,
        ) + 1;
  const mode: "day" | "week" | "month" = span <= 45 ? "day" : span <= 150 ? "week" : "month";
  const buckets = new Map<string, Bucket>();

  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of ordered) {
    const key =
      mode === "day" ? day.date : mode === "week" ? weekStart(day.date) : monthKey(day.date);
    const label =
      mode === "month" ? formatMonth(key).replace(/ de /, " ") : formatDate(key).slice(0, 5);
    const bucket = buckets.get(key) || {
      key,
      label,
      interesse: 0,
      comprou: 0,
      semRetorno: 0,
      perdidos: 0,
      total: 0,
    };
    for (const category of categories) {
      const value = categoryValue(day.counts, category.id);
      if (category.id === PURCHASE_ID) bucket.comprou += value;
      else if (category.group === "interesse") bucket.interesse += value;
      else if (category.group === "sem_retorno") bucket.semRetorno += value;
      else bucket.perdidos += value;
      bucket.total += value;
    }
    buckets.set(key, bucket);
  }
  return [...buckets.values()];
}

export function topMotives(
  totals: Totals,
  categories: Category[],
  group?: GroupId,
): { id: string; label: string; value: number; group: GroupId }[] {
  return categories
    .filter((category) => (group ? category.group === group : true))
    .map((category) => ({
      id: category.id,
      label: category.label,
      group: category.group,
      value: totals.byCategory[category.id] || 0,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function weekdayLoads(days: DayRecord[], categories: Category[]): number[] {
  const loads = [0, 0, 0, 0, 0, 0, 0];
  for (const day of days) {
    const [year, month, date] = day.date.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
    loads[weekday] += sumCategories(day.counts, categories);
  }
  return loads;
}
