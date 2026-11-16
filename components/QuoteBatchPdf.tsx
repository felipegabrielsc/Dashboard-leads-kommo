"use client";

import { useMemo, useRef, useState } from "react";
import { formatBrl, formatInt } from "@/lib/format";
import { displayNote, formatMeasuresCm, groupQuotes, parseQuotes, tierQuantityLabel } from "@/lib/quotes";
import type { CatalogIdentity } from "@/lib/types";

const PLACEHOLDER = `Caixa 220 x 220 x 160
Papelão Onda B
100 Caixas R$ 2,92
200 Caixas R$ 2,50

Caixa 150 x 90 x 220
Papelão Onda B
100 Caixas R$ 1,35`;

export function QuoteBatchPdf({
  text,
  clientName,
  identity,
  onText,
  onClientName,
}: {
  text: string;
  clientName: string;
  identity: CatalogIdentity;
  onText: (text: string) => void;
  onClientName: (name: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const quotes = useMemo(() => parseQuotes(text), [text]);
  const groups = useMemo(() => groupQuotes(quotes), [quotes]);
  const hasText = text.trim().length > 0;
  const blocked = hasText && quotes.length === 0;

  async function readFile(file: File) {
    setNotice("");
    onText(await file.text());
  }

  async function download() {
    if (!quotes.length) return;
    setNotice("");
    const { downloadQuoteBatchPdf } = await import("@/lib/catalogPdf");
    downloadQuoteBatchPdf(quotes, clientName, identity);
    const count = `${formatInt(quotes.length)} ${quotes.length === 1 ? "caixa" : "caixas"}`;
    setNotice(`PDF com ${count} baixado. Nada entrou na lista de orçamentos.`);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-ink px-6 py-6 text-paper">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e7d7b4]">Pedido avulso</p>
        <h3 className="mt-2 font-serif text-4xl">PDF de um txt</h3>
        <p className="mt-2 max-w-xl text-sm text-paper/80">
          Cole as medidas do cliente ou solte o arquivo. O PDF sai organizado, em centímetros, e não fica salvo.
        </p>
      </div>

      <label className="block text-sm">
        Cliente no PDF
        <input
          className="field mt-1"
          placeholder="Nome de quem pediu, se quiser"
          value={clientName}
          onChange={(event) => onClientName(event.target.value)}
        />
      </label>

      <div
        className={`rounded-2xl border border-dashed p-3 ${dragging ? "border-pine bg-pineSoft" : "border-line bg-paper"}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void readFile(file);
        }}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-mute">Cada bloco começa com Caixa ou com as três medidas, e o valor.</p>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Escolher txt
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void readFile(file);
            }}
          />
        </div>
        <textarea
          className="field min-h-56 font-mono text-sm"
          placeholder={PLACEHOLDER}
          value={text}
          spellCheck={false}
          onChange={(event) => {
            setNotice("");
            onText(event.target.value);
          }}
        />
      </div>

      {blocked && (
        <p className="text-sm text-wine">
          Não encontrei caixas nesse texto. Cada bloco começa com Caixa ou só com as três medidas, e o valor.
        </p>
      )}
      {notice && <p className="text-sm text-pine">{notice}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mute">
          {quotes.length
            ? `${formatInt(quotes.length)} ${quotes.length === 1 ? "caixa pronta" : "caixas prontas"} para o PDF.`
            : "Nenhuma caixa ainda."}{" "}
          O nome, o WhatsApp e a validade de cima entram no arquivo.
        </p>
        <button
          type="button"
          className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!quotes.length}
          onClick={() => void download()}
        >
          Baixar PDF
        </button>
      </div>

      {groups.map((group) => (
        <section key={group.key}>
          <h4 className={`font-serif text-2xl ${group.family === "corte_vinco" ? "text-brass" : "text-pine"}`}>{group.label}</h4>
          <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
            {group.quotes.map((quote) => (
              <article key={quote.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{formatMeasuresCm(quote)}</p>
                  {displayNote(quote) && <p className="text-sm text-mute">{displayNote(quote)}</p>}
                </div>
                <ul className="text-right text-sm">
                  {quote.tiers.map((tier) => (
                    <li key={`${tier.quantity}-${tier.detail || ""}`}>
                      <span className="text-mute">{tierQuantityLabel(tier)}</span>{" "}
                      <span className="font-medium">{formatBrl(tier.unitPrice)}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
