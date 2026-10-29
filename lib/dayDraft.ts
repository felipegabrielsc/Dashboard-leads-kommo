import type { DayRecord } from "./types";

const KEY = "leads-day-draft";

export type DayDraft = {
  open: true;
  day: DayRecord | null;
  originalDate: string;
  date: string;
  review: "ok" | "pendente";
  pendingCount: string;
  declared: string;
  counts: Record<string, string>;
  phones: string;
};

export function readDayDraft(): DayDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DayDraft>;
    if (parsed.open !== true || typeof parsed.date !== "string" || !parsed.counts || typeof parsed.counts !== "object") {
      return null;
    }
    return {
      open: true,
      day: parsed.day ?? null,
      originalDate: typeof parsed.originalDate === "string" ? parsed.originalDate : parsed.day?.date || "",
      date: parsed.date,
      review: parsed.review === "pendente" ? "pendente" : "ok",
      pendingCount: typeof parsed.pendingCount === "string" ? parsed.pendingCount : "",
      declared: typeof parsed.declared === "string" ? parsed.declared : "",
      counts: parsed.counts,
      phones: typeof parsed.phones === "string" ? parsed.phones : "",
    };
  } catch {
    return null;
  }
}

export function writeDayDraft(draft: DayDraft | null) {
  if (typeof window === "undefined") return;
  if (!draft) window.sessionStorage.removeItem(KEY);
  else window.sessionStorage.setItem(KEY, JSON.stringify(draft));
}
