"use client";

import { useEffect, useState } from "react";
import { formatBrl, formatDate } from "@/lib/format";
import type { RepurchaseLine } from "@/lib/v4/audit";
import type { LinkCandidate } from "@/lib/v4/links";

export function KommoLinkDialog({
  sale,
  onClose,
  onSaved,
}: {
  sale: RepurchaseLine;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<LinkCandidate[]>([]);
  const [windowRange, setWindowRange] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState(0);
  const [counted, setCounted] = useState(sale.kommoLeadId ? sale.alreadyInKommo : !sale.isRepurchase);
  const [following, setFollowing] = useState(true);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(term.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [term]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = search ? `?q=${encodeURIComponent(search)}` : "";
    fetch(`/api/kommo/v4/sales/${sale.id}/link${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setCandidates([]);
          setError(typeof body.error === "string" ? body.error : "Não consegui buscar os negócios do Kommo.");
          return;
        }
        setCandidates(Array.isArray(body.candidates) ? body.candidates : []);
        setWindowRange(body.window || null);
        setFollowingCount(Number(body.followingCount) || 0);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("Não consegui buscar os negócios do Kommo.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [sale.id, search]);

  async function link(candidate: LinkCandidate) {
    setBusy(candidate.id);
    setError("");
    try {
      const response = await fetch(`/api/kommo/v4/sales/${sale.id}/link`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kommoLeadId: candidate.id, counted, following: following && followingCount > 0 }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof body.error === "string" ? body.error : "Não consegui vincular a venda.");
        return;
      }
      const extra = Number(body.following) || 0;
      onSaved(
        `Venda de ${sale.customerName} vinculada ao negócio #${candidate.id}${counted ? ", com o valor já contado no Kommo" : ""}.` +
          (extra ? ` ${extra} compra${extra === 1 ? "" : "s"} seguinte${extra === 1 ? "" : "s"} deste cliente também ${extra === 1 ? "foi vinculada" : "foram vinculadas"}.` : ""),
      );
    } catch {
      setError("Não consegui vincular a venda.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" role="presentation" onMouseDown={onClose}>
      <div
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col bg-paper shadow-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">Vincular ao Kommo</p>
            <h2 id="link-title" className="font-serif text-3xl">
              {sale.customerName}
            </h2>
            <p className="mt-1 text-sm text-mute">
              {formatDate(sale.saleDate)} · {formatBrl(sale.amount)} · {sale.isRepurchase ? `${sale.purchaseNumber}ª compra` : "Primeira compra"}
            </p>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <p className="text-sm text-mute">
            Escolha o lead ganho deste cliente no Kommo. A primeira compra e as próximas do mesmo cliente podem usar o mesmo lead.
          </p>
          <div className="space-y-2 rounded-2xl border border-line p-3 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={counted} onChange={(event) => setCounted(event.target.checked)} />
              <span>
                O Kommo já conta o valor desta venda neste negócio
                <span className="block text-xs text-mute">
                  {sale.isRepurchase
                    ? "Marque só se a recompra virou um negócio próprio no Kommo. Marcada, ela sai da receita de recompras."
                    : "Normal para a primeira compra: o negócio ganho é esta venda."}
                </span>
              </span>
            </label>
            {followingCount > 0 ? (
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={following} onChange={(event) => setFollowing(event.target.checked)} />
                <span>
                  Vincular também {followingCount === 1 ? "a próxima compra" : `as próximas ${followingCount} compras`} deste cliente ao mesmo lead
                  <span className="block text-xs text-mute">As recompras continuam somando na receita.</span>
                </span>
              </label>
            ) : null}
          </div>
          <label className="block text-sm">
            Buscar negócio ganho por nome ou ID
            <input className="field mt-1" value={term} onChange={(event) => setTerm(event.target.value)} autoFocus />
          </label>
          {!search && windowRange ? (
            <p className="text-xs text-mute">
              Sugestões ganhas entre {formatDate(windowRange.from)} e {formatDate(windowRange.to)}, primeiro as de mesmo valor e nome parecido.
            </p>
          ) : null}
          {loading ? <p className="text-sm text-mute">Buscando negócios…</p> : null}
          {error ? <p className="text-sm text-wine">{error}</p> : null}
          {!loading && !error && !candidates.length ? (
            <p className="text-sm text-mute">Nenhum negócio ganho encontrado. Busque pelo nome do cliente ou pelo ID do Kommo.</p>
          ) : null}
          <ul className="space-y-2">
            {candidates.map((candidate) => {
              const current = sale.kommoLeadId === candidate.id && sale.alreadyInKommo === counted;
              const blocked = Boolean(candidate.otherCustomer) || (counted && Boolean(candidate.countedSaleId));
              return (
                <li key={candidate.id} className="rounded-2xl border border-line p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <a className="underline decoration-line underline-offset-2" href={candidate.url} target="_blank" rel="noreferrer">
                          #{candidate.id}
                        </a>{" "}
                        {candidate.name || "Sem nome"}
                      </p>
                      <p className="mt-1 text-sm text-mute">
                        Ganho em {formatDate(candidate.closedOn)} · {formatBrl(candidate.price)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1 text-xs">
                        {candidate.sameAmount ? <span className="chip chip-on">Mesmo valor</span> : null}
                        {candidate.dayGap === 0 ? <span className="chip chip-on">Mesmo dia</span> : null}
                        {candidate.dayGap > 0 ? <span className="chip">{candidate.dayGap} dia{candidate.dayGap === 1 ? "" : "s"} de diferença</span> : null}
                        {candidate.nameMatch ? <span className="chip chip-on">Nome parecido</span> : null}
                        {candidate.customerLead ? <span className="chip chip-on">Lead deste cliente</span> : null}
                        {candidate.otherCustomer ? <span className="chip text-wine">Vinculado a {candidate.otherCustomer}</span> : null}
                        {!candidate.otherCustomer && candidate.countedSaleId ? (
                          <span className="chip">Valor já contado em outra venda</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy != null || current || blocked}
                      onClick={() => void link(candidate)}
                    >
                      {current ? "Vinculado" : busy === candidate.id ? "Vinculando…" : "Vincular"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
