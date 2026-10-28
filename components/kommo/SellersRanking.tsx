"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBrl, formatInt, formatPct } from "@/lib/format";
import type { CommercialReport } from "@/lib/kommo/types";

export function SellersRanking({ sellers }: { sellers: CommercialReport["sellers"] }) {
  const rows = sellers.slice(0, 8).map((seller) => ({ ...seller, label: seller.name }));
  return (
    <article className="panel min-w-0 overflow-hidden p-5">
      <h2 className="font-serif text-2xl">Desempenho por vendedor</h2>
      <p className="mt-1 text-sm text-mute">
        O responsável é quem está com o negócio agora. Leads são os criados no período. Vendas são as ganhas no período.
      </p>
      <div className="mt-4 h-64 w-full min-w-0 overflow-hidden">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid stroke="#e4dccf" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6d655c" }} />
              <YAxis tick={{ fontSize: 12, fill: "#6d655c" }} width={48} />
              <Tooltip formatter={(value: number) => formatBrl(Number(value) || 0)} />
              <Bar dataKey="revenue" name="Receita" fill="#1b6b43" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-mute">Nenhum responsável neste recorte.</p>
        )}
      </div>
      <div className="mt-4 max-w-full overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-mute">
            <tr>
              <th className="py-2 pr-3 font-medium">Responsável</th>
              <th className="py-2 pr-3 font-medium">Leads</th>
              <th className="py-2 pr-3 font-medium">Vendas</th>
              <th className="py-2 pr-3 font-medium">Receita</th>
              <th className="py-2 font-medium">Conversão</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((seller) => (
              <tr key={seller.id ?? "none"} className="border-t border-line">
                <td className="py-2 pr-3">{seller.name}</td>
                <td className="py-2 pr-3">{formatInt(seller.leads)}</td>
                <td className="py-2 pr-3">{formatInt(seller.sales)}</td>
                <td className="py-2 pr-3">{formatBrl(seller.revenue)}</td>
                <td className="py-2">{seller.conversion == null ? "—" : formatPct(seller.conversion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
