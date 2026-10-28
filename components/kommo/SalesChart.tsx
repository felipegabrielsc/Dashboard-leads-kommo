"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBrl, formatInt } from "@/lib/format";
import type { CommercialReport } from "@/lib/kommo/types";
import { grainLabel } from "./labels";

type Point = CommercialReport["series"][number];

function Tip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-card px-3 py-2 text-sm shadow-card">
      <p className="font-medium">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="mt-1 flex items-center justify-between gap-6">
          <span className="text-mute">{item.name}</span>
          <span>{item.dataKey === "revenue" ? formatBrl(Number(item.value) || 0) : formatInt(Number(item.value) || 0)}</span>
        </p>
      ))}
    </div>
  );
}

export function SalesChart({ series, grain }: { series: Point[]; grain: CommercialReport["grain"] }) {
  return (
    <article className="panel min-w-0 p-5">
      <h2 className="font-serif text-2xl">Evolução comercial</h2>
      <p className="mt-1 text-sm text-mute">
        Leads criados, vendas ganhas e receita, {grainLabel(grain)}. Cada coluna é um intervalo com movimento.
      </p>
      <div className="mt-4 h-80 w-full min-w-0 overflow-hidden">
        {series.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series}>
              <CartesianGrid stroke="#e4dccf" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6d655c" }} />
              <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 12, fill: "#6d655c" }} width={36} />
              <YAxis yAxisId="money" orientation="right" tick={{ fontSize: 12, fill: "#6d655c" }} width={48} />
              <Tooltip content={<Tip />} />
              <Bar yAxisId="count" dataKey="leads" name="Leads" fill="#1e4d7b" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="count" dataKey="sales" name="Vendas" fill="#1b6b43" radius={[4, 4, 0, 0]} />
              <Line yAxisId="money" dataKey="revenue" name="Receita" stroke="#8a5a12" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-mute">Nenhum lead ou venda neste período.</p>
        )}
      </div>
    </article>
  );
}
