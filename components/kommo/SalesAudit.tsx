"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatBrl, formatDate, formatInt } from "@/lib/format";
import type { RepurchaseAudit } from "@/lib/v4/audit";
import type { CommercialReport, PublicSync, SaleRow } from "@/lib/kommo/types";
import { DashboardFilters } from "./DashboardFilters";
import { KommoShell } from "./KommoShell";
import { SalesTable } from "./SalesTable";
import { SetupChecklist } from "./SetupChecklist";
import { SyncStatus } from "./SyncStatus";
import { readViewCache, writeViewCache } from "@/lib/kommo/viewCache";
import { commercialSearch } from "./query";
import { useCommercialQuery } from "./useCommercialQuery";

type SalesResponse = {
  configured: boolean;
  tablesReady: boolean;
  provisional: boolean;
  sync: PublicSync | null;
  pipelines: { id: number; name: string }[];
  users: { id: number; name: string }[];
  metrics: CommercialReport["metrics"] | null;
  sales: SaleRow[];
  salesTotal: number;
  matchTotal: number;
  page: number;
  pageSize: number;
  notice: string;
  error: string;
  repurchases?: RepurchaseAudit;
};

export function SalesAudit() {
  const query = useCommercialQuery();
  const [data, setData] = useState<SalesResponse | null>(null);
  const [status, setStatus] = useState(0);
  const [failure, setFailure] = useState("");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(query.q);

  useEffect(() => setDraft(query.q), [query.q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft === query.q) return;
      query.update({ q: draft });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [draft, query]);

  useEffect(() => {
    const controller = new AbortController();
    const search = commercialSearch({
      from: query.from,
      to: query.to,
      pipeline: query.pipeline,
      user: query.user,
      q: query.q,
      page: query.page,
    });
    const url = `/api/kommo/vendas?${search}`;
    const cached = readViewCache<SalesResponse>(url);
    if (cached) {
      setData(cached);
      setStatus(200);
      setFailure("");
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setStatus(response.status);
          setData(null);
          setFailure(typeof body.error === "string" ? body.error : "Não consegui carregar as vendas.");
          return;
        }
        setStatus(200);
        setFailure("");
        setData(body as SalesResponse);
        writeViewCache(url, body);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) setFailure("Não consegui carregar as vendas.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query.from, query.page, query.pipeline, query.q, query.to, query.user]);

  const painelHref = `/kommo?${query.query}`;
  const vendasHref = `/kommo/vendas?${query.query}`;
  const importHref = `/kommo/importacoes?${query.query}`;
  const pages = data ? Math.max(1, Math.ceil(data.matchTotal / data.pageSize)) : 1;
  const blocked = status === 503 || Boolean(data && (!data.configured || !data.tablesReady));

  return (
    <KommoShell
      title="Vendas contabilizadas"
      description="Negócios ganhos no Kommo e recompras da planilha neste período. Cada ID abre o negócio no Kommo."
      active="vendas"
      painelHref={painelHref}
      vendasHref={vendasHref}
      importHref={importHref}
    >
      {status === 401 ? (
        <section className="panel p-5">
          <h2 className="font-serif text-2xl">Entre para ver as vendas</h2>
          <Link href={`/login?next=${encodeURIComponent(vendasHref)}`} className="btn btn-primary mt-4">
            Entrar
          </Link>
        </section>
      ) : null}
      {blocked ? <SetupChecklist message={failure || data?.error} /> : null}
      {data && !blocked ? <SyncStatus sync={data.sync} provisional={data.provisional} error={data.error} /> : null}
      {data && !blocked && data.notice ? <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-mute">{data.notice}</p> : null}
      <DashboardFilters
        from={query.from}
        to={query.to}
        pipeline={query.pipeline}
        user={query.user}
        pipelines={data?.pipelines || []}
        users={data?.users || []}
        onChange={(next) => query.update(next)}
      />
      <section className="panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">
              {data?.metrics ? formatInt(data.metrics.wonCount) : "—"} vendas ·{" "}
              {data?.metrics ? formatBrl(data.metrics.revenue) : "—"}
            </h2>
            <p className="mt-1 text-sm text-mute">
              A busca filtra a lista. Os totais acima continuam os da conta do período.
              {data && query.q ? ` A busca encontrou ${formatInt(data.matchTotal)}.` : ""}
            </p>
          </div>
          <label className="text-sm text-mute">
            Buscar por nome ou ID
            <input className="field mt-1" value={draft} onChange={(event) => setDraft(event.target.value)} />
          </label>
        </div>
        <div className="mt-4">
          {loading && !data ? <p className="text-sm text-mute">Carregando vendas…</p> : null}
          {!blocked && !loading ? <SalesTable sales={data?.sales || []} /> : null}
          {blocked ? <p className="text-sm text-mute">A lista real aparece depois que o Kommo estiver ligado.</p> : null}
        </div>
        {data && pages > 1 ? (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              className="btn"
              disabled={query.page <= 1}
              onClick={() => query.update({ page: query.page - 1 }, true)}
            >
              Anterior
            </button>
            <span className="text-sm text-mute">
              Página {query.page} de {pages}
            </span>
            <button
              type="button"
              className="btn"
              disabled={query.page >= pages}
              onClick={() => query.update({ page: query.page + 1 }, true)}
            >
              Próxima
            </button>
          </div>
        ) : null}
        {failure && status !== 401 && !blocked ? <p className="mt-3 text-sm text-wine">{failure}</p> : null}
      </section>
      {!blocked && data?.repurchases?.ready ? (
        <RepurchaseList audit={data.repurchases} importHref={importHref} />
      ) : null}
    </KommoShell>
  );
}

function RepurchaseList({ audit, importHref }: { audit: RepurchaseAudit; importHref: string }) {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const pages = Math.max(1, Math.ceil(audit.rows.length / pageSize));
  const current = Math.min(page, pages);
  const visible = audit.rows.slice((current - 1) * pageSize, current * pageSize);
  if (!audit.imported) {
    return (
      <section className="panel p-5">
        <h2 className="font-serif text-2xl">Recompras</h2>
        <p className="mt-2 text-sm text-mute">Nenhuma planilha ativa. Importe as vendas para listar as recompras junto com as vendas.</p>
        <Link href={importHref} className="btn btn-primary mt-4">
          Importar planilha
        </Link>
      </section>
    );
  }
  return (
    <section className="panel p-5">
      <h2 className="font-serif text-2xl">
        {formatInt(audit.count)} recompras · {formatBrl(audit.revenue)}
      </h2>
      <p className="mt-1 text-sm text-mute">
        Número da compra maior que 1, na data da venda. A busca acima também filtra esta lista. Recompras marcadas como já registradas no Kommo aparecem aqui e ficam de fora do valor.
      </p>
      {audit.excludedCount > 0 ? (
        <p className="mt-2 text-sm text-mute">
          {formatInt(audit.excludedCount)} marcada{audit.excludedCount === 1 ? "" : "s"} como já presente no Kommo.
        </p>
      ) : null}
      <div className="mt-4 max-w-full overflow-x-auto">
        {audit.rows.length ? (
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-mute">
              <tr>
                <th className="py-2 pr-3 font-medium">Data</th>
                <th className="py-2 pr-3 font-medium">Cliente</th>
                <th className="py-2 pr-3 font-medium">Valor</th>
                <th className="py-2 pr-3 font-medium">Compra</th>
                <th className="py-2 pr-3 font-medium">Vendedor</th>
                <th className="py-2 font-medium">No Kommo</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="py-2 pr-3">{formatDate(row.saleDate)}</td>
                  <td className="py-2 pr-3">{row.customerName}</td>
                  <td className="py-2 pr-3">{formatBrl(row.amount)}</td>
                  <td className="py-2 pr-3">{row.purchaseNumber}</td>
                  <td className="py-2 pr-3">{row.sellerName || "—"}</td>
                  <td className="py-2">{row.alreadyInKommo ? "Já contabilizada" : "Entra na soma"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-mute">Nenhuma recompra neste recorte.</p>
        )}
      </div>
      {pages > 1 ? (
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="btn" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            Anterior
          </button>
          <span className="text-sm text-mute">
            Página {current} de {pages}
          </span>
          <button type="button" className="btn" disabled={current >= pages} onClick={() => setPage(current + 1)}>
            Próxima
          </button>
        </div>
      ) : null}
    </section>
  );
}
