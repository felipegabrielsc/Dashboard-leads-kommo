"use client";

import { useEffect, useRef, useState } from "react";
import { formatBrl, formatDate, formatInt } from "@/lib/format";
import type { V4Issue, V4Row, V4Suggestion } from "@/lib/v4/types";
import { KommoShell } from "./KommoShell";
import { commercialSearch } from "./query";
import { useCommercialQuery } from "./useCommercialQuery";

type Preview = {
  fileName: string;
  fileHash: string;
  rows: V4Row[];
  invalid: V4Issue[];
  warnings: V4Issue[];
  totals: {
    totalCount: number;
    totalAmount: number;
    firstCount: number;
    firstAmount: number;
    repurchaseCount: number;
    repurchaseAmount: number;
  };
  suggestions: V4Suggestion[];
};

type Batch = {
  id: string;
  fileName: string;
  importedAt: string;
  rowCount: number;
  firstCount: number;
  repurchaseCount: number;
  totalAmount: number;
  firstAmount: number;
  repurchaseAmount: number;
  status: "active" | "replaced";
};

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function V4Import() {
  const query = useCommercialQuery();
  const fileRef = useRef<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [batches, setBatches] = useState<Batch[]>([]);
  const [ready, setReady] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const painelHref = `/kommo?${query.query}`;
  const vendasHref = `/kommo/vendas?${commercialSearch({ from: query.from, to: query.to, pipeline: query.pipeline, user: query.user })}`;

  async function loadBatches() {
    const response = await fetch("/api/kommo/v4/batches", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof body.error === "string" ? body.error : "Não consegui ler o histórico.");
      return;
    }
    setReady(body.ready !== false);
    setBatches(Array.isArray(body.batches) ? body.batches : []);
  }

  useEffect(() => {
    loadBatches().catch(() => setError("Não consegui ler o histórico."));
  }, []);

  async function previewFile(file: File) {
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/kommo/v4/preview", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPreview(null);
        setError(typeof body.error === "string" ? body.error : "Não consegui ler a planilha.");
        return;
      }
      const next = body as Preview;
      const selection: Record<number, number> = {};
      for (const suggestion of next.suggestions || []) {
        const first = suggestion.candidates[0];
        if (first) selection[suggestion.sourceRow] = first.id;
      }
      fileRef.current = file;
      setPicked(selection);
      setMarked({});
      setPreview(next);
    } catch {
      setError("Não consegui ler a planilha.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    const file = fileRef.current;
    if (!file || !preview) return;
    setBusy(true);
    setError("");
    setMessage("");
    const links = preview.rows
      .filter((row) => marked[row.sourceRow] && picked[row.sourceRow])
      .map((row) => ({ sourceRow: row.sourceRow, kommoLeadId: picked[row.sourceRow] }));
    const form = new FormData();
    form.set("file", file);
    form.set("links", JSON.stringify(links));
    try {
      const response = await fetch("/api/kommo/v4/confirm", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof body.error === "string" ? body.error : "Não consegui gravar a importação.");
        return;
      }
      setMessage("Importação gravada. A planilha anterior, se existia, deixou de entrar na soma.");
      setPreview(null);
      fileRef.current = null;
      await loadBatches();
    } catch {
      setError("Não consegui gravar a importação.");
    } finally {
      setBusy(false);
    }
  }

  const suggestions = new Map((preview?.suggestions || []).map((item) => [item.sourceRow, item.candidates]));

  return (
    <KommoShell
      title="Importações"
      description="A planilha entra inteira, com primeira compra e recompra classificadas pelo número da compra. Só a recompra não conciliada soma na receita consolidada."
      active="importacoes"
      painelHref={painelHref}
      vendasHref={vendasHref}
    >
      <section className="panel p-5">
        <h2 className="font-serif text-2xl">Importar planilha de vendas</h2>
        <p className="mt-2 max-w-3xl text-sm text-mute">
          Arquivo Excel .xlsx, colunas A a I: data, cliente, valor, número da compra, vendedor, matéria-prima, imposto, operacional e lucro. Recompra é número da compra maior que 1. Um percentual entre 0 e 1 nesses custos vira valor sobre a venda.
        </p>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Arquivo</span>
          <input
            className="mt-2 block w-full text-sm"
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void previewFile(file);
            }}
          />
        </label>
        {busy ? <p className="mt-3 text-sm text-mute">Lendo a planilha…</p> : null}
        {error ? <p className="mt-3 text-sm text-wine">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-ink">{message}</p> : null}
      </section>

      {preview ? (
        <section className="panel space-y-4 p-5">
          <div>
            <h2 className="font-serif text-2xl">Prévia de {preview.fileName}</h2>
            <p className="mt-1 text-sm text-mute">
              Nada foi gravado. Nome, data e valor iguais a um negócio ganho geram aviso. A linha só sai da soma se você marcar que ela já está no Kommo.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-line p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-mute">Primeira compra</p>
              <p className="mt-2 font-serif text-2xl">{formatInt(preview.totals.firstCount)}</p>
              <p className="mt-1 text-sm">{formatBrl(preview.totals.firstAmount)}</p>
            </article>
            <article className="rounded-2xl border border-line p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-mute">Recompra</p>
              <p className="mt-2 font-serif text-2xl">{formatInt(preview.totals.repurchaseCount)}</p>
              <p className="mt-1 text-sm">{formatBrl(preview.totals.repurchaseAmount)}</p>
            </article>
            <article className="rounded-2xl border border-line p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-mute">Total</p>
              <p className="mt-2 font-serif text-2xl">{formatInt(preview.totals.totalCount)}</p>
              <p className="mt-1 text-sm">{formatBrl(preview.totals.totalAmount)}</p>
            </article>
          </div>
          {preview.invalid.length ? (
            <div>
              <h3 className="text-sm font-semibold">Linhas inválidas</h3>
              <ul className="mt-2 space-y-1 text-sm text-wine">
                {preview.invalid.map((issue) => (
                  <li key={`${issue.sourceRow}-${issue.message}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {preview.warnings.length ? (
            <div>
              <h3 className="text-sm font-semibold">Possíveis repetições na planilha</h3>
              <ul className="mt-2 space-y-1 text-sm text-mute">
                {preview.warnings.map((issue) => (
                  <li key={`${issue.sourceRow}-${issue.message}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-mute">
                <tr>
                  <th className="py-2 pr-3 font-medium">Data</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium">Valor</th>
                  <th className="py-2 pr-3 font-medium">Compra</th>
                  <th className="py-2 pr-3 font-medium">Vendedor</th>
                  <th className="py-2 font-medium">Já está no Kommo</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => {
                  const candidates = suggestions.get(row.sourceRow) || [];
                  return (
                    <tr key={row.sourceRow} className="border-t border-line">
                      <td className="py-2 pr-3">{formatDate(row.saleDate)}</td>
                      <td className="py-2 pr-3">{row.customerName}</td>
                      <td className="py-2 pr-3">{formatBrl(row.amount)}</td>
                      <td className="py-2 pr-3">{row.isRepurchase ? `Recompra ${row.purchaseNumber}` : "Primeira"}</td>
                      <td className="py-2 pr-3">{row.sellerName || "—"}</td>
                      <td className="py-2">
                        {candidates.length ? (
                          <label className="flex flex-wrap items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(marked[row.sourceRow])}
                              onChange={(event) => setMarked((current) => ({ ...current, [row.sourceRow]: event.target.checked }))}
                            />
                            <select
                              className="rounded-xl border border-line bg-paper px-2 py-1"
                              value={picked[row.sourceRow] || candidates[0].id}
                              onChange={(event) => setPicked((current) => ({ ...current, [row.sourceRow]: Number(event.target.value) }))}
                            >
                              {candidates.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  #{candidate.id} {candidate.name}
                                  {candidate.strong ? " · nome parecido" : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <span className="text-mute">Sem correspondência</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-primary" disabled={busy || !preview.rows.length} onClick={() => void confirmImport()}>
            Confirmar importação
          </button>
        </section>
      ) : null}

      <section className="panel p-5">
        <h2 className="font-serif text-2xl">Histórico</h2>
        {!ready ? (
          <p className="mt-2 text-sm text-mute">Execute supabase/v4-vendas.sql no SQL Editor para guardar as importações.</p>
        ) : batches.length ? (
          <div className="mt-4 max-w-full overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-mute">
                <tr>
                  <th className="py-2 pr-3 font-medium">Quando</th>
                  <th className="py-2 pr-3 font-medium">Arquivo</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 pr-3 font-medium">Registros</th>
                  <th className="py-2 font-medium">Recompras</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-t border-line">
                    <td className="py-2 pr-3">{when(batch.importedAt)}</td>
                    <td className="py-2 pr-3">{batch.fileName}</td>
                    <td className="py-2 pr-3">{batch.status === "active" ? "Ativa" : "Substituída"}</td>
                    <td className="py-2 pr-3">
                      {formatInt(batch.rowCount)} · {formatBrl(batch.totalAmount)}
                    </td>
                    <td className="py-2">
                      {formatInt(batch.repurchaseCount)} · {formatBrl(batch.repurchaseAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-mute">Ainda não há importações.</p>
        )}
      </section>
    </KommoShell>
  );
}
