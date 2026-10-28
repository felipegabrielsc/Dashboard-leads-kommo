import assert from "node:assert/strict";
import { kommoCredentials, safeKommoApiUrl, unixToIso } from "./client";
import { stepSync, type LeadWrite, type StatusWrite, type SyncStateRow, type SyncStore } from "./sync";

assert.equal(unixToIso(0), null);
assert.equal(unixToIso(-1), null);
assert.equal(unixToIso(1), "1970-01-01T00:00:01.000Z");

const previousSubdomain = process.env.KOMMO_SUBDOMAIN;
const previousToken = process.env.KOMMO_ACCESS_TOKEN;
process.env.KOMMO_SUBDOMAIN = "https://MinhaConta.kommo.com/leads";
process.env.KOMMO_ACCESS_TOKEN = "segredo";
assert.equal(kommoCredentials()?.subdomain, "minhaconta");
process.env.KOMMO_SUBDOMAIN = "conta errada";
assert.equal(kommoCredentials(), null);
process.env.KOMMO_ACCESS_TOKEN = "";
process.env.KOMMO_SUBDOMAIN = "conta";
assert.equal(kommoCredentials(), null);
if (previousSubdomain === undefined) delete process.env.KOMMO_SUBDOMAIN;
else process.env.KOMMO_SUBDOMAIN = previousSubdomain;
if (previousToken === undefined) delete process.env.KOMMO_ACCESS_TOKEN;
else process.env.KOMMO_ACCESS_TOKEN = previousToken;

assert.throws(() => safeKommoApiUrl("conta", "https://evil.example/api/v4/leads"), /API do Kommo/);
assert.equal(
  safeKommoApiUrl("conta", "/api/v4/leads?page=2"),
  "https://conta.kommo.com/api/v4/leads?page=2",
);

const credentials = { subdomain: "conta", token: "segredo" };
const now = new Date("2026-10-28T15:00:00.000Z");

function lead(id: number, name = `Negócio ${id}`, statusId = 11) {
  return {
    id,
    name,
    price: 100,
    pipeline_id: 1,
    status_id: statusId,
    responsible_user_id: 1,
    created_at: 1_760_000_000,
    updated_at: 1_760_000_000 + id,
    closed_at: 0,
  };
}

const pipeline = {
  id: 1,
  name: "Vendas",
  is_main: true,
  is_archive: false,
  sort: 1,
  _embedded: {
    statuses: [
      { id: 10, name: "Entrada", sort: 10, type: 1, is_editable: false },
      { id: 11, name: "Contato", sort: 20, type: 0, is_editable: true },
      { id: 142, name: "Venda ganha", sort: 30, type: 0, is_editable: false },
      { id: 143, name: "Venda perdida", sort: 40, type: 0, is_editable: false },
    ],
  },
};

function memory(seed: LeadWrite[] = [], initial: SyncStateRow | null = null) {
  const leads = new Map(seed.map((item) => [`${item.accountId}:${item.id}`, { ...item }]));
  let state = initial;
  const statuses: StatusWrite[] = [];
  let missingCalls = 0;
  const store: SyncStore = {
    async getState() {
      return state;
    },
    async saveState(next) {
      state = { ...next };
    },
    async replaceStructure(input) {
      statuses.splice(0, statuses.length, ...input.statuses);
    },
    async upsertLeads(rows) {
      for (const row of rows) {
        const key = `${row.accountId}:${row.id}`;
        const current = leads.get(key);
        if (row.isDeleted && current) {
          leads.set(key, { ...current, isDeleted: true, syncedAt: row.syncedAt });
          continue;
        }
        if (row.isDeleted) {
          leads.set(key, { ...row, name: row.name || "", isDeleted: true });
          continue;
        }
        leads.set(key, { ...row, isDeleted: false });
      }
    },
    async markMissingDeleted(accountId, runStartedAt) {
      missingCalls += 1;
      for (const [key, row] of leads) {
        if (row.accountId === accountId && !row.isDeleted && row.syncedAt < runStartedAt) {
          leads.set(key, { ...row, isDeleted: true });
        }
      }
    },
    async kinds() {
      return new Map(statuses.map((status) => [`${status.pipelineId}:${status.id}`, status.kind]));
    },
    async writeLog() {},
  };
  return {
    store,
    leads,
    statuses,
    missing() {
      return missingCalls;
    },
    state() {
      return state;
    },
  };
}

function blankLead(partial: Partial<LeadWrite> & Pick<LeadWrite, "id">): LeadWrite {
  return {
    accountId: 7,
    name: `Negócio ${partial.id}`,
    price: 0,
    pipelineId: 1,
    statusId: 11,
    userId: 1,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    closedAt: null,
    statusKind: "open",
    isDeleted: false,
    url: `https://conta.kommo.com/leads/detail/${partial.id}`,
    syncedAt: "2020-01-01T00:00:00.000Z",
    ...partial,
  };
}

