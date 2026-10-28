import {
  kommoJson,
  safeKommoApiUrl,
  kommoOrigin,
  leadUrl,
  leadsUrl,
  readPage,
  statusMap,
  unixToIso,
  type KommoCredentials,
  type RawLead,
  type RawPipeline,
  type RawStatus,
  type RawUser,
} from "./client";
import type { StatusKind } from "./types";

const PAGES_PER_STEP = 3;

export type LeadWrite = {
  accountId: number;
  id: number;
  name: string;
  price: number;
  pipelineId: number | null;
  statusId: number | null;
  userId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  closedAt: string | null;
  statusKind: StatusKind;
  isDeleted: boolean;
  url: string;
  syncedAt: string;
};

export type PipelineWrite = {
  accountId: number;
  id: number;
  name: string;
  isMain: boolean;
  isArchive: boolean;
  sort: number;
};

export type StatusWrite = {
  accountId: number;
  id: number;
  pipelineId: number;
  name: string;
  sort: number;
  kind: StatusKind;
  color: string;
};

export type UserWrite = {
  accountId: number;
  id: number;
  name: string;
  email: string;
  active: boolean;
};

export type SyncStateRow = {
  accountId: number;
  subdomain: string;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string;
  cursorUpdatedAt: string | null;
  seenUpdatedAt: string | null;
  fullReconcileAt: string | null;
  phase: "idle" | "pipelines" | "leads" | "deleted";
  resumeUrl: string;
  mode: "full" | "incremental";
  runStartedAt: string | null;
  pagesDone: number;
  upserted: number;
};

export type SyncStore = {
  getState(subdomain: string): Promise<SyncStateRow | null>;
  saveState(state: SyncStateRow): Promise<void>;
  replaceStructure(input: { pipelines: PipelineWrite[]; statuses: StatusWrite[]; users: UserWrite[] }): Promise<void>;
  upsertLeads(leads: LeadWrite[]): Promise<void>;
  markMissingDeleted(accountId: number, runStartedAt: string): Promise<void>;
  kinds(accountId: number): Promise<Map<string, StatusKind>>;
  writeLog(entry: { accountId: number; mode: string; ok: boolean; pages: number; upserted: number; message: string }): Promise<void>;
};

export type SyncStep = {
  done: boolean;
  provisional: boolean;
  phase: SyncStateRow["phase"];
  pagesDone: number;
  upserted: number;
  message: string;
};

type FetchJson = (credentials: KommoCredentials, url: string) => Promise<{ status: number; body: unknown }>;

function blankState(accountId: number, subdomain: string): SyncStateRow {
  return {
    accountId,
    subdomain,
    lastSuccessAt: null,
    lastAttemptAt: null,
    lastError: "",
    cursorUpdatedAt: null,
    seenUpdatedAt: null,
    fullReconcileAt: null,
    phase: "idle",
    resumeUrl: "",
    mode: "full",
    runStartedAt: null,
    pagesDone: 0,
    upserted: 0,
  };
}

export function toLeadWrite(
  raw: RawLead,
  context: { accountId: number; subdomain: string; kinds: Map<string, StatusKind>; syncedAt: string; deleted?: boolean },
): LeadWrite | null {
  const id = Number(raw.id);
  if (!id) return null;
  const pipelineId = Number(raw.pipeline_id) || null;
  const statusId = Number(raw.status_id) || null;
  const kind = pipelineId && statusId ? context.kinds.get(`${pipelineId}:${statusId}`) || "open" : "open";
  return {
    accountId: context.accountId,
    id,
    name: raw.name || "",
    price: Number(raw.price) || 0,
    pipelineId,
    statusId,
    userId: Number(raw.responsible_user_id) || null,
    createdAt: unixToIso(raw.created_at),
    updatedAt: unixToIso(raw.updated_at),
    closedAt: unixToIso(raw.closed_at),
    statusKind: context.deleted ? "lost" : kind,
    isDeleted: Boolean(context.deleted || raw.is_deleted),
    url: leadUrl(context.subdomain, id),
    syncedAt: context.syncedAt,
  };
}

function cursorUnix(iso: string | null): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return Math.max(1, Math.floor(time / 1000) - 120);
}

