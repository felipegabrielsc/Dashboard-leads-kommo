import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommercialLead, Stage, StatusKind } from "./types";
import type { LeadWrite, PipelineWrite, StatusWrite, SyncStateRow, SyncStore, UserWrite } from "./sync";
import { missingKommoTables } from "../supabaseServer";

type StateDb = {
  account_id: number;
  subdomain: string;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  cursor_updated_at: string | null;
  seen_updated_at: string | null;
  full_reconcile_at: string | null;
  phase: SyncStateRow["phase"];
  resume_url: string | null;
  mode: SyncStateRow["mode"];
  run_started_at: string | null;
  pages_done: number | null;
  upserted: number | null;
};

function fromState(row: StateDb): SyncStateRow {
  return {
    accountId: row.account_id,
    subdomain: row.subdomain,
    lastSuccessAt: row.last_success_at,
    lastAttemptAt: row.last_attempt_at,
    lastError: row.last_error || "",
    cursorUpdatedAt: row.cursor_updated_at,
    seenUpdatedAt: row.seen_updated_at,
    fullReconcileAt: row.full_reconcile_at,
    phase: row.phase,
    resumeUrl: row.resume_url || "",
    mode: row.mode,
    runStartedAt: row.run_started_at,
    pagesDone: row.pages_done || 0,
    upserted: row.upserted || 0,
  };
}

function toState(state: SyncStateRow) {
  return {
    account_id: state.accountId,
    subdomain: state.subdomain,
    last_success_at: state.lastSuccessAt,
    last_attempt_at: state.lastAttemptAt,
    last_error: state.lastError,
    cursor_updated_at: state.cursorUpdatedAt,
    seen_updated_at: state.seenUpdatedAt,
    full_reconcile_at: state.fullReconcileAt,
    phase: state.phase,
    resume_url: state.resumeUrl,
    mode: state.mode,
    run_started_at: state.runStartedAt,
    pages_done: state.pagesDone,
    upserted: state.upserted,
  };
}

