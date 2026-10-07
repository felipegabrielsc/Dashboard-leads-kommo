import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeState } from "./normalize";
import type { AnalysisLead, Category, DayRecord, LeadState } from "./types";

type CategoryRow = {
  id: string;
  label: string;
  group_id: Category["group"];
  builtin: boolean;
  position: number;
};

type DayRow = {
  day: string;
  review: DayRecord["review"];
  pending_count: number;
  declared_quantity: number | null;
};

type CountRow = {
  day: string;
  category_id: string;
  value: number;
};

type AnalysisRow = {
  id: string;
  phone: string;
  day: string | null;
  description: string;
};

function isoDay(value: string | null): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function quotedList(values: string[]): string {
  return `(${values.map((value) => `"${value.replaceAll('"', "")}"`).join(",")})`;
}

export async function fetchState(client: SupabaseClient): Promise<LeadState> {
  const [categories, days, counts, analysis] = await Promise.all([
    client.from("categories").select("id,label,group_id,builtin,position").order("position"),
    client.from("days").select("day,review,pending_count,declared_quantity").order("day"),
    client.from("day_counts").select("day,category_id,value"),
    client.from("analysis_leads").select("id,phone,day,description"),
  ]);
  throwIf(categories.error);
  throwIf(days.error);
  throwIf(counts.error);
  throwIf(analysis.error);

  const byDay = new Map<string, Record<string, number>>();
  for (const row of (counts.data || []) as CountRow[]) {
    const date = isoDay(row.day);
    const countsForDay = byDay.get(date) || {};
    countsForDay[row.category_id] = row.value;
    byDay.set(date, countsForDay);
  }

  const storedIds = new Set(((categories.data || []) as CategoryRow[]).map((row) => row.id));
  const state = normalizeState({
    version: 1,
    categories: ((categories.data || []) as CategoryRow[]).map((row) => ({
      id: row.id,
      label: row.label,
      group: row.group_id,
      builtin: row.builtin,
    })),
    days: ((days.data || []) as DayRow[]).map((row) => ({
      date: isoDay(row.day),
      review: row.review,
      pendingCount: row.pending_count,
      declaredQuantity: row.declared_quantity,
      counts: byDay.get(isoDay(row.day)) || {},
    })),
    analysis: ((analysis.data || []) as AnalysisRow[]).map((row) => ({
      id: row.id,
      phone: row.phone,
      date: isoDay(row.day),
      description: row.description,
    })),
  });
  if (!state) throw new Error("O banco devolveu um formato que a dashboard não reconhece.");
  const missing = state.categories.filter((category) => category.builtin && !storedIds.has(category.id));
  if (missing.length) {
    throwIf(
      (
        await client.from("categories").upsert(
          missing.map((category, index) => ({
            id: category.id,
            label: category.label,
            group_id: category.group,
            builtin: true,
            position: state.categories.length + index,
          })),
        )
      ).error,
    );
  }
  return state;
}

function categoryRows(state: LeadState) {
  return state.categories.map((category, position) => ({
    id: category.id,
    label: category.label,
    group_id: category.group,
    builtin: Boolean(category.builtin),
    position,
  }));
}

function countRows(state: LeadState) {
  const rows: CountRow[] = [];
  for (const day of state.days) {
    for (const [categoryId, value] of Object.entries(day.counts)) {
      if (value > 0) rows.push({ day: day.date, category_id: categoryId, value });
    }
  }
  return rows;
}

export async function syncState(client: SupabaseClient, state: LeadState) {
  throwIf((await client.from("categories").upsert(categoryRows(state))).error);

  if (state.days.length) {
    throwIf(
      (
        await client.from("days").upsert(
          state.days.map((day) => ({
            day: day.date,
            review: day.review,
            pending_count: day.pendingCount,
            declared_quantity: day.declaredQuantity,
          })),
        )
      ).error,
    );
  }

  const dates = state.days.map((day) => day.date);
  if (dates.length) {
    throwIf((await client.from("days").delete().not("day", "in", quotedList(dates))).error);
    throwIf((await client.from("day_counts").delete().in("day", dates)).error);
  } else {
    throwIf((await client.from("days").delete().gte("day", "1970-01-01")).error);
  }

  const counts = countRows(state);
  if (counts.length) throwIf((await client.from("day_counts").insert(counts)).error);

  const categoryIds = state.categories.map((category) => category.id);
  if (categoryIds.length) {
    throwIf((await client.from("categories").delete().not("id", "in", quotedList(categoryIds))).error);
  }

  if (state.analysis.length) {
    throwIf(
      (
        await client.from("analysis_leads").upsert(
          state.analysis.map((lead) => ({
            id: lead.id,
            phone: lead.phone,
            day: lead.date || null,
            description: lead.description,
          })),
        )
      ).error,
    );
  }
  const leadIds = state.analysis.map((lead) => lead.id);
  if (leadIds.length) {
    throwIf((await client.from("analysis_leads").delete().not("id", "in", quotedList(leadIds))).error);
  } else {
    throwIf((await client.from("analysis_leads").delete().neq("id", "")).error);
  }
}

export async function saveDay(client: SupabaseClient, day: DayRecord) {
  throwIf(
    (
      await client.from("days").upsert({
        day: day.date,
        review: day.review,
        pending_count: day.pendingCount,
        declared_quantity: day.declaredQuantity,
      })
    ).error,
  );
  throwIf((await client.from("day_counts").delete().eq("day", day.date)).error);
  const rows = Object.entries(day.counts)
    .filter(([, value]) => value > 0)
    .map(([categoryId, value]) => ({ day: day.date, category_id: categoryId, value }));
  if (rows.length) throwIf((await client.from("day_counts").insert(rows)).error);
}

export async function saveCell(client: SupabaseClient, date: string, categoryId: string, value: number) {
  if (value <= 0) {
    throwIf((await client.from("day_counts").delete().eq("day", date).eq("category_id", categoryId)).error);
    return;
  }
  throwIf(
    (await client.from("day_counts").upsert({ day: date, category_id: categoryId, value })).error,
  );
}

export async function deleteDay(client: SupabaseClient, date: string) {
  throwIf((await client.from("days").delete().eq("day", date)).error);
}

export async function reconcileDay(client: SupabaseClient, date: string) {
  throwIf((await client.from("days").update({ declared_quantity: null }).eq("day", date)).error);
}

export async function insertCategory(client: SupabaseClient, category: Category, position: number) {
  throwIf(
    (
      await client.from("categories").insert({
        id: category.id,
        label: category.label,
        group_id: category.group,
        builtin: false,
        position,
      })
    ).error,
  );
}

export async function renameCategory(client: SupabaseClient, id: string, label: string) {
  throwIf((await client.from("categories").update({ label }).eq("id", id)).error);
}

export async function deleteCategory(client: SupabaseClient, id: string) {
  throwIf((await client.from("categories").delete().eq("id", id)).error);
}

export async function saveAnalysis(client: SupabaseClient, lead: AnalysisLead) {
  throwIf(
    (
      await client.from("analysis_leads").upsert({
        id: lead.id,
        phone: lead.phone,
        day: lead.date || null,
        description: lead.description,
      })
    ).error,
  );
}

export async function deleteAnalysis(client: SupabaseClient, id: string) {
  throwIf((await client.from("analysis_leads").delete().eq("id", id)).error);
}
