import { GROUP_META, normalizeLabel, shortLabel } from "./categories";
import { weekdayIndex, monthKey } from "./format";
import { isDivergent } from "./metrics";
import type { AnalysisLead, Category, DayRecord, Filters, GroupId } from "./types";

export function defaultFilters(): Filters {
  return {
    from: "",
    to: "",
    months: [],
    weekdays: [],
    review: "todos",
    divergence: "todos",
    groups: [],
    motives: [],
    query: "",
  };
}

export function isSlice(filters: Filters): boolean {
  return filters.groups.length > 0 || filters.motives.length > 0;
}

export function motiveFilterCategories(categories: Category[]): Category[] {
  return categories.filter((category) => {
    const groupLabel = normalizeLabel(GROUP_META[category.group].label);
    return normalizeLabel(shortLabel(category)) !== groupLabel;
  });
}

export function visibleCategories(categories: Category[], filters: Filters): Category[] {
  return categories.filter((category) => {
    const groupOk = filters.groups.length === 0 || filters.groups.includes(category.group);
    const motiveOk = filters.motives.length === 0 || filters.motives.includes(category.id);
    return groupOk && motiveOk;
  });
}

function textMatch(value: string, query: string): boolean {
  return value.toLowerCase().includes(query);
}

export function leadMatches(lead: AnalysisLead, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  const phone = lead.phone.replace(/\D/g, "");
  return (
    textMatch(lead.phone, q) ||
    textMatch(lead.description, q) ||
    textMatch(lead.date, q) ||
    (digits.length >= 3 && phone.includes(digits))
  );
}

function inPeriod(iso: string, filters: Filters): boolean {
  const hasPeriod = Boolean(filters.from || filters.to || filters.months.length || filters.weekdays.length);
  if (!iso) return !hasPeriod;
  if (filters.from && iso < filters.from) return false;
  if (filters.to && iso > filters.to) return false;
  if (filters.months.length && !filters.months.includes(monthKey(iso))) return false;
  if (filters.weekdays.length && !filters.weekdays.includes(weekdayIndex(iso))) return false;
  return true;
}

export function filterDays(
  days: DayRecord[],
  analysis: AnalysisLead[],
  filters: Filters,
): DayRecord[] {
  const query = filters.query.trim().toLowerCase();
  return days.filter((day) => {
    if (!inPeriod(day.date, filters)) return false;
    if (filters.review === "ok" && day.review !== "ok") return false;
    if (filters.review === "pendente" && day.review !== "pendente") return false;
    if (filters.divergence === "somente" && !isDivergent(day)) return false;
    if (!query) return true;
    if (day.date.includes(query)) return true;
    const formatted = day.date.split("-").reverse().join("/");
    if (formatted.includes(query)) return true;
    if (query === "pendente" && day.review === "pendente") return true;
    if ((query === "conferido" || query === "ok") && day.review === "ok") return true;
    return analysis.some((lead) => lead.date === day.date && leadMatches(lead, query));
  });
}

export function filterAnalysis(
  analysis: AnalysisLead[],
  days: DayRecord[],
  filters: Filters,
): AnalysisLead[] {
  const allowedDates =
    filters.review === "todos" && filters.divergence === "todos"
      ? null
      : new Set(filterDays(days, analysis, { ...filters, query: "" }).map((day) => day.date));

  return analysis.filter((lead) => {
    if (!inPeriod(lead.date, filters)) return false;
    if (allowedDates && !allowedDates.has(lead.date)) return false;
    return leadMatches(lead, filters.query);
  });
}

export function toggleList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function activeFilterCount(filters: Filters): number {
  let count = 0;
  if (filters.from || filters.to) count += 1;
  count += filters.months.length;
  count += filters.weekdays.length;
  if (filters.review !== "todos") count += 1;
  if (filters.divergence !== "somente" && filters.divergence !== "todos") count += 1;
  if (filters.divergence === "somente") count += 1;
  count += filters.groups.length;
  count += filters.motives.length;
  if (filters.query.trim()) count += 1;
  return count;
}

export function groupLabel(group: GroupId): string {
  if (group === "interesse") return "Interessados";
  if (group === "sem_retorno") return "Sem retorno";
  return "Perdidos";
}