async function selectAll<T>(client: SupabaseClient, table: string, columns: string, accountId: number): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .eq("account_id", accountId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data || []) as T[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

export function kommoStore(client: SupabaseClient): SyncStore {
  return {
    async getState(subdomain) {
      const { data, error } = await client.from("kommo_sync_state").select("*").eq("subdomain", subdomain).maybeSingle();
      if (error) throw error;
      return data ? fromState(data as StateDb) : null;
    },
    async saveState(state) {
      const { error } = await client.from("kommo_sync_state").upsert(toState(state));
      if (error) throw error;
    },
    async replaceStructure({ pipelines, statuses, users }) {
      if (pipelines.length) {
        const { error } = await client.from("kommo_pipelines").upsert(pipelines.map(pipelineRow), { onConflict: "account_id,id" });
        if (error) throw error;
      }
      if (statuses.length) {
        const { error } = await client.from("kommo_statuses").upsert(statuses.map(statusRow), { onConflict: "account_id,id" });
        if (error) throw error;
      }
      if (users.length) {
        const { error } = await client.from("kommo_users").upsert(users.map(userRow), { onConflict: "account_id,id" });
        if (error) throw error;
      }
    },
    async upsertLeads(leads) {
      const active = leads.filter((lead) => !lead.isDeleted).map(leadRow);
      const deleted = leads.filter((lead) => lead.isDeleted);
      for (let index = 0; index < active.length; index += 200) {
        const { error } = await client.from("kommo_leads").upsert(active.slice(index, index + 200), { onConflict: "account_id,id" });
        if (error) throw error;
      }
      for (let index = 0; index < deleted.length; index += 200) {
        const rows = deleted.slice(index, index + 200).map((lead) => ({
          account_id: lead.accountId,
          id: lead.id,
          is_deleted: true,
          synced_at: lead.syncedAt,
        }));
        const { error } = await client.from("kommo_leads").upsert(rows, { onConflict: "account_id,id" });
        if (error) throw error;
      }
    },
    async markMissingDeleted(accountId, runStartedAt) {
      const { error } = await client
        .from("kommo_leads")
        .update({ is_deleted: true })
        .eq("account_id", accountId)
        .eq("is_deleted", false)
        .lt("synced_at", runStartedAt);
      if (error) throw error;
    },
    async kinds(accountId) {
      const rows = await selectAll<{ pipeline_id: number; id: number; kind: StatusKind }>(
        client,
        "kommo_statuses",
        "pipeline_id,id,kind",
        accountId,
      );
      return new Map(rows.map((row) => [`${row.pipeline_id}:${row.id}`, row.kind]));
    },
    async writeLog(entry) {
      const { error } = await client.from("kommo_sync_logs").insert({
        account_id: entry.accountId,
        mode: entry.mode,
        ok: entry.ok,
        pages: entry.pages,
        upserted: entry.upserted,
        message: entry.message,
        finished_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
  };
}

function pipelineRow(row: PipelineWrite) {
  return {
    account_id: row.accountId,
    id: row.id,
    name: row.name,
    is_main: row.isMain,
    is_archive: row.isArchive,
    sort: row.sort,
    updated_at: new Date().toISOString(),
  };
}

function statusRow(row: StatusWrite) {
  return {
    account_id: row.accountId,
    id: row.id,
    pipeline_id: row.pipelineId,
    name: row.name,
    sort: row.sort,
    kind: row.kind,
    color: row.color,
    updated_at: new Date().toISOString(),
  };
}

function userRow(row: UserWrite) {
  return {
    account_id: row.accountId,
    id: row.id,
    name: row.name,
    email: row.email,
    active: row.active,
    updated_at: new Date().toISOString(),
  };
}

function leadRow(lead: LeadWrite) {
  return {
    account_id: lead.accountId,
    id: lead.id,
    name: lead.name,
    price: lead.price,
    pipeline_id: lead.pipelineId,
    status_id: lead.statusId,
    responsible_user_id: lead.userId,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
    closed_at: lead.closedAt,
    status_kind: lead.statusKind,
    is_deleted: false,
    kommo_url: lead.url,
    synced_at: lead.syncedAt,
  };
}

export function explainKommoDb(error: unknown): string {
  if (missingKommoTables(error)) {
    return "As tabelas do Comercial Kommo ainda não existem. Execute supabase/kommo.sql no SQL Editor.";
  }
  return error instanceof Error ? error.message : "Não consegui ler o comercial no Supabase.";
}

type LeadDb = {
  id: number;
  name: string | null;
  price: number | string | null;
  pipeline_id: number | null;
  status_id: number | null;
  responsible_user_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  status_kind: StatusKind;
  is_deleted: boolean;
  kommo_url: string | null;
};

export async function loadAccountSnapshot(client: SupabaseClient, accountId: number) {
  const [leadRows, statusRows, userRows, pipelineRows] = await Promise.all([
    selectAll<LeadDb>(
      client,
      "kommo_leads",
      "id,name,price,pipeline_id,status_id,responsible_user_id,created_at,updated_at,closed_at,status_kind,is_deleted,kommo_url",
      accountId,
    ),
    selectAll<{ id: number; pipeline_id: number; name: string; sort: number; kind: StatusKind }>(
      client,
      "kommo_statuses",
      "id,pipeline_id,name,sort,kind",
      accountId,
    ),
    selectAll<{ id: number; name: string }>(client, "kommo_users", "id,name", accountId),
    selectAll<{ id: number; name: string; is_archive: boolean; sort: number }>(
      client,
      "kommo_pipelines",
      "id,name,is_archive,sort",
      accountId,
    ),
  ]);
  const statusName = new Map(statusRows.map((row) => [row.id, row.name]));
  const userName = new Map(userRows.map((row) => [row.id, row.name]));
  const pipelineName = new Map(pipelineRows.map((row) => [row.id, row.name]));
  const leads: CommercialLead[] = leadRows.map((row) => ({
    id: row.id,
    name: row.name || `Negócio ${row.id}`,
    price: Number(row.price) || 0,
    pipelineId: row.pipeline_id,
    statusId: row.status_id,
    statusName: (row.status_id && statusName.get(row.status_id)) || "",
    statusKind: row.status_kind,
    userId: row.responsible_user_id,
    userName: (row.responsible_user_id && userName.get(row.responsible_user_id)) || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    isDeleted: row.is_deleted,
    url: row.kommo_url || "",
  }));
  const stages: Stage[] = statusRows.map((row) => ({
    pipelineId: row.pipeline_id,
    pipelineName: pipelineName.get(row.pipeline_id) || `Funil ${row.pipeline_id}`,
    statusId: row.id,
    name: row.name,
    sort: row.sort,
    kind: row.kind,
  }));
  return {
    leads,
    stages,
    users: userRows.map((row) => ({ id: row.id, name: row.name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    pipelines: pipelineRows
      .filter((row) => !row.is_archive)
      .sort((a, b) => a.sort - b.sort)
      .map((row) => ({ id: row.id, name: row.name })),
  };
}
