import { commercialReader, cronAuthorized, syncWriter } from "@/lib/kommo/access";
import { kommoCredentials } from "@/lib/kommo/client";
import { kommoStore } from "@/lib/kommo/db";
import { explainKommoDb } from "@/lib/kommo/errors";
import { privateJson } from "@/lib/kommo/http";
import { stepSync } from "@/lib/kommo/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_BUDGET_MS = 8_000;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return privateJson({ error: "A sincronização automática não foi autorizada." }, 401);
  const credentials = kommoCredentials();
  if (!credentials) return privateJson({ error: "Faltam KOMMO_SUBDOMAIN e KOMMO_ACCESS_TOKEN no servidor." }, 503);
  const service = syncWriter();
  if (!service) {
    return privateJson({ error: "Falta SUPABASE_SERVICE_ROLE_KEY no servidor para a sincronização automática." }, 503);
  }
  try {
    const store = kommoStore(service);
    const current = await store.getState(credentials.subdomain);
    if (
      current &&
      current.phase !== "idle" &&
      current.lastAttemptAt &&
      Date.now() - Date.parse(current.lastAttemptAt) < 120_000
    ) {
      return privateJson({ done: false, message: "Uma importação já está em andamento." });
    }
    const started = Date.now();
    let step = await stepSync({ store, credentials, mode: "incremental" });
    while (!step.done && Date.now() - started < CRON_BUDGET_MS) {
      step = await stepSync({ store, credentials, mode: "incremental" });
    }
    return privateJson(step);
  } catch (error) {
    return privateJson({ error: explainSyncError(error) }, 502);
  }
}

export async function POST(request: Request) {
  const reader = await commercialReader();
  if ("error" in reader) return privateJson({ error: reader.error }, reader.status);
  const credentials = kommoCredentials();
  if (!credentials) return privateJson({ error: "Faltam KOMMO_SUBDOMAIN e KOMMO_ACCESS_TOKEN no servidor." }, 503);
  const body = (await request.json().catch(() => ({}))) as { mode?: string; restart?: boolean };
  const mode = body.mode === "full" ? "full" : "incremental";
  const client = syncWriter() || reader.supabase;
  try {
    const step = await stepSync({
      store: kommoStore(client),
      credentials,
      mode,
      restart: Boolean(body.restart),
    });
    return privateJson(step);
  } catch (error) {
    const message = explainSyncError(error);
    return privateJson({ error: message }, 502);
  }
}

function explainSyncError(error: unknown) {
  return explainKommoDb(error);
}
