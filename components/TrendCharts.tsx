"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortLabel } from "@/lib/categories";
import { formatInt, formatPct } from "@/lib/format";
import type { Bucket } from "@/lib/metrics";
import type { Category } from "@/lib/types";

type Reason = { id: string; label: string; value: number };

type TipPayload = { name?: string; value?: number; color?: string };

function Tip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const interesse = payload
    .filter((item) => item.name === "Interessados" || item.name === "Comprou")
    .reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  return (
    <div className="rounded-2xl border border-line bg-card px-3 py-2 text-sm shadow-card">
      <p className="font-medium">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="mt-1 flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-mute">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.name}
          </span>
          <span>{formatInt(Number(item.value) || 0)}</span>
        </p>
      ))}
      <p className="mt-2 border-t border-line pt-2">
        Total {formatInt(total)} · taxa {formatPct(total ? interesse / total : 0)}
      </p>
    </div>
  );
}

export function TrendCharts({
  buckets,
  reasons,
  categories,
}: {
  buckets: Bucket[];
  reasons: Reason[];
  categories: Category[];
}) {
  const reasonRows = reasons.slice(0, 8).map((reason) => {
    const category = categories.find((item) => item.id === reason.id);
    return {
      ...reason,
      name: category ? shortLabel(category) : reason.label,
    };
  });

  return (
    <section className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr]">
      <article className="panel p-5">
        <h2 className="font-serif text-2xl">Volume no tempo</h2>
        <p className="mt-1 text-sm text-mute">
          Cada barra empilha interessados, compras, sem retorno e perdidos.
          {buckets.length > 20 ? " Os dias foram agrupados para a leitura continuar clara." : ""}
        </p>
        <div className="mt-4 h-80">
          {buckets.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} barSize={buckets.length > 20 ? 14 : 22}>
                <CartesianGrid vertical={false} stroke="#e4dccf" />
                <XAxis dataKey="label" tick={{ fill: "#6d655c", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6d655c", fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<Tip />} cursor={{ fill: "rgba(28,25,21,0.04)" }} />
                <Bar dataKey="interesse" name="Interessados" stackId="leads" fill="#1b6b43" />
                <Bar dataKey="comprou" name="Comprou" stackId="leads" fill="#8fbf9a" />
                <Bar dataKey="semRetorno" name="Sem retorno" stackId="leads" fill="#1e4d7b" />
                <Bar dataKey="perdidos" name="Perdidos" stackId="leads" fill="#9f2d2d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </article>

      <article className="panel p-5">
        <h2 className="font-serif text-2xl">Por que se perde</h2>
        <p className="mt-1 text-sm text-mute">Os motivos de perda com volume neste recorte.</p>
        <div className="mt-4 h-80">
          {reasonRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reasonRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="#e4dccf" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={108}
                  tick={{ fill: "#1c1915", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatInt(Number(value) || 0)}
                  cursor={{ fill: "rgba(159,45,45,0.06)" }}
                />
                <Bar dataKey="value" name="Leads" fill="#9f2d2d" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </article>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl bg-paper text-sm text-mute">
      Nada para desenhar neste recorte.
    </div>
  );
}
