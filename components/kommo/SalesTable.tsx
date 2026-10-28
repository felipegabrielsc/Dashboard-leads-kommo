import { formatBrl, formatDate } from "@/lib/format";
import { dayInSaoPaulo } from "@/lib/kommo/metrics";
import type { SaleRow } from "@/lib/kommo/types";

export function SalesTable({ sales }: { sales: SaleRow[] }) {
  if (!sales.length) {
    return <p className="text-sm text-mute">Nenhuma venda ganha neste recorte.</p>;
  }
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-mute">
          <tr>
            <th className="py-2 pr-3 font-medium">ID Kommo</th>
            <th className="py-2 pr-3 font-medium">Negócio</th>
            <th className="py-2 pr-3 font-medium">Fechamento</th>
            <th className="py-2 pr-3 font-medium">Valor</th>
            <th className="py-2 pr-3 font-medium">Vendedor</th>
            <th className="py-2 pr-3 font-medium">Funil</th>
            <th className="py-2 font-medium">Etapa</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => {
            const day = dayInSaoPaulo(sale.closedAt);
            return (
              <tr key={sale.id} className="border-t border-line">
                <td className="py-2 pr-3">
                  {sale.url ? (
                    <a href={sale.url} target="_blank" rel="noreferrer" className="underline">
                      #{sale.id}
                    </a>
                  ) : (
                    `#${sale.id}`
                  )}
                </td>
                <td className="py-2 pr-3">{sale.name}</td>
                <td className="py-2 pr-3">{day ? formatDate(day) : "sem data"}</td>
                <td className="py-2 pr-3">{formatBrl(sale.price)}</td>
                <td className="py-2 pr-3">{sale.userName}</td>
                <td className="py-2 pr-3">{sale.pipelineName || "—"}</td>
                <td className="py-2">{sale.statusName || "Ganho"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
