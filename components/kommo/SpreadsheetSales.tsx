"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatBrl, formatDate, formatInt } from "@/lib/format";
import type { RepurchaseAudit, RepurchaseLine } from "@/lib/v4/audit";
import { KommoLinkDialog } from "./KommoLinkDialog";
import { RepurchaseEditor } from "./RepurchaseEditor";

type View = "recompras" | "todas";

export function SpreadsheetSales({
  audit,
  importHref,
  canEdit,
  kommoReady,
  sellers,
  loginHref,
  onChanged,
}: {
  audit: RepurchaseAudit;
  importHref: string;
  canEdit: boolean;
  kommoReady: boolean;
  sellers: string[];
  loginHref: string;
  onChanged: () => void;
}) {
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>("todas");
  const [editing, setEditing] = useState<RepurchaseLine | null | undefined>(undefined);
  const [linking, setLinking] = useState<RepurchaseLine | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const rows = view === "recompras" ? audit.rows.filter((row) => row.isRepurchase) : audit.rows;
  const pageSize = 50;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  const canManual = canEdit && audit.manualReady;

  const customers = useMemo(() => {
    const byName = new Map<string, { name: string; lastPurchase: number }>();
    for (const row of audit.rows) {
      const key = row.customerName.trim().toLowerCase();
      const known = byName.get(key);
      if (!known || row.purchaseNumber > known.lastPurchase) byName.set(key, { name: row.customerName, lastPurchase: row.purchaseNumber });
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [audit.rows]);

  function done(text: string) {
    setEditing(undefined);
    setLinking(null);
    setError("");
    setMessage(text);
    onChanged();
  }

  async function mutate(row: RepurchaseLine, url: string, success: string | ((body: { following?: number }) => string), fallback: string) {
    setBusy(row.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof body.error === "string" ? body.error : fallback);
        return;
      }
      done(typeof success === "string" ? success : success(body));
    } catch {
      setError(fallback);
    } finally {
      setBusy("");
    }
  }

  function unlink(row: RepurchaseLine) {
    const later = audit.rows.some(
      (other) =>
        other.id !== row.id &&
        other.customerName === row.customerName &&
        other.kommoLeadId === row.kommoLeadId &&
        !other.alreadyInKommo &&
        other.saleDate >= row.saleDate,
    );
    const following = later && window.confirm(`Remover o lead #${row.kommoLeadId} também das próximas compras de ${row.customerName}?`);
    void mutate(
      row,
      `/api/kommo/v4/sales/${row.id}/link${following ? "?following=1" : ""}`,
      (body) => {
        const extra = Number(body.following) || 0;
        return `Vínculo removido da venda de ${row.customerName}${extra ? ` e de ${extra} compra${extra === 1 ? "" : "s"} seguinte${extra === 1 ? "" : "s"}` : ""}.`;
      },
      "Não consegui desvincular a venda.",
    );
  }

  function remove(row: RepurchaseLine) {
    if (!window.confirm(`Excluir a recompra manual de ${row.customerName} em ${formatDate(row.saleDate)}?`)) return;
    void mutate(row, `/api/kommo/v4/sales/${row.id}`, "Recompra manual excluída.", "Não consegui excluir a recompra.");
  }

  const addButton = canManual ? (
    <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>
      Adicionar recompra
    </button>
  ) : null;

  const editor =
    editing !== undefined ? (
      <RepurchaseEditor sale={editing} customers={customers} sellers={sellers} onClose={() => setEditing(undefined)} onSaved={done} />
    ) : null;

  if (!audit.imported) {
    return (
      <section className="panel p-5">
        <h2 className="font-serif text-2xl">Recompras</h2>
        <p className="mt-2 text-sm text-mute">
          Nenhuma planilha ativa e nenhuma recompra lançada à mão neste período. Importe as vendas ou adicione uma recompra.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={importHref} className={canManual ? "btn" : "btn btn-primary"}>
            Importar planilha
          </Link>
          {addButton}
        </div>
        {message ? <p className="mt-3 text-sm text-ink">{message}</p> : null}
        {canEdit && !audit.manualReady ? <p className="mt-3 text-sm text-mute">Execute supabase/v4-vinculos-recompras.sql para lançar recompras à mão.</p> : null}
        {editor}
      </section>
    );
  }

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">
            {formatInt(audit.count)} recompras · {formatBrl(audit.revenue)}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-mute">
            Número da compra maior que 1, na data da venda{audit.batchFileName ? `, da planilha ${audit.batchFileName}` : ""} e das lançadas à mão. A busca acima também filtra esta lista. Vincule a primeira compra ao lead do cliente no Kommo e as próximas compras ao mesmo lead. Recompra vinculada continua somando, a não ser que o valor dela já esteja contado no Kommo.
          </p>
        </div>
        {addButton}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`chip ${view === "todas" ? "chip-on" : ""}`}
          onClick={() => {
            setView("todas");
            setPage(1);
          }}
        >
          Todas as vendas
        </button>
        <button
          type="button"
          className={`chip ${view === "recompras" ? "chip-on" : ""}`}
          onClick={() => {
            setView("recompras");
            setPage(1);
          }}
        >
          Só recompras
        </button>
        {audit.excludedCount > 0 ? (
          <span className="text-sm text-mute">
            {formatInt(audit.excludedCount)} recompra{audit.excludedCount === 1 ? "" : "s"} com valor já contado no Kommo.
          </span>
        ) : null}
        {audit.manualCount > 0 ? (
          <span className="text-sm text-mute">
            {formatInt(audit.manualCount)} lançada{audit.manualCount === 1 ? "" : "s"} à mão.
          </span>
        ) : null}
      </div>
      {!canEdit ? (
        <p className="mt-3 text-sm text-mute">
          <Link className="underline underline-offset-2" href={loginHref}>
            Entre
          </Link>{" "}
          para vincular vendas ao Kommo ou adicionar recompras.
        </p>
      ) : null}
      {canEdit && !audit.manualReady ? (
        <p className="mt-3 text-sm text-wine">Execute supabase/v4-vinculos-recompras.sql no SQL Editor para vincular vendas e lançar recompras à mão.</p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-ink">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-wine">{error}</p> : null}
      <div className="mt-4 max-w-full overflow-x-auto">
        {rows.length ? (
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-mute">
              <tr>
                <th className="py-2 pr-3 font-medium">Data</th>
                <th className="py-2 pr-3 font-medium">Cliente</th>
                <th className="py-2 pr-3 font-medium">Valor</th>
                <th className="py-2 pr-3 font-medium">Compra</th>
                <th className="py-2 pr-3 font-medium">Vendedor</th>
                <th className="py-2 pr-3 font-medium">Origem</th>
                <th className="py-2 pr-3 font-medium">No Kommo</th>
                {canEdit ? <th className="py-2 font-medium">Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-t border-line align-top">
                  <td className="py-2 pr-3">{formatDate(row.saleDate)}</td>
                  <td className="py-2 pr-3">{row.customerName}</td>
                  <td className="py-2 pr-3">{formatBrl(row.amount)}</td>
                  <td className="py-2 pr-3">{row.isRepurchase ? `${row.purchaseNumber}ª` : "Primeira"}</td>
                  <td className="py-2 pr-3">{row.sellerName || "—"}</td>
                  <td className="py-2 pr-3">{row.source === "manual" ? "Manual" : "Planilha"}</td>
                  <td className="py-2 pr-3">
                    {row.kommoLeadId ? (
                      <span>
                        {row.kommoUrl ? (
                          <a className="underline decoration-line underline-offset-2" href={row.kommoUrl} target="_blank" rel="noreferrer">
                            #{row.kommoLeadId}
                          </a>
                        ) : (
                          `#${row.kommoLeadId}`
                        )}
                        {row.kommoName ? ` ${row.kommoName}` : ""}
                        <span className="block text-xs text-mute">
                          {row.alreadyInKommo
                            ? row.isRepurchase
                              ? "Valor já contado no Kommo"
                              : "Negócio desta venda"
                            : row.isRepurchase
                              ? "Lead do cliente · entra na soma"
                              : "Lead do cliente"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-mute">{row.isRepurchase ? "Entra na soma" : "Sem vínculo"}</span>
                    )}
                  </td>
                  {canEdit ? (
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {audit.manualReady && kommoReady ? (
                          row.kommoLeadId ? (
                            <>
                              <button type="button" className="btn" disabled={busy === row.id} onClick={() => setLinking(row)}>
                                Trocar
                              </button>
                              <button type="button" className="btn" disabled={busy === row.id} onClick={() => unlink(row)}>
                                Desvincular
                              </button>
                            </>
                          ) : (
                            <button type="button" className="btn" disabled={busy === row.id} onClick={() => setLinking(row)}>
                              Vincular ao Kommo
                            </button>
                          )
                        ) : null}
                        {row.source === "manual" ? (
                          <>
                            <button type="button" className="btn" disabled={busy === row.id} onClick={() => setEditing(row)}>
                              Editar
                            </button>
                            <button type="button" className="btn" disabled={busy === row.id} onClick={() => remove(row)}>
                              Excluir
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-mute">{view === "recompras" ? "Nenhuma recompra neste recorte." : "Nenhuma venda neste recorte."}</p>
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
      {editor}
      {linking ? <KommoLinkDialog sale={linking} onClose={() => setLinking(null)} onSaved={done} /> : null}
    </section>
  );
}
