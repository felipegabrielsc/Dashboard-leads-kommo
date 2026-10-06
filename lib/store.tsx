"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import seedJson from "../data/seed.json";
import { slugify, withBuiltins } from "./categories";
import type { AnalysisLead, Category, DayRecord, GroupId, LeadState } from "./types";

const STORAGE_KEY = "kommo-leads-v1";

type Action =
  | { type: "replace"; state: LeadState }
  | { type: "reset"; state: LeadState }
  | { type: "save-day"; day: DayRecord }
  | { type: "patch-cell"; date: string; categoryId: string; value: number }
  | { type: "delete-day"; date: string }
  | { type: "reconcile"; date: string }
  | { type: "add-category"; label: string; group: GroupId }
  | { type: "rename-category"; id: string; label: string }
  | { type: "delete-category"; id: string }
  | { type: "save-analysis"; lead: AnalysisLead }
  | { type: "delete-analysis"; id: string };

function sortDays(days: DayRecord[]): DayRecord[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

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
        day.review === "pendente"
          ? Math.max(1, Math.round(Number(day.pendingCount) || 1))
          : 0,
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
    days: sortDays(days),
    analysis,
  };
}

export function seedState(): LeadState {
  const state = normalizeState(seedJson);
  if (!state) throw new Error("A base inicial da planilha está inválida.");
  return state;
}

function reducer(state: LeadState, action: Action): LeadState {
  switch (action.type) {
    case "replace":
    case "reset":
      return action.state;
    case "save-day": {
      const exists = state.days.some((day) => day.date === action.day.date);
      const days = exists
        ? state.days.map((day) => (day.date === action.day.date ? action.day : day))
        : sortDays([...state.days, action.day]);
      return { ...state, days };
    }
    case "patch-cell":
      return {
        ...state,
        days: state.days.map((day) =>
          day.date === action.date
            ? { ...day, counts: { ...day.counts, [action.categoryId]: action.value } }
            : day,
        ),
      };
    case "delete-day":
      return { ...state, days: state.days.filter((day) => day.date !== action.date) };
    case "reconcile":
      return {
        ...state,
        days: state.days.map((day) =>
          day.date === action.date ? { ...day, declaredQuantity: null } : day,
        ),
      };
    case "add-category": {
      const label = action.label.trim();
      if (!label) return state;
      let id = slugify(label);
      let n = 2;
      while (state.categories.some((category) => category.id === id)) {
        id = `${slugify(label)}_${n++}`;
      }
      return {
        ...state,
        categories: [...state.categories, { id, label, group: action.group, builtin: false }],
      };
    }
    case "rename-category":
      return {
        ...state,
        categories: state.categories.map((category) =>
          category.id === action.id ? { ...category, label: action.label.trim() || category.label } : category,
        ),
      };
    case "delete-category":
      return {
        ...state,
        categories: state.categories.filter(
          (category) => category.builtin || category.id !== action.id,
        ),
        days: state.days.map((day) => {
          if (state.categories.find((category) => category.id === action.id)?.builtin) return day;
          const counts = { ...day.counts };
          delete counts[action.id];
          return { ...day, counts };
        }),
      };
    case "save-analysis": {
      const exists = state.analysis.some((lead) => lead.id === action.lead.id);
      return {
        ...state,
        analysis: exists
          ? state.analysis.map((lead) => (lead.id === action.lead.id ? action.lead : lead))
          : [...state.analysis, action.lead],
      };
    }
    case "delete-analysis":
      return { ...state, analysis: state.analysis.filter((lead) => lead.id !== action.id) };
    default:
      return state;
  }
}

type Store = {
  ready: boolean;
  state: LeadState;
  replace: (state: LeadState) => void;
  reset: () => void;
  saveDay: (day: DayRecord) => void;
  patchCell: (date: string, categoryId: string, value: number) => void;
  deleteDay: (date: string) => void;
  reconcile: (date: string) => void;
  addCategory: (label: string, group: GroupId) => void;
  renameCategory: (id: string, label: string) => void;
  deleteCategory: (id: string) => void;
  saveAnalysis: (lead: AnalysisLead) => void;
  deleteAnalysis: (id: string) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seedState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = normalizeState(JSON.parse(raw));
        if (parsed) dispatch({ type: "replace", state: parsed });
      }
    } catch {
      /* mantém a planilha inicial */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [ready, state]);

  const store: Store = {
    ready,
    state,
    replace: (next) => dispatch({ type: "replace", state: next }),
    reset: () => dispatch({ type: "reset", state: seedState() }),
    saveDay: (day) => dispatch({ type: "save-day", day }),
    patchCell: (date, categoryId, value) => dispatch({ type: "patch-cell", date, categoryId, value }),
    deleteDay: (date) => dispatch({ type: "delete-day", date }),
    reconcile: (date) => dispatch({ type: "reconcile", date }),
    addCategory: (label, group) => dispatch({ type: "add-category", label, group }),
    renameCategory: (id, label) => dispatch({ type: "rename-category", id, label }),
    deleteCategory: (id) => dispatch({ type: "delete-category", id }),
    saveAnalysis: (lead) => dispatch({ type: "save-analysis", lead }),
    deleteAnalysis: (id) => dispatch({ type: "delete-analysis", id }),
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useLeads(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useLeads precisa do StoreProvider");
  return store;
}
