import type { SupabaseClient } from "@supabase/supabase-js";
import { kommoCredentials } from "./client";
import { explainKommoDb, kommoStore, loadAccountSnapshot } from "./db";
import { parseCommercialFilters } from "./filters";
import { buildCommercialReport } from "./metrics";
import { loadFilterLists, queryCommercialReport } from "./reportQuery";
import type { CommercialReport, PublicSync } from "./types";
import type { SyncStateRow } from "./sync";

export type CommercialRead =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      configured: boolean;
      tablesReady: boolean;
      subdomain: string;
      provisional: boolean;
      sync: PublicSync | null;
      pipelines: { id: number; name: string }[];
      users: { id: number; name: string }[];
      report: CommercialReport | null;
      salesTotal: number;
      aggregated: boolean;
      notice: string;
      error: string;
    };

export function publicSync(state: SyncStateRow): PublicSync {
  return {
    lastSuccessAt: state.lastSuccessAt,
    lastAttemptAt: state.lastAttemptAt,
    lastError: state.lastError,
    phase: state.phase,
    pagesDone: state.pagesDone,
    upserted: state.upserted,
    fullReconcileAt: state.fullReconcileAt,
    mode: state.mode,
  };
}

function emptyRead(partial: {
  configured: boolean;
  tablesReady: boolean;
  subdomain: string;
  provisional: boolean;
  error: string;
  sync?: PublicSync | null;
}): CommercialRead {
  return {
    ok: true,
    pipelines: [],
    users: [],
    report: null,
    salesTotal: 0,
    aggregated: false,
    notice: "",
    sync: partial.sync || null,
    ...partial,
  };
}

export async function readCommercial(supabase: SupabaseClient, search: URLSearchParams): Promise<CommercialRead> {
  const filters = parseCommercialFilters(search);
  if ("error" in filters) return { ok: false, status: 400, error: filters.error };
  const credentials = kommoCredentials();
  if (!credentials) {
    return emptyRead({ configured: false, tablesReady: false, subdomain: "", provisional: true, error: "" });
  }

  try {
    const state = await kommoStore(supabase).getState(credentials.subdomain);
    if (!state) {
      return emptyRead({
        configured: true,
        tablesReady: true,
        subdomain: credentials.subdomain,
        provisional: true,
        error: "",
      });
    }
    const provisional = !state.fullReconcileAt || state.phase !== "idle";
    const sync = publicSync(state);
    const fast = await queryCommercialReport(supabase, state.accountId, filters);
    if (fast.ok) {
      const lists = await loadFilterLists(supabase, state.accountId);
      return {
        ok: true,
        configured: true,
        tablesReady: true,
        subdomain: credentials.subdomain,
        provisional,
        sync,
        pipelines: lists.pipelines,
        users: lists.users,
        report: fast.report,
        salesTotal: fast.salesTotal,
        aggregated: true,
        notice: "",
        error: "",
      };
    }
    const snapshot = await loadAccountSnapshot(supabase, state.accountId);
    const report = buildCommercialReport(snapshot.leads, snapshot.stages, filters);
    return {
      ok: true,
      configured: true,
      tablesReady: true,
      subdomain: credentials.subdomain,
      provisional,
      sync,
      pipelines: snapshot.pipelines,
      users: snapshot.users,
      report,
      salesTotal: report.sales.length,
      aggregated: false,
      notice: fast.notice,
      error: "",
    };
  } catch (error) {
    return emptyRead({
      configured: true,
      tablesReady: false,
      subdomain: credentials.subdomain,
      provisional: true,
      error: explainKommoDb(error),
    });
  }
}
