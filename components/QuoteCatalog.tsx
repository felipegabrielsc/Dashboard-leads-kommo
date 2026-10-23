"use client";

import { formatBrl } from "@/lib/format";
import { displayNote, formatCm, groupQuotes, lowestUnitPrice, tierQuantityLabel, type Quote } from "@/lib/quotes";

export function QuoteCatalog({
  quotes,
  filtered,
  prices,
  onPrices,
}: {
  quotes: Quote[];
  filtered: boolean;
  prices: boolean;
  onPrices: (prices: boolean) => void;
}) {
  const groups = groupQuotes(quotes);
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-ink px-6 py-6 text-paper">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e7d7b4]">Para divulgar</p>
        <h3 className="mt-2 font-serif text-4xl">{prices ? "Catálogo de caixas" : "Catálogo de medidas"}</h3>
        <p className="mt-2 max-w-xl text-sm text-paper/80">
          As medidas saem em centímetros. Corte e vinco fica numa seção própria, marcado em cada caixa.
          {prices ? " Os valores continuam por unidade, conforme a quantidade." : " Esta versão não leva preços."}
          {filtered ? " O PDF usa só este recorte." : " O PDF leva estas mesmas caixas."}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm ${prices ? "bg-paper text-ink" : "border border-paper/40 text-paper"}`}
            onClick={() => onPrices(true)}
          >
            Com preços
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm ${prices ? "border border-paper/40 text-paper" : "bg-paper text-ink"}`}
            onClick={() => onPrices(false)}
          >
            Só medidas
          </button>
        </div>
      </div>
      {!quotes.length && <p className="text-sm text-mute">Nenhuma caixa neste recorte.</p>}
      {groups.map((group) => (
        <section key={group.key}>
          <h4 className={`font-serif text-2xl ${group.family === "corte_vinco" ? "text-brass" : "text-pine"}`}>{group.label}</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {group.quotes.map((quote) => (
              <article key={quote.id} className="rounded-2xl border border-line bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {quote.family === "corte_vinco" && (
                      <p className="mb-2 inline-flex rounded-full bg-brassSoft px-2 py-0.5 text-xs font-medium text-brass">
                        Corte e vinco
                      </p>
                    )}
                    <p className="font-serif text-3xl leading-none">
                      {formatCm(quote.width)} × {formatCm(quote.depth)} × {formatCm(quote.height)}
                      <span className="ml-2 text-lg text-mute">cm</span>
                    </p>
                    {displayNote(quote) && <p className="mt-2 text-sm text-mute">{displayNote(quote)}</p>}
                  </div>
                  {prices && (
                    <p className="rounded-full bg-pineSoft px-3 py-1 text-right text-xs font-medium text-pine">
                      a partir de
                      <span className="mt-0.5 block text-sm">{formatBrl(lowestUnitPrice(quote))}</span>
                    </p>
                  )}
                </div>
                {prices && (
                <ul className="mt-3 divide-y divide-line text-sm">
                  {quote.tiers.map((tier) => (
                    <li key={`${tier.quantity}-${tier.detail || ""}`} className="flex items-center justify-between py-1.5">
                      <span className="text-mute">{tierQuantityLabel(tier)}</span>
                      <span className="font-medium">{formatBrl(tier.unitPrice)}</span>
                    </li>
                  ))}
                </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
