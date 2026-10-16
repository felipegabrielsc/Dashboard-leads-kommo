"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QuoteCatalog } from "@/components/QuoteCatalog";
import { QuoteForm } from "@/components/QuoteForm";
import { formatBrl, formatInt } from "@/lib/format";
import {
  draftFromQuote,
  emptyQuoteDraft,
  mergeQuotes,
  parseQuotes,
  quoteTitle,
  searchQuotes,
  type Quote,
} from "@/lib/quotes";

export function QuotesPanel({
  quotes,
  error,
  onClose,
  onImport,
  onDelete,
}: {
  quotes: Quote[];
  error: string;
  onClose: () => void;
  onImport: (quotes: Quote[]) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState("");
  const [notice, setNotice] = useState("");
  const [localError, setLocalError] = useState("");
  const [view, setView] = useState<"lista" | "catalogo">("lista");
  const [catalogPrices, setCatalogPrices] = useState(true);
  const [form, setForm] = useState<{ title: string; initialId: string; draft: ReturnType<typeof emptyQuoteDraft> } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const materials = useMemo(() => {
    const names = new Set(quotes.map((quote) => quote.material).filter(Boolean));
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [quotes]);
  const visible = useMemo(() => searchQuotes(quotes, query, material), [material, query, quotes]);
  const filtered = query.trim() !== "" || material !== "";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (form) setForm(null);
      else onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [form, onClose]);

  async function onFile(file: File) {
    setLocalError("");
    setNotice("");
    const text = await file.text();
    const parsed = parseQuotes(text);
    if (!parsed.length) {
      setLocalError("Não encontrei caixas nesse texto. Cada bloco começa com Caixa, as medidas e o valor.");
      return;
    }
    const { added, updated } = mergeQuotes(quotes, parsed);
    onImport(parsed);
    setNotice(
      `${formatInt(parsed.length)} no arquivo: ${formatInt(added)} novos e ${formatInt(updated)} com a medida já salva, que ficaram com o preço novo.`,
    );
  }

  async function downloadPdf(kind: "precos" | "medidas") {
    setLocalError("");
    const { downloadCatalogPdf } = await import("@/lib/catalogPdf");
    downloadCatalogPdf(visible, filtered, kind);
  }

  function saveManual(quote: Quote) {
    const previousId = form?.initialId ?? "";
    const { added } = mergeQuotes(quotes, [quote]);
    onImport([quote]);
    if (previousId && previousId !== quote.id) onDelete(previousId);
    setForm(null);
    setLocalError("");
    setNotice(added ? `${quoteTitle(quote)} cadastrada.` : `${quoteTitle(quote)} atualizada com o preço novo.`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-3 sm:items-center" onMouseDown={onClose}>
      <section
        className="panel flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quotes-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="quotes-title" className="font-serif text-3xl">
              Orçamentos
            </h2>
            <p className="mt-1 max-w-xl text-sm text-mute">
              Pesquise e cadastre em milímetros. O catálogo sai em centímetros, com preços ou só com as medidas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setForm({ title: "Nova medida", initialId: "", draft: emptyQuoteDraft() })}
            >
              Nova medida
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              Importar txt
            </button>
            <button
              type="button"
              className="btn disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!visible.length}
              onClick={() => void downloadPdf("precos")}
            >
              PDF com preços
            </button>
            <button
              type="button"
              className="btn disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!visible.length}
              onClick={() => void downloadPdf("medidas")}
            >
              PDF só medidas
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Fechar
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void onFile(file);
              }}
            />
          </div>
        </div>

        <div className="space-y-3 border-b border-line px-5 py-4">
          <label className="block text-sm">
            Pesquisar
            <input
              autoFocus
              className="field mt-1"
              placeholder="220 x 220 x 160, onda B, divisória"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`chip ${material === "" ? "chip-on" : ""}`} onClick={() => setMaterial("")}>
              Todos os papéis
            </button>
            {materials.map((name) => (
              <button
                key={name}
                type="button"
                className={`chip ${material === name ? "chip-on" : ""}`}
                onClick={() => setMaterial(material === name ? "" : name)}
              >
                {name}
              </button>
            ))}
            {quotes.some((quote) => !quote.material) && (
              <button
                type="button"
                className={`chip ${material === "__none__" ? "chip-on" : ""}`}
                onClick={() => setMaterial(material === "__none__" ? "" : "__none__")}
              >
                Sem papelão informado
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-mute">
              {formatInt(visible.length)} de {formatInt(quotes.length)} orçamentos
            </p>
            <div className="flex gap-2">
              <button type="button" className={`chip ${view === "lista" ? "chip-on" : ""}`} onClick={() => setView("lista")}>
                Lista
              </button>
              <button
                type="button"
                className={`chip ${view === "catalogo" ? "chip-on" : ""}`}
                onClick={() => setView("catalogo")}
              >
                Catálogo
              </button>
            </div>
          </div>
          {(localError || error) && <p className="text-sm text-wine">{localError || error}</p>}
          {notice && <p className="text-sm text-pine">{notice}</p>}
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {form && (
            <div className="mb-4">
              <QuoteForm
                materials={materials}
                initial={form.draft}
                title={form.title}
                onCancel={() => setForm(null)}
                onSave={saveManual}
              />
            </div>
          )}
          {!quotes.length && !form && (
            <p className="text-sm text-mute">Nenhum orçamento ainda. Cadastre uma medida ou importe o txt.</p>
          )}
          {quotes.length > 0 && !visible.length && (
            <p className="text-sm text-mute">Nenhuma caixa com essa medida ou esse papelão.</p>
          )}
          {view === "catalogo" ? (
            <QuoteCatalog quotes={visible} filtered={filtered} prices={catalogPrices} onPrices={setCatalogPrices} />
          ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((quote) => (
              <article key={quote.id} className="rounded-2xl border border-line bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">
                      {quoteTitle(quote)} <span className="text-mute">mm</span>
                    </h3>
                    <p className="text-sm text-mute">{quote.material || "Papelão não informado"}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="text-sm text-mute underline-offset-2 hover:underline"
                      onClick={() =>
                        setForm({ title: "Editar medida", initialId: quote.id, draft: draftFromQuote(quote) })
                      }
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-sm text-mute underline-offset-2 hover:underline"
                      onClick={() => {
                        if (window.confirm(`Remover ${quoteTitle(quote)}?`)) onDelete(quote.id);
                      }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-mute">
                    <tr>
                      <th className="py-1 font-medium">Quantidade</th>
                      <th className="py-1 font-medium">Valor unitário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.tiers.map((tier) => (
                      <tr key={tier.quantity} className="border-t border-line">
                        <td className="py-1.5">{formatInt(tier.quantity)} caixas</td>
                        <td className="py-1.5 font-medium">{formatBrl(tier.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
          )}
        </div>
      </section>
    </div>
  );
}
