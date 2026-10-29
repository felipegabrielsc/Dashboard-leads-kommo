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
import { readDayDraft } from "./dayDraft";
import { formatDate } from "./format";
import { seedState } from "./normalize";
import {
  deleteAnalysis as deleteAnalysisRemote,
  deleteCategory as deleteCategoryRemote,
  deleteDay as deleteDayRemote,
  deleteQuote as deleteQuoteRemote,
  fetchChanges,
  fetchCatalogProfile,
  fetchQuotes,
  fetchState,
  insertCategory,
  reconcileDay,
  recordChange,
  renameCategory as renameCategoryRemote,
  saveAnalysis as saveAnalysisRemote,
  saveCatalogProfile as saveCatalogProfileRemote,
  saveCell,
  saveDay as saveDayRemote,
  syncState,
  upsertQuotes,
} from "./remote";
import { mergeQuotes, type Quote } from "./quotes";
import { createSupabaseBrowser, explainHistoryError, explainQuotesError, explainSupabaseError } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyCatalogIdentity, type AnalysisLead, type CatalogIdentity, type Category, type ChangeEntry, type DayRecord, type GroupId, type LeadState } from "./types";

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
  canEdit: boolean;
  loadError: string;
  saveError: string;
  changes: ChangeEntry[];
  historyError: string;
  quotes: Quote[];
  quotesError: string;
  catalogProfile: CatalogIdentity;
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
  importQuotes: (quotes: Quote[]) => void;
  deleteQuote: (id: string) => void;
  saveCatalogProfile: (profile: CatalogIdentity) => void;
  signOut: () => void;
};

function sameCounts(left: Record<string, number>, right: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] || 0) !== (right[key] || 0)) return false;
  }
  return true;
}

