"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicSync } from "@/lib/kommo/types";
import { KommoShell } from "./KommoShell";
import { SetupChecklist } from "./SetupChecklist";
import { formatWhen, phaseLabel } from "./labels";

type ConfigResponse = {
  configured: boolean;
  subdomain: string;
  sync: PublicSync | null;
  error: string;
};

type StepBody = {
  done?: boolean;
  message?: string;
  phase?: string;
  pagesDone?: number;
  upserted?: number;
  error?: string;
};

function parseStep(raw: string): StepBody {
  if (!raw) return {};
  try {
    const body = JSON.parse(raw) as StepBody;
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export function KommoSettings() {
  const [data, setData] = useState<ConfigResponse | null>(null);
  const [status, setStatus] = useState(0);
  const [failure, setFailure] = useState("");
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<StepBody | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/kommo/config", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    setStatus(response.status);
    if (!response.ok) {
      setData(null);
      setFailure(typeof body.error === "string" ? body.error : "Não consegui ler a configuração.");
      return;
    }
    setFailure("");
    setData(body as ConfigResponse);
  }, []);

  useEffect(() => {
    load().catch(() => setFailure("Não consegui ler a configuração."));
  }, [load]);

  async function run(mode: "full" | "incremental", restart: boolean) {
    setRunning(true);
    setNotice("");
    let again = restart;
    try {
      for (let index = 0; index < 400; index += 1) {
        const response = await fetch("/api/kommo/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, restart: again }),
        });
        const raw = await response.text();
        const body = parseStep(raw);
        if (!response.ok) {
          throw new Error(
            body.error ||
              (response.status === 502
                ? "O servidor encerrou a leitura antes de responder. Clique em Continuar."
                : "A sincronização falhou."),
          );
        }
        setProgress(body);
        again = false;
        if (body.done) {
          setNotice(body.message || "Sincronização concluída.");
          break;
        }
        if (index === 399) setNotice("A importação pausou neste lote. Clique em Continuar.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "A sincronização falhou.");
    } finally {
      setRunning(false);
      await load().catch(() => setFailure("Não consegui atualizar o estado."));
    }
  }

  const sync = data?.sync;
  const busy = Boolean(sync && sync.phase !== "idle");

  return (
    <KommoShell
      title="Configurações do Kommo"
      description="O token fica só no servidor. Esta tela mostra a conta, a última leitura e os botões de importação."
      active="config"
      painelHref="/kommo"
      vendasHref="/kommo/vendas"
    >
      {status === 401 ? (
        <section className="panel p-5">
          <h2 className="font-serif text-2xl">Entre para sincronizar</h2>
          <a href="/login?next=%2Fkommo%2Fconfiguracoes" className="btn btn-primary mt-4">
            Entrar
          </a>
        </section>
      ) : null}
      {status === 503 || (data && !data.configured) ? <SetupChecklist message={failure || data?.error} /> : null}
      {data?.configured ? (
        <section className="panel space-y-4 p-5">
          <div>
            <h2 className="font-serif text-2xl">{data.subdomain}.kommo.com</h2>
            <p className="mt-2 text-sm text-mute">
              Última conclusão: {formatWhen(sync?.lastSuccessAt || null)}. Fase: {phaseLabel(sync?.phase || "idle")}.
              {sync ? ` ${sync.pagesDone} páginas e ${sync.upserted} registros neste ciclo.` : " Nenhuma importação ainda."}
            </p>
            {sync?.lastError ? <p className="mt-2 text-sm text-wine">{sync.lastError}</p> : null}
            {data.error ? <p className="mt-2 text-sm text-wine">{data.error}</p> : null}
          </div>
          {progress ? (
            <p className="text-sm text-mute" aria-live="polite">
              {progress.message || "Importando"} · {phaseLabel(progress.phase || "")} · {progress.pagesDone || 0} páginas ·{" "}
              {progress.upserted || 0} registros
            </p>
          ) : null}
          {notice ? <p className="text-sm">{notice}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={running} onClick={() => run("full", true)}>
              {running ? "Importando…" : "Trazer histórico"}
            </button>
            <button type="button" className="btn" disabled={running} onClick={() => run("incremental", true)}>
              Atualizar agora
            </button>
            {busy ? (
              <button type="button" className="btn" disabled={running} onClick={() => run(sync?.mode || "full", false)}>
                Continuar
              </button>
            ) : null}
            <button
              type="button"
              className="btn"
              disabled={running}
              onClick={() => {
                if (window.confirm("Isso lê todos os negócios de novo, a partir da primeira página.")) run("full", true);
              }}
            >
              Recomeçar importação
            </button>
          </div>
          <p className="text-sm leading-6 text-mute">
            A primeira leitura percorre todas as páginas. Cada clique automático traz um lote, para caber no tempo do
            servidor. A atualização diária, às 8h de São Paulo, continua de onde a leitura parou e depois busca só o que
            mudou. Ela precisa de CRON_SECRET e da chave service role na Vercel.
          </p>
        </section>
      ) : null}
      {failure && status !== 401 && status !== 503 ? <p className="text-sm text-wine">{failure}</p> : null}
    </KommoShell>
  );
}
