"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { slugify } from "./categories";
import { seedState } from "./normalize";
import {
  deleteAnalysis as deleteAnalysisRemote,
  deleteCategory as deleteCategoryRemote,
  deleteDay as deleteDayRemote,
  fetchState,
  insertCategory,
  reconcileDay,
  renameCategory as renameCategoryRemote,
  saveAnalysis as saveAnalysisRemote,
  saveCell,
  saveDay as saveDayRemote,
  syncState,
} from "./remote";
import { createSupabaseBrowser, explainSupabaseError } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisLead, Category, DayRecord, GroupId, LeadState } from "./types";

export { normalizeState, seedState } from "./normalize";

type Action =
  | { type: "replace"; state: LeadState }
  | { type: "reset"; state: LeadState }
  | { type: "save-day"; day: DayRecord }
  | { type: "patch-cell"; date: string; categoryId: string; value: number }
  | { type: "delete-day"; date: string }
  | { type: "reconcile"; date: string }
  | { type: "add-category"; category: Category }
  | { type: "rename-category"; id: string; label: string }
  | { type: "delete-category"; id: string }
  | { type: "save-analysis"; lead: AnalysisLead }
  | { type: "delete-analysis"; id: string };

function sortDays(days: DayRecord[]): DayRecord[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
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
    case "add-category":
      return {
        ...state,
        categories: state.categories.some((category) => category.id === action.category.id)
          ? state.categories
          : [...state.categories, action.category],
      };
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
  configured: boolean;
  email: string | null;
  loadError: string;
  saveError: string;
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
  signOut: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seedState);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const clientRef = useRef<SupabaseClient | null>(null);
  const stateRef = useRef(state);
  const writes = useRef(0);
  stateRef.current = state;

  async function run(task: (client: SupabaseClient) => Promise<void>) {
    const client = clientRef.current;
    if (!client) return;
    writes.current += 1;
    try {
      await task(client);
      setSaveError("");
    } catch (error) {
      setSaveError(explainSupabaseError(error));
    } finally {
      writes.current -= 1;
    }
  }

  useEffect(() => {
    const client = createSupabaseBrowser();
    clientRef.current = client;
    if (!client) {
      setConfigured(false);
      setReady(true);
      return;
    }
    let cancel = false;
    async function load(active: SupabaseClient) {
      const { data } = await active.auth.getUser();
      if (cancel) return;
      setEmail(data.user?.email ?? null);
      let loaded = await fetchState(active);
      if (!loaded.days.length && !loaded.analysis.length && loaded.categories.every((category) => category.builtin)) {
        const seed = seedState();
        await syncState(active, seed);
        loaded = seed;
      }
      if (cancel) return;
      dispatch({ type: "replace", state: loaded });
      setReady(true);
    }
    load(client).catch((error) => {
      if (cancel) return;
      setLoadError(explainSupabaseError(error));
      setReady(true);
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    function onFocus() {
      const client = clientRef.current;
      if (!client || !ready || writes.current > 0) return;
      fetchState(client)
        .then((fresh) => {
          if (writes.current > 0) return;
          dispatch({ type: "replace", state: fresh });
        })
        .catch((error) => setSaveError(explainSupabaseError(error)));
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [ready]);

  const store: Store = {
    ready,
    configured,
    email,
    loadError,
    saveError,
    state,
    replace: (next) => {
      dispatch({ type: "replace", state: next });
      void run((client) => syncState(client, next));
    },
    reset: () => {
      const seed = seedState();
      dispatch({ type: "reset", state: seed });
      void run((client) => syncState(client, seed));
    },
    saveDay: (day) => {
      dispatch({ type: "save-day", day });
      void run((client) => saveDayRemote(client, day));
    },
    patchCell: (date, categoryId, value) => {
      dispatch({ type: "patch-cell", date, categoryId, value });
      void run((client) => saveCell(client, date, categoryId, value));
    },
    deleteDay: (date) => {
      dispatch({ type: "delete-day", date });
      void run((client) => deleteDayRemote(client, date));
    },
    reconcile: (date) => {
      dispatch({ type: "reconcile", date });
      void run((client) => reconcileDay(client, date));
    },
    addCategory: (label, group) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      let id = slugify(trimmed);
      let n = 2;
      while (stateRef.current.categories.some((category) => category.id === id)) {
        id = `${slugify(trimmed)}_${n++}`;
      }
      const category: Category = { id, label: trimmed, group, builtin: false };
      const position = stateRef.current.categories.length;
      dispatch({ type: "add-category", category });
      void run((client) => insertCategory(client, category, position));
    },
    renameCategory: (id, label) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      dispatch({ type: "rename-category", id, label: trimmed });
      void run((client) => renameCategoryRemote(client, id, trimmed));
    },
    deleteCategory: (id) => {
      const category = stateRef.current.categories.find((item) => item.id === id);
      if (!category || category.builtin) return;
      dispatch({ type: "delete-category", id });
      void run((client) => deleteCategoryRemote(client, id));
    },
    saveAnalysis: (lead) => {
      dispatch({ type: "save-analysis", lead });
      void run((client) => saveAnalysisRemote(client, lead));
    },
    deleteAnalysis: (id) => {
      dispatch({ type: "delete-analysis", id });
      void run((client) => deleteAnalysisRemote(client, id));
    },
    signOut: () => {
      void clientRef.current?.auth.signOut().finally(() => {
        window.location.assign("/login");
      });
    },
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useLeads(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useLeads precisa do StoreProvider");
  return store;
}