function daySummary(previous: DayRecord | undefined, day: DayRecord): string {
  const label = formatDate(day.date);
  if (!previous) return `Lançou ${label}.`;
  if (previous.review !== day.review && sameCounts(previous.counts, day.counts)) {
    return day.review === "ok" ? `Marcou ${label} como conferido.` : `Marcou ${label} como pendente.`;
  }
  return `Atualizou o lançamento de ${label}.`;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seedState);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const canEditRef = useRef(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesError, setQuotesError] = useState("");
  const [catalogProfile, setCatalogProfile] = useState<CatalogIdentity>(emptyCatalogIdentity);
  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;
  const clientRef = useRef<SupabaseClient | null>(null);
  const stateRef = useRef(state);
  const writes = useRef(0);
  const lastFocusLoad = useRef(0);
  stateRef.current = state;

  async function run(task: (client: SupabaseClient) => Promise<void>) {
    const client = clientRef.current;
    if (!client || !canEditRef.current) return;
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

  async function writeChange(
    client: SupabaseClient,
    entry: { kind: string; day?: string; categoryId?: string; summary: string },
  ) {
    try {
      const saved = await recordChange(client, entry);
      setChanges((current) => [saved, ...current.filter((item) => item.id !== saved.id)].slice(0, 200));
      setHistoryError("");
    } catch (error) {
      setHistoryError(explainHistoryError(error));
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
      const signedIn = Boolean(data.user);
      setEmail(data.user?.email ?? null);
      setCanEdit(signedIn);
      canEditRef.current = signedIn;
      let loaded = await fetchState(active);
      if (
        signedIn &&
        !loaded.days.length &&
        !loaded.analysis.length &&
        loaded.categories.every((category) => category.builtin)
      ) {
        const seed = seedState();
        await syncState(active, seed);
        loaded = seed;
      }
      if (cancel) return;
      dispatch({ type: "replace", state: loaded });
      lastFocusLoad.current = Date.now();
      setReady(true);
      fetchChanges(active)
        .then((entries) => {
          if (!cancel) {
            setChanges(entries);
            setHistoryError("");
          }
        })
        .catch((error) => {
          if (!cancel) setHistoryError(explainHistoryError(error));
        });
      if (signedIn) {
        fetchQuotes(active)
          .then((rows) => {
            if (!cancel) {
              setQuotes(rows);
              setQuotesError("");
            }
          })
          .catch((error) => {
            if (!cancel) setQuotesError(explainQuotesError(error));
          });
        fetchCatalogProfile(active)
          .then((profile) => {
            if (!cancel) setCatalogProfile(profile);
          })
          .catch((error) => {
            if (!cancel) setQuotesError(explainQuotesError(error));
          });
      }
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
      if (readDayDraft()?.open) return;
      if (Date.now() - lastFocusLoad.current < 60_000) return;
      lastFocusLoad.current = Date.now();
      fetchState(client)
        .then((fresh) => {
          if (writes.current > 0) return;
          dispatch({ type: "replace", state: fresh });
        })
        .catch((error) => setSaveError(explainSupabaseError(error)));
      fetchChanges(client)
        .then((entries) => {
          if (writes.current > 0) return;
          setChanges(entries);
        })
        .catch((error) => setHistoryError(explainHistoryError(error)));
      if (canEditRef.current) {
        fetchQuotes(client)
          .then((rows) => {
            if (writes.current > 0) return;
            setQuotes(rows);
          })
          .catch((error) => setQuotesError(explainQuotesError(error)));
        fetchCatalogProfile(client)
          .then((profile) => {
            if (writes.current > 0) return;
            setCatalogProfile(profile);
          })
          .catch((error) => setQuotesError(explainQuotesError(error)));
      }
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [ready]);

  const store: Store = {
    ready,
    configured,
    email,
    canEdit,
    loadError,
    saveError,
    changes,
    historyError,
    quotes,
    quotesError,
    catalogProfile,
    state,
    replace: (next) => {
      dispatch({ type: "replace", state: next });
      void run(async (client) => {
        await syncState(client, next);
        await writeChange(client, { kind: "importacao", summary: "Substituiu os lançamentos por um arquivo." });
      });
    },
    reset: () => {
      const seed = seedState();
      dispatch({ type: "reset", state: seed });
      void run(async (client) => {
        await syncState(client, seed);
        await writeChange(client, { kind: "restauracao", summary: "Restaurou a planilha original." });
      });
    },
    saveDay: (day) => {
      const previous = stateRef.current.days.find((item) => item.date === day.date);
      dispatch({ type: "save-day", day });
      void run(async (client) => {
        await saveDayRemote(client, day);
        await writeChange(client, { kind: "dia", day: day.date, summary: daySummary(previous, day) });
      });
    },
    patchCell: (date, categoryId, value) => {
      const previous = stateRef.current.days.find((item) => item.date === date)?.counts[categoryId] || 0;
      if (previous === value) return;
      const label = stateRef.current.categories.find((category) => category.id === categoryId)?.label || categoryId;
      dispatch({ type: "patch-cell", date, categoryId, value });
      void run(async (client) => {
        await saveCell(client, date, categoryId, value);
        await writeChange(client, {
          kind: "celula",
          day: date,
          categoryId,
          summary: `${label} em ${formatDate(date)}: ${previous} → ${value}`,
        });
      });
    },
    deleteDay: (date) => {
      dispatch({ type: "delete-day", date });
      void run(async (client) => {
        await deleteDayRemote(client, date);
        await writeChange(client, { kind: "dia", day: date, summary: `Excluiu o lançamento de ${formatDate(date)}.` });
      });
    },
    reconcile: (date) => {
      dispatch({ type: "reconcile", date });
      void run(async (client) => {
        await reconcileDay(client, date);
        await writeChange(client, {
          kind: "dia",
          day: date,
          summary: `Usou a soma dos motivos em ${formatDate(date)}.`,
        });
      });
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
      void run(async (client) => {
        await insertCategory(client, category, position);
        await writeChange(client, { kind: "motivo", summary: `Criou o motivo ${trimmed}.` });
      });
    },
    renameCategory: (id, label) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      dispatch({ type: "rename-category", id, label: trimmed });
      void run(async (client) => {
        await renameCategoryRemote(client, id, trimmed);
        await writeChange(client, { kind: "motivo", summary: `Renomeou um motivo para ${trimmed}.` });
      });
    },
    deleteCategory: (id) => {
      const category = stateRef.current.categories.find((item) => item.id === id);
      if (!category || category.builtin) return;
      dispatch({ type: "delete-category", id });
      void run(async (client) => {
        await deleteCategoryRemote(client, id);
        await writeChange(client, { kind: "motivo", summary: `Apagou o motivo ${category.label}.` });
      });
    },
    saveAnalysis: (lead) => {
      const existed = stateRef.current.analysis.some((item) => item.id === lead.id);
      dispatch({ type: "save-analysis", lead });
      void run(async (client) => {
        await saveAnalysisRemote(client, lead);
        const when = lead.date ? ` em ${formatDate(lead.date)}` : "";
        await writeChange(client, {
          kind: "analise",
          day: lead.date,
          summary: existed ? `Atualizou um lead em análise${when}.` : `Incluiu um lead em análise${when}.`,
        });
      });
    },
    deleteAnalysis: (id) => {
      const lead = stateRef.current.analysis.find((item) => item.id === id);
      dispatch({ type: "delete-analysis", id });
      void run(async (client) => {
        await deleteAnalysisRemote(client, id);
        const when = lead?.date ? ` de ${formatDate(lead.date)}` : "";
        await writeChange(client, { kind: "analise", day: lead?.date, summary: `Removeu um lead em análise${when}.` });
      });
    },
    importQuotes: (incoming) => {
      const { quotes: merged, added } = mergeQuotes(quotesRef.current, incoming);
      setQuotes(merged);
      void run(async (client) => {
        try {
          await upsertQuotes(client, incoming);
          setQuotesError("");
          const only = incoming.length === 1 ? incoming[0] : null;
          const dieCut = incoming.filter((quote) => quote.family === "corte_vinco").length;
          await writeChange(client, {
            kind: "orcamento",
            summary: only
              ? `${added ? "Cadastrou" : "Atualizou"} a caixa ${only.width} x ${only.depth} x ${only.height}${only.family === "corte_vinco" ? ", corte e vinco" : ""}${only.material ? `, ${only.material}` : ""}.`
              : `Importou ${incoming.length} orçamentos de caixas${dieCut ? `, ${dieCut} de corte e vinco` : ""}, ${added} novos.`,
          });
        } catch (error) {
          setQuotesError(explainQuotesError(error));
        }
      });
    },
    saveCatalogProfile: (profile) => {
      setCatalogProfile(profile);
      void run(async (client) => {
        try {
          await saveCatalogProfileRemote(client, profile);
          setQuotesError("");
        } catch (error) {
          setQuotesError(explainQuotesError(error));
        }
      });
    },
    deleteQuote: (id) => {
      const quote = quotesRef.current.find((item) => item.id === id);
      setQuotes((current) => current.filter((item) => item.id !== id));
      void run(async (client) => {
        try {
          await deleteQuoteRemote(client, id);
          setQuotesError("");
          await writeChange(client, {
            kind: "orcamento",
            summary: quote
              ? `Removeu o orçamento ${quote.width} x ${quote.depth} x ${quote.height}.`
              : "Removeu um orçamento.",
          });
        } catch (error) {
          setQuotesError(explainQuotesError(error));
        }
      });
    },
    signOut: () => {
      canEditRef.current = false;
      void clientRef.current?.auth.signOut().finally(() => {
        window.location.assign("/");
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