function pages(handler: (url: string) => { items: ReturnType<typeof lead>[]; next: string | null } | "throw") {
  const calls: string[] = [];
  const fetchJson = async (_credentials: typeof credentials, url: string) => {
    calls.push(url);
    if (url.includes("/api/v4/account")) return { status: 200, body: { id: 7, name: "Conta" } };
    if (url.includes("/pipelines")) return { status: 200, body: { _embedded: { pipelines: [pipeline] } } };
    if (url.includes("/users")) {
      return { status: 200, body: { _embedded: { users: [{ id: 1, name: "Ana", email: "ana@exemplo.com" }] } } };
    }
    if (url.includes("only_deleted")) {
      return { status: 200, body: { _embedded: { leads: [{ id: 4, name: "APAGAR", updated_at: 1_760_000_004, is_deleted: true }] } } };
    }
    const outcome = handler(url);
    if (outcome === "throw") throw new Error("falha de teste");
    return {
      status: 200,
      body: {
        _embedded: { leads: outcome.items },
        _links: outcome.next ? { next: { href: outcome.next } } : {},
      },
    };
  };
  return { fetchJson, calls };
}

async function run(store: SyncStore, fetchJson: Parameters<typeof stepSync>[0]["fetchJson"], mode: "full" | "incremental") {
  let restart = false;
  let step;
  for (let guard = 0; guard < 12; guard += 1) {
    step = await stepSync({ store, credentials, mode, restart, fetchJson, now, pauseMs: 0 });
    restart = false;
    if (step.done) return step;
  }
  throw new Error("a sincronização não terminou");
}

async function main() {
const fullPages = pages((url) => {
  const page = Number(new URL(url).searchParams.get("page") || "1");
  const table: Record<number, ReturnType<typeof lead>[]> = {
    1: [lead(1), lead(2)],
    2: [lead(3), lead(4, "Manter nome")],
    3: [lead(5)],
    4: [lead(6, "Ganho", 142)],
  };
  return {
    items: table[page] || [],
    next: page < 4 ? `/api/v4/leads?limit=250&page=${page + 1}` : null,
  };
});
const full = memory([blankLead({ id: 4, name: "Manter nome" }), blankLead({ id: 99, name: "Sumiu" })]);
const done = await run(full.store, fullPages.fetchJson, "full");
assert.equal(done.done, true);
assert.equal(done.provisional, false);
assert.equal(full.missing(), 1);
assert.equal(full.leads.size, 7);
assert.equal(full.leads.get("7:4")?.name, "Manter nome");
assert.equal(full.leads.get("7:4")?.isDeleted, true);
assert.equal(full.leads.get("7:99")?.isDeleted, true);
assert.equal(full.leads.get("7:6")?.statusKind, "won");
assert.equal(full.leads.get("7:1")?.isDeleted, false);
assert.equal(full.statuses.find((status) => status.id === 142)?.kind, "won");
assert.equal(full.state()?.phase, "idle");
assert.ok(full.state()?.cursorUpdatedAt);

const kept = memory([blankLead({ id: 99, name: "Fica" })], {
  accountId: 7,
  subdomain: "conta",
  lastSuccessAt: "2026-10-01T00:00:00.000Z",
  lastAttemptAt: "2026-10-01T00:00:00.000Z",
  lastError: "",
  cursorUpdatedAt: "2026-10-01T00:00:00.000Z",
  seenUpdatedAt: null,
  fullReconcileAt: "2026-10-01T00:00:00.000Z",
  phase: "idle",
  resumeUrl: "",
  mode: "incremental",
  runStartedAt: null,
  pagesDone: 0,
  upserted: 0,
});
const incrementalPages = pages(() => ({ items: [lead(8)], next: null }));
await run(kept.store, incrementalPages.fetchJson, "incremental");
assert.equal(kept.missing(), 0);
assert.equal(kept.leads.get("7:99")?.isDeleted, false);
assert.ok(incrementalPages.calls.some((url) => url.includes("filter%5Bupdated_at%5D%5Bfrom%5D") || url.includes("filter[updated_at][from]")));

const failing = memory();
const failingPages = pages((url) => {
  const page = Number(new URL(url).searchParams.get("page") || "1");
  if (page >= 2) return "throw";
  return { items: [lead(1)], next: "/api/v4/leads?limit=250&page=2" };
});
await stepSync({ store: failing.store, credentials, mode: "full", fetchJson: failingPages.fetchJson, now, pauseMs: 0 });
await assert.rejects(
  stepSync({ store: failing.store, credentials, mode: "full", fetchJson: failingPages.fetchJson, now, pauseMs: 0 }),
  /falha de teste/,
);
assert.equal(failing.state()?.phase, "leads");
assert.equal(failing.state()?.cursorUpdatedAt, null);
assert.match(failing.state()?.resumeUrl || "", /page=1/);
assert.match(failing.state()?.lastError || "", /falha de teste/);
assert.equal(failing.leads.size, 0);

const hostile = memory();
const hostilePages = pages((url) => {
  const page = Number(new URL(url).searchParams.get("page") || "1");
  if (page === 1) return { items: [lead(1)], next: "https://evil.example/api/v4/leads?page=2" };
  return { items: [], next: null };
});
await stepSync({ store: hostile.store, credentials, mode: "full", fetchJson: hostilePages.fetchJson, now, pauseMs: 0 });
await assert.rejects(
  stepSync({ store: hostile.store, credentials, mode: "full", fetchJson: hostilePages.fetchJson, now, pauseMs: 0 }),
  /API do Kommo/,
);
assert.equal(hostilePages.calls.some((url) => url.includes("evil.example")), false);
assert.equal(hostile.leads.size, 0);
assert.equal(hostile.state()?.phase, "leads");

console.log("kommo sync ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