export async function stepSync(input: {
  store: SyncStore;
  credentials: KommoCredentials;
  mode: "full" | "incremental";
  restart?: boolean;
  fetchJson?: FetchJson;
  now?: Date;
  pauseMs?: number;
}): Promise<SyncStep> {
  const fetchJson = input.fetchJson || kommoJson;
  const now = input.now || new Date();
  const pauseMs = input.pauseMs ?? 120;
  let state = await input.store.getState(input.credentials.subdomain);
  const starting = input.restart || !state || state.phase === "idle";
  if (starting) {
    const account = await readAccount(input.credentials, fetchJson);
    const mode = input.mode === "incremental" && state?.cursorUpdatedAt ? "incremental" : "full";
    state = {
      ...(state || blankState(account.id, input.credentials.subdomain)),
      accountId: account.id,
      subdomain: input.credentials.subdomain,
      phase: "pipelines",
      resumeUrl: "",
      mode,
      runStartedAt: now.toISOString(),
      lastAttemptAt: now.toISOString(),
      lastError: "",
      pagesDone: 0,
      upserted: 0,
      seenUpdatedAt: null,
    };
    await input.store.saveState(state);
  }
  if (!state) throw new Error("Não consegui abrir o estado da sincronização.");

  try {
    if (state.phase === "pipelines") {
      await importStructure(input.store, input.credentials, state.accountId, fetchJson);
      const updatedFrom = state.mode === "incremental" ? cursorUnix(state.cursorUpdatedAt) : null;
      state = { ...state, phase: "leads", resumeUrl: leadsUrl(input.credentials.subdomain, { updatedFrom }) };
      await input.store.saveState(state);
      return progress(state, false, "Funis e responsáveis atualizados.");
    }

    if (state.phase === "leads" || state.phase === "deleted") {
      const current = state;
      const kinds = await input.store.kinds(current.accountId);
      const outcome = await pullPages({
        credentials: input.credentials,
        fetchJson,
        startUrl: current.resumeUrl,
        pauseMs,
        map: (raw) =>
          toLeadWrite(raw, {
            accountId: current.accountId,
            subdomain: input.credentials.subdomain,
            kinds,
            syncedAt: current.runStartedAt || now.toISOString(),
            deleted: current.phase === "deleted",
          }),
      });
      if (outcome.leads.length) await input.store.upsertLeads(outcome.leads);
      const newest = outcome.leads.reduce<string | null>((max, lead) => {
        if (!lead.updatedAt) return max;
        if (!max || lead.updatedAt > max) return lead.updatedAt;
        return max;
      }, state.seenUpdatedAt);
      state = {
        ...state,
        pagesDone: state.pagesDone + outcome.pages,
        upserted: state.upserted + outcome.leads.length,
        resumeUrl: outcome.next,
        seenUpdatedAt: newest,
      };
      if (outcome.next) {
        await input.store.saveState(state);
        await input.store.writeLog({
          accountId: state.accountId,
          mode: state.mode,
          ok: true,
          pages: state.pagesDone,
          upserted: state.upserted,
          message: "Importação em andamento.",
        });
        return progress(state, false, "Importação em andamento.");
      }
      if (state.phase === "leads") {
        const deletedUrl = leadsUrl(input.credentials.subdomain, {
          deleted: true,
          updatedFrom: state.mode === "incremental" ? cursorUnix(state.cursorUpdatedAt) : null,
        });
        state = { ...state, phase: "deleted", resumeUrl: deletedUrl };
        await input.store.saveState(state);
        return progress(state, false, "Negócios lidos. Conferindo exclusões.");
      }
      if (state.mode === "full" && state.runStartedAt) await input.store.markMissingDeleted(state.accountId, state.runStartedAt);
      state = {
        ...state,
        phase: "idle",
        resumeUrl: "",
        lastSuccessAt: now.toISOString(),
        lastError: "",
        cursorUpdatedAt: state.seenUpdatedAt || state.cursorUpdatedAt,
        fullReconcileAt: state.mode === "full" ? now.toISOString() : state.fullReconcileAt,
      };
      await input.store.saveState(state);
      await input.store.writeLog({
        accountId: state.accountId,
        mode: state.mode,
        ok: true,
        pages: state.pagesDone,
        upserted: state.upserted,
        message: "Sincronização concluída.",
      });
      return progress(state, true, "Sincronização concluída.");
    }

    return progress(state, true, "Nada pendente.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "A sincronização falhou.";
    if (state) {
      state = { ...state, lastError: message, lastAttemptAt: now.toISOString() };
      await input.store.saveState(state);
      await input.store.writeLog({
        accountId: state.accountId,
        mode: state.mode,
        ok: false,
        pages: state.pagesDone,
        upserted: state.upserted,
        message,
      });
    }
    throw error;
  }
}

function progress(state: SyncStateRow, done: boolean, message: string): SyncStep {
  return {
    done,
    provisional: !state.fullReconcileAt || state.phase !== "idle",
    phase: state.phase,
    pagesDone: state.pagesDone,
    upserted: state.upserted,
    message,
  };
}

async function readAccount(credentials: KommoCredentials, fetchJson: FetchJson) {
  const { body } = await fetchJson(credentials, `${kommoOrigin(credentials.subdomain)}/api/v4/account`);
  const id = Number(body && typeof body === "object" && "id" in body ? (body as { id: unknown }).id : 0);
  if (!id) throw new Error("O Kommo não informou a conta deste token.");
  return { id };
}

async function importStructure(
  store: SyncStore,
  credentials: KommoCredentials,
  accountId: number,
  fetchJson: FetchJson,
) {
  const pipelines = await fetchAll<RawPipeline>(
    credentials,
    fetchJson,
    `${kommoOrigin(credentials.subdomain)}/api/v4/leads/pipelines?limit=250`,
    "pipelines",
  );
  const users = await fetchAll<RawUser>(
    credentials,
    fetchJson,
    `${kommoOrigin(credentials.subdomain)}/api/v4/users?limit=250`,
    "users",
  );
  const kinds = statusMap(pipelines);
  const pipelineRows: PipelineWrite[] = [];
  const statusRows: StatusWrite[] = [];
  for (const pipeline of pipelines) {
    const id = Number(pipeline.id);
    if (!id) continue;
    pipelineRows.push({
      accountId,
      id,
      name: pipeline.name || `Funil ${id}`,
      isMain: Boolean(pipeline.is_main),
      isArchive: Boolean(pipeline.is_archive),
      sort: Number(pipeline.sort) || 0,
    });
    for (const status of pipeline._embedded?.statuses || []) {
      const statusId = Number(status.id);
      if (!statusId) continue;
      statusRows.push(statusWrite(accountId, id, status, kinds.get(`${id}:${statusId}`) || "open"));
    }
  }
  const userRows: UserWrite[] = users.flatMap((user) => {
    const id = Number(user.id);
    if (!id) return [];
    return [
      {
        accountId,
        id,
        name: user.name || `Usuário ${id}`,
        email: user.email || "",
        active: user.rights?.is_active !== false,
      },
    ];
  });
  await store.replaceStructure({ pipelines: pipelineRows, statuses: statusRows, users: userRows });
}

function statusWrite(accountId: number, pipelineId: number, status: RawStatus, kind: StatusKind): StatusWrite {
  return {
    accountId,
    id: Number(status.id),
    pipelineId,
    name: status.name || `Etapa ${status.id}`,
    sort: Number(status.sort) || 0,
    kind,
    color: status.color || "",
  };
}

async function fetchAll<T>(credentials: KommoCredentials, fetchJson: FetchJson, start: string, key: string): Promise<T[]> {
  const items: T[] = [];
  let url = safeKommoApiUrl(credentials.subdomain, start);
  for (let page = 0; url && page < 40; page += 1) {
    const response = await fetchJson(credentials, url);
    const parsed = readPage<T>(response.body, key);
    items.push(...parsed.items);
    url = parsed.next ? safeKommoApiUrl(credentials.subdomain, parsed.next) : "";
  }
  return items;
}

async function pullPages(input: {
  credentials: KommoCredentials;
  fetchJson: FetchJson;
  startUrl: string;
  pauseMs: number;
  map: (raw: RawLead) => LeadWrite | null;
}) {
  const leads: LeadWrite[] = [];
  let url = safeKommoApiUrl(input.credentials.subdomain, input.startUrl);
  let pages = 0;
  let next = "";
  while (url && pages < PAGES_PER_STEP) {
    const page = await input.fetchJson(input.credentials, url);
    const parsed = readPage<RawLead>(page.body, "leads");
    for (const raw of parsed.items) {
      const lead = input.map(raw);
      if (lead) leads.push(lead);
    }
    pages += 1;
    next = parsed.next ? safeKommoApiUrl(input.credentials.subdomain, parsed.next) : "";
    url = next;
    if (url && input.pauseMs) await new Promise((resolve) => setTimeout(resolve, input.pauseMs));
  }
  return { leads, pages, next };
}
