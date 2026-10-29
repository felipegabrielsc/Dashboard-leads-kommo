import Link from "next/link";
import { formatBrl, formatInt } from "@/lib/format";
import type { V4SummaryView } from "@/lib/v4/types";
import { MetricCard } from "./MetricCard";

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function V4Panel({ summary, importHref }: { summary: V4SummaryView; importHref: string }) {
  if (!summary.ready) {
    return (
      <section className="panel p-5">
        <h2 className="font-serif text-2xl">Recompras V4</h2>
        <p className="mt-2 text-sm text-mute">
          Para separar primeira compra e recompra, execute <span className="font-medium text-ink">supabase/v4-vendas.sql</span> no SQL Editor.
        </p>
      </section>
    );
  }
  if (!summary.imported) {
    return (
      <section className="panel p-5">
        <h2 className="font-serif text-2xl">Recompras V4</h2>
        <p className="mt-2 text-sm text-mute">
          Nenhuma planilha ativa. Importe as vendas para mostrar recompra, primeira compra e a receita consolidada.
        </p>
        <Link href={importHref} className="btn btn-primary mt-4">
          Importar planilha
        </Link>
      </section>
    );
  }
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Recompras V4</h2>
          <p className="mt-1 text-sm text-mute">
            Planilha {summary.batch?.fileName || "ativa"}
            {summary.batch?.importedAt ? `, importada em ${when(summary.batch.importedAt)}` : ""}. Primeira compra fica de fora desta soma.
          </p>
        </div>
        <Link href={importHref} className="btn">
          Importações
        </Link>
      </div>
      {summary.note ? <p className="text-sm text-wine">{summary.note}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Receita Kommo" value={formatBrl(summary.kommoRevenue)} hint="Negócios ganhos no período, só do CRM." />
        <MetricCard
          label="Receita de recompras V4"
          value={formatBrl(summary.repurchaseRevenue)}
          hint="Recompras do período que não foram marcadas como já registradas no Kommo."
        />
        <MetricCard
          label="Receita consolidada"
          value={formatBrl(summary.consolidatedRevenue)}
          hint="Receita Kommo mais as recompras V4 ainda não conciliadas."
        />
        <MetricCard label="Quantidade de recompras" value={formatInt(summary.repurchaseCount)} hint="Linhas com número da compra maior que 1, neste período." />
        <MetricCard
          label="Ticket médio de recompras"
          value={summary.repurchaseTicket == null ? "—" : formatBrl(summary.repurchaseTicket)}
          hint="Receita de recompras V4 ÷ quantidade de recompras."
        />
        <MetricCard
          label="Lucro estimado V4"
          value={formatBrl(summary.estimatedProfit)}
          hint="Soma da coluna de lucro da planilha no período. O valor é estimado."
        />
      </div>
      {summary.excludedCount > 0 ? (
        <p className="text-sm text-mute">
          {formatInt(summary.excludedCount)} recompra{summary.excludedCount === 1 ? "" : "s"} marcada
          {summary.excludedCount === 1 ? "" : "s"} como já presente no Kommo ficou de fora da receita consolidada.
        </p>
      ) : null}
      <article className="panel min-w-0 p-5">
        <h3 className="font-serif text-xl">Clientes da planilha</h3>
        <p className="mt-1 text-sm text-mute">Compras do período, com primeira compra e recompra juntas, para conferir a origem de cada total.</p>
        {summary.customers.length ? (
          <div className="mt-4 max-w-full overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-mute">
                <tr>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium">Compras</th>
                  <th className="py-2 pr-3 font-medium">Valor</th>
                  <th className="py-2 font-medium">Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {summary.customers.map((customer) => (
                  <tr key={customer.key} className="border-t border-line">
                    <td className="py-2 pr-3">{customer.name}</td>
                    <td className="py-2 pr-3">{formatInt(customer.purchases)}</td>
                    <td className="py-2 pr-3">{formatBrl(customer.amount)}</td>
                    <td className="py-2">{customer.sellers || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-mute">Nenhuma venda V4 neste período.</p>
        )}
      </article>
    </section>
  );
}
