import seedJson from "../data/seed.json";
import { withBuiltins } from "./categories";
import type { AnalysisLead, Category, DayRecord, LeadState } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function normalizeState(raw: unknown): LeadState | null {
  const record = asRecord(raw);
  if (!record) return null;
  const categoriesRaw = Array.isArray(record.categories) ? record.categories : [];
  const categories: Category[] = [];
  for (const item of categoriesRaw) {
    const category = asRecord(item);
    if (!category) continue;
    const id = typeof category.id === "string" ? category.id : "";
    const label = typeof category.label === "string" ? category.label.trim() : "";
    const group = category.group;
    if (!id || !label) continue;
    if (group !== "interesse" && group !== "sem_retorno" && group !== "perdidos") continue;
    categories.push({
      id,
      label,
      group,
      builtin: Boolean(category.builtin),
    });
  }
  const daysRaw = Array.isArray(record.days) ? record.days : [];
  const days: DayRecord[] = [];
  for (const item of daysRaw) {
    const day = asRecord(item);
    if (!day || typeof day.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) continue;
    const counts: Record<string, number> = {};
    const source = asRecord(day.counts) || {};
    for (const [key, value] of Object.entries(source)) {
      const number = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(number)) counts[key] = Math.max(0, Math.round(number));
    }
    const declared = day.declaredQuantity;
    days.push({
      date: day.date,
      review: day.review === "pendente" ? "pendente" : "ok",
      pendingCount:
        day.review === "pendente" ? Math.max(1, Math.round(Number(day.pendingCount) || 1)) : 0,
      declaredQuantity:
        typeof declared === "number" && Number.isFinite(declared) ? Math.round(declared) : null,
      counts,
    });
  }
  const analysisRaw = Array.isArray(record.analysis) ? record.analysis : [];
  const analysis: AnalysisLead[] = [];
  for (const item of analysisRaw) {
    const lead = asRecord(item);
    if (!lead) continue;
    const phone = typeof lead.phone === "string" ? lead.phone.trim() : String(lead.phone ?? "").trim();
    if (!phone) continue;
    analysis.push({
      id: typeof lead.id === "string" && lead.id ? lead.id : `analise-${crypto.randomUUID()}`,
      phone,
      date: typeof lead.date === "string" ? lead.date : "",
      description: typeof lead.description === "string" ? lead.description : "",
    });
  }
  return {
    version: 1,
    categories: withBuiltins(categories),
    days: [...days].sort((a, b) => a.date.localeCompare(b.date)),
    analysis,
  };
}

export function seedState(): LeadState {
  const state = normalizeState(seedJson);
  if (!state) throw new Error("A base inicial da planilha está inválida.");
  return state;
}
