"use client";

import { formatBrl, formatInt } from "@/lib/format";
import { groupQuotes, lowestUnitPrice, type Quote } from "@/lib/quotes";

export function QuoteCatalog({ quotes, filtered }: { quotes: Quote[]; filtered: boolean }) {
  const groups = groupQuotes(quotes);
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-ink px-6 py-6 text-paper">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e7d7b4]">Para divulgar</p>
        <h3 className="mt-2 font-serif text-4xl">Catálogo de caixas</h3>
        <p className="mt-2 max-w-xl text-sm text-paper/80">
          {filtered
            ? "Este recorte é o que entra no PDF. Limpe a pesquisa para levar o catálogo inteiro."
            : "Valores unitários por quantidade. O PDF sai com estas mesmas caixas."}
        </p>
      </div>
      {!quotes.length && <p className="text-sm text-mute">Nenhuma caixa neste recorte.</p>}
      {groups.map((group) => (
        <section key={group.material}>
          <h4 className="font-serif text-2xl text-pine">{group.material}</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {group.quotes.map((quote) => (
              <article key={quote.id} className="rounded-2xl border border-line bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-3xl leading-none">
                      {quote.width} × {quote.depth} × {quote.height}
                    </p>
                    {quote.note && <p className="mt-2 text-sm text-mute">{quote.note}</p>}
                  </div>
                  <p className="rounded-full bg-pineSoft px-3 py-1 text-right text-xs font-medium text-pine">
                    a partir de
                    <span className="mt-0.5 block text-sm">{formatBrl(lowestUnitPrice(quote))}</span>
                  </p>
                </div>
                <ul className="mt-3 divide-y divide-line text-sm">
                  {quote.tiers.map((tier) => (
                    <li key={tier.quantity} className="flex items-center justify-between py-1.5">
                      <span className="text-mute">{formatInt(tier.quantity)} un.</span>
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
