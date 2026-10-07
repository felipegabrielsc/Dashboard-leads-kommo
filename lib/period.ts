import { addDays, monthBounds, weekdayIndex } from "./format";
import type { Filters } from "./types";

export type DateWindow = { from: string; to: string };

export function inclusiveDays(from: string, to: string): number {
  const span = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(span / 86400000) + 1;
}

export function activeWindow(filters: Filters, dates: string[], today: string): DateWindow | null {
  const sorted = dates.filter(Boolean).sort();
  if (filters.from || filters.to) {
    const from = filters.from || sorted[0] || "";
    const to = filters.to || today;
    if (!from || !to || from > to) return null;
    return { from, to };
  }
  if (filters.months.length) {
    const months = [...filters.months].sort();
    return { from: `${months[0]}-01`, to: monthBounds(months[months.length - 1]).to };
  }
  if (!sorted.length) return null;
  return { from: sorted[0], to: sorted[sorted.length - 1] };
}

export function previousWindow(window: DateWindow): DateWindow {
  const length = Math.max(1, inclusiveDays(window.from, window.to));
  const to = addDays(window.from, -1);
  return { from: addDays(to, -(length - 1)), to };
}

export function windowHasDate(dates: string[], window: DateWindow): boolean {
  return dates.some((date) => date >= window.from && date <= window.to);
}

/** Dias de segunda a sexta, até hoje, que não têm linha na grade. */
export function missingBusinessDays(recorded: Iterable<string>, window: DateWindow, today: string): string[] {
  if (!window.from || !window.to || window.from > window.to) return [];
  const end = window.to < today ? window.to : today;
  if (window.from > end) return [];
  const has = new Set(recorded);
  const missing: string[] = [];
  let cursor = window.from;
  for (let guard = 0; cursor <= end && guard < 800; guard += 1) {
    const weekday = weekdayIndex(cursor);
    if (weekday !== 0 && weekday !== 6 && !has.has(cursor)) missing.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return missing;
}
