"use client";

import { useState } from "react";
import { GROUP_META, WEEKDAY_ORDER, WEEKDAYS, shortLabel } from "@/lib/categories";
import { formatDate, formatInt, formatPct } from "@/lib/format";
import type { MonthRow, Totals } from "@/lib/metrics";
import { topMotives } from "@/lib/metrics";
import type { Category } from "@/lib/types";

type Props = {
  totals: Totals;
  sliced: boolean;
  months: MonthRow[];
  weekdayLoads: number[];
  categories: Category[];
  onPending: () => void;
  onDivergent: () => void;
  onMotive: (id: string) => void;
  onMonth: (month: string) => void;
  comparison: {
    from: string;
    to: string;
    taxa: number | null;
    comprou: number | null;
    semRetorno: number | null;
  } | null;
  missingDays: string[];
  canFillGaps: boolean;
  onMissingDay: (date: string) => void;
};

export function Summary({
  totals,
  sliced,
  months,
  weekdayLoads,
  categories,
  onPending,
  onDivergent,
  onMotive,
  onMonth,
  comparison,
  missingDays,
  canFillGaps,
  onMissingDay,
}: Props) {
  const reasons = topMotives(totals, categories, "perdidos");
  const biggest = reasons[0];
  const maxWeekday = Math.max(1, ...weekdayLoads);
  const parts = [
    { label: "Interessados", value: totals.interesse, color: GROUP_META.interesse.bar },
    { label: "Comprou", value: totals.comprou, color: "#8fbf9a" },
    { label: "Sem retorno", value: totals.semRetorno, color: GROUP_META.sem_retorno.bar },
    { label: "Perdidos", value: totals.perdidos, color: GROUP_META.perdidos.bar },
  ];
  const partTotal = parts.reduce((sum, part) => sum + part.value, 0) || 1;

  return (
    <div className="space-y-4">
      {sliced && (
        <p className="rounded-2xl border border-brass/30 bg-brassSoft px-4 py-3 text-sm text-brass">
          Os cartões e gráficos estão no recorte dos motivos escolhidos. A lista de leads em análise
          continua no período, sem esse recorte.
        </p>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="panel flex flex-col justify-between p-5 xl:row-span-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mute">Taxa de interesse</p>
            <p className="mt-2 font-serif text-5xl text-pine">{formatPct(totals.taxaInteresse)}</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-mute">
              Interessados mais compras, divididos pelo total geral. É a mesma conta da aba Dashboard
              da planilha.
            </p>
          </div>
          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-mute">Sem currículo, engano e outros</dt>
              <dd className="font-semibold">{formatPct(totals.taxaComercial)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-mute">Interessados que compraram</dt>
              <dd className="font-semibold">{formatPct(totals.conversao)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-mute">Média por dia</dt>
              <dd className="font-semibold">{formatInt(Math.round(totals.avgPerDay))}</dd>
            </div>
          </dl>
        </article>

        <Metric label="Total geral" value={totals.totalGeral} hint="Classificados + em análise" />
        <Metric label="Interessados" value={totals.interesse} hint="Ainda sem compra fechada" tone="pine" />
        <Metric label="Comprou" value={totals.comprou} hint="Vendas lançadas no período" tone="pine" />
        <Metric label="Sem retorno" value={totals.semRetorno} hint="Conversas sem desfecho" tone="sea" />
        <Metric
          label="Perdidos"
          value={totals.perdidos}
          hint={totals.outros ? `Inclui ${formatInt(totals.outros)} em outros` : "Motivos de perda"}
          tone="wine"
        />
        <Metric
          label="Em análise"
          value={totals.analysis}
          hint={sliced ? "Fora deste recorte de motivos" : "Ainda não entraram na grade"}
          tone="brass"
        />
      </section>

      {comparison && (
        <Comparison
          from={comparison.from}
          to={comparison.to}
          currentTaxa={totals.taxaInteresse}
          currentComprou={totals.comprou}
          currentSemRetorno={totals.semRetorno}
          taxa={comparison.taxa}
          comprou={comparison.comprou}
          semRetorno={comparison.semRetorno}
        />
      )}

      {missingDays.length > 0 && (
        <MissingDays dates={missingDays} canFill={canFillGaps} onPick={onMissingDay} />
      )}

      <section className="grid gap-3 lg:grid-cols-3">
        <button type="button" onClick={onPending} className="panel p-4 text-left transition hover:border-brass/50">
          <p className="text-sm text-mute">Dias com lead em análise</p>
          <p className="mt-1 font-serif text-3xl text-brass">{formatInt(totals.pendingDays)}</p>
          <p className="mt-1 text-sm text-mute">O ❌ da planilha. Clique para ver esses dias.</p>
        </button>
        <button type="button" onClick={onDivergent} className="panel p-4 text-left transition hover:border-wine/40">
          <p className="text-sm text-mute">Dias em que a quantidade não fecha</p>
          <p className="mt-1 font-serif text-3xl">{formatInt(totals.divergentDays)}</p>
          <p className="mt-1 text-sm text-mute">A soma dos motivos difere do número anotado no dia.</p>
        </button>
        <button
          type="button"
          onClick={() => biggest && onMotive(biggest.id)}
          className="panel p-4 text-left transition hover:border-ink/30"
          disabled={!biggest}
        >
          <p className="text-sm text-mute">Maior motivo de perda</p>
          <p className="mt-1 font-serif text-3xl">{biggest ? shortLabel(categories.find((c) => c.id === biggest.id) || { id: biggest.id, label: biggest.label, group: "perdidos" }) : "—"}</p>
          <p className="mt-1 text-sm text-mute">
            {biggest ? `${formatInt(biggest.value)} no recorte. Clique para isolar.` : "Nenhuma perda no recorte."}
          </p>
        </button>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="panel p-5">
          <h2 className="font-serif text-2xl">Composição do período</h2>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-paper">
            {parts.map((part) =>
              part.value > 0 ? (
                <div
                  key={part.label}
                  style={{ width: `${(part.value / partTotal) * 100}%`, background: part.color }}
                  title={`${part.label}: ${formatInt(part.value)}`}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {parts.map((part) => (
              <li key={part.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: part.color }} />
                  {part.label}
                </span>
                <span className="font-medium">
                  {formatInt(part.value)} · {formatPct(part.value / partTotal)}
                </span>
              </li>
            ))}
          </ul>
          {totals.busiest && (
            <p className="mt-4 text-sm text-mute">
              Dia mais cheio: {formatDate(totals.busiest.date)}, com {formatInt(totals.busiest.total)} leads
              classificados.
            </p>
          )}
        </article>
        <article className="panel p-5">
          <h2 className="font-serif text-2xl">Por dia da semana</h2>
          <ul className="mt-4 space-y-2">
            {WEEKDAY_ORDER.map((id) => (
              <li key={id} className="grid grid-cols-[52px_1fr_auto] items-center gap-2 text-sm">
                <span className="text-mute">{WEEKDAYS[id].short}</span>
                <span className="h-2 overflow-hidden rounded-full bg-paper">
                  <span
                    className="block h-full rounded-full bg-ink/80"
                    style={{ width: `${(weekdayLoads[id] / maxWeekday) * 100}%` }}
                  />
                </span>
                <span className="w-10 text-right font-medium">{formatInt(weekdayLoads[id])}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <article className="panel overflow-hidden">
        <div className="flex items-end justify-between gap-3 px-5 pt-5">
          <h2 className="font-serif text-2xl">Mês a mês</h2>
          <p className="text-sm text-mute">Clique num mês para filtrar.</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-mute">
              <tr>
                {["Mês", "Dias", "Total", "Interessados", "Comprou", "Sem retorno", "Perdidos", "Taxa", "Pendências"].map(
                  (label) => (
                    <th key={label} className="px-4 py-3 font-medium">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr key={month.month} className="border-t border-line">
                  <td className="px-4 py-3">
                    <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => onMonth(month.month)}>
                      {month.label}
                    </button>
                  </td>
                  <td className="px-4 py-3">{formatInt(month.days)}</td>
                  <td className="px-4 py-3">{formatInt(month.totalGeral)}</td>
                  <td className="px-4 py-3 text-pine">{formatInt(month.interesse)}</td>
                  <td className="px-4 py-3">{formatInt(month.comprou)}</td>
                  <td className="px-4 py-3 text-sea">{formatInt(month.semRetorno)}</td>
                  <td className="px-4 py-3 text-wine">{formatInt(month.perdidos)}</td>
                  <td className="px-4 py-3">{formatPct(month.taxaInteresse)}</td>
                  <td className="px-4 py-3">{formatInt(month.pendingDays)}</td>
                </tr>
              ))}
              {!months.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-mute">
                    Nenhum mês neste recorte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function Comparison({
  from,
  to,
  currentTaxa,
  currentComprou,
  currentSemRetorno,
  taxa,
  comprou,
  semRetorno,
}: {
  from: string;
  to: string;
  currentTaxa: number;
  currentComprou: number;
  currentSemRetorno: number;
  taxa: number | null;
  comprou: number | null;
  semRetorno: number | null;
}) {
  const label = `${formatDate(from)} a ${formatDate(to)}`;
  return (
    <section className="panel p-5">
      <h2 className="font-serif text-2xl">Contra o período anterior</h2>
      <p className="mt-1 text-sm text-mute">
        Mesma quantidade de dias, imediatamente antes: {label}. A taxa muda em pontos percentuais.
      </p>
      {taxa == null || comprou == null || semRetorno == null ? (
        <p className="mt-4 text-sm text-mute">Esse intervalo anterior ainda não tem lançamento.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <CompareItem
            label="Taxa de interesse"
            current={formatPct(currentTaxa)}
            delta={pointsLabel(currentTaxa - taxa)}
            better={(currentTaxa - taxa) >= 0}
          />
          <CompareItem
            label="Comprou"
            current={formatInt(currentComprou)}
            delta={countLabel(currentComprou - comprou)}
            better={currentComprou - comprou >= 0}
          />
          <CompareItem
            label="Sem retorno"
            current={formatInt(currentSemRetorno)}
            delta={countLabel(currentSemRetorno - semRetorno)}
            better={currentSemRetorno - semRetorno <= 0}
            note="Menos é melhor"
          />
        </div>
      )}
    </section>
  );
}

function CompareItem({
  label,
  current,
  delta,
  better,
  note,
}: {
  label: string;
  current: string;
  delta: string;
  better: boolean;
  note?: string;
}) {
  return (
    <article className="rounded-2xl bg-paper px-4 py-3">
      <p className="text-sm text-mute">{label}</p>
      <p className="mt-1 font-serif text-3xl">{current}</p>
      <p className={`mt-1 text-sm font-medium ${better ? "text-pine" : "text-wine"}`}>{delta}</p>
      {note && <p className="text-xs text-mute">{note}</p>}
    </article>
  );
}

function pointsLabel(delta: number): string {
  const points = delta * 100;
  const text = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(points));
  if (Math.abs(points) < 0.05) return "Igual ao período anterior";
  return `${points > 0 ? "+" : "−"}${text} p.p. em relação ao período anterior`;
}

function countLabel(delta: number): string {
  if (delta === 0) return "Igual ao período anterior";
  return `${delta > 0 ? "+" : "−"}${formatInt(Math.abs(delta))} em relação ao período anterior`;
}

function MissingDays({
  dates,
  canFill,
  onPick,
}: {
  dates: string[];
  canFill: boolean;
  onPick: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? dates : dates.slice(0, 12);
  return (
    <section className="panel p-5">
      <h2 className="font-serif text-2xl">Dias úteis sem lançamento</h2>
      <p className="mt-1 text-sm text-mute">
        {formatInt(dates.length)} {dates.length === 1 ? "dia de semana" : "dias de semana"} neste período ainda não têm linha na grade. Sábado e domingo ficam de fora.
        {canFill ? " Clique numa data para lançar esse dia." : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {shown.map((date) =>
          canFill ? (
            <button key={date} type="button" className="chip" onClick={() => onPick(date)}>
              {formatDate(date)}
            </button>
          ) : (
            <span key={date} className="chip">
              {formatDate(date)}
            </span>
          ),
        )}
      </div>
      {dates.length > 12 && (
        <button type="button" className="mt-3 text-sm text-mute underline-offset-2 hover:underline" onClick={() => setOpen((value) => !value)}>
          {open ? "Mostrar menos" : `Ver os ${formatInt(dates.length - 12)} restantes`}
        </button>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "ink" | "pine" | "sea" | "wine" | "brass";
}) {
  const color = {
    ink: "text-ink",
    pine: "text-pine",
    sea: "text-sea",
    wine: "text-wine",
    brass: "text-brass",
  }[tone];
  return (
    <article className="panel p-5">
      <p className="text-sm text-mute">{label}</p>
      <p className={`mt-2 font-serif text-4xl ${color}`}>{formatInt(value)}</p>
      <p className="mt-2 text-sm text-mute">{hint}</p>
    </article>
  );
}
