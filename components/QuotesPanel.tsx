"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatBrl, formatInt } from "@/lib/format";
import { mergeQuotes, parseQuotes, quoteTitle, searchQuotes, type Quote } from "@/lib/quotes";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const materials = useMemo(() => {
    const names = new Set(quotes.map((quote) => quote.material).filter(Boolean));
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [quotes]);
  const visible = useMemo(() => searchQuotes(quotes, query, material), [material, query, quotes]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
              Pesquise pela medida, pelo papelão ou por um detalhe. Importe um txt no formato das caixas: medida, material e faixas de quantidade.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
              Importar txt
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
          <p className="text-sm text-mute">
            {formatInt(visible.length)} de {formatInt(quotes.length)} orçamentos
          </p>
          {(localError || error) && <p className="text-sm text-wine">{localError || error}</p>}
          {notice && <p className="text-sm text-pine">{notice}</p>}
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {!quotes.length && (
            <p className="text-sm text-mute">Nenhum orçamento ainda. Importe o txt das medidas para pesquisar aqui.</p>
          )}
          {quotes.length > 0 && !visible.length && (
            <p className="text-sm text-mute">Nenhuma caixa com essa medida ou esse papelão.</p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((quote) => (
              <article key={quote.id} className="rounded-2xl border border-line bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{quoteTitle(quote)}</h3>
                    <p className="text-sm text-mute">{quote.material || "Papelão não informado"}</p>
                  </div>
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
        </div>
      </section>
    </div>
  );
}
