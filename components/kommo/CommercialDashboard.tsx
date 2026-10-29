"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatBrl, formatDate, formatInt, formatPct } from "@/lib/format";
import { exampleFilters, exampleReport } from "@/lib/kommo/sample";
import type { CommercialReport, PublicSync, SaleRow } from "@/lib/kommo/types";
import type { V4SummaryView } from "@/lib/v4/types";
import { DashboardFilters } from "./DashboardFilters";
import { FunnelChart } from "./FunnelChart";
import { KommoShell } from "./KommoShell";
import { MetricCard } from "./MetricCard";
import { SalesTable } from "./SalesTable";
import { SetupChecklist } from "./SetupChecklist";
import { SyncStatus } from "./SyncStatus";
import { V4Panel } from "./V4Panel";
import { readViewCache, writeViewCache } from "@/lib/kommo/viewCache";
import { commercialSearch } from "./query";
import { useCommercialQuery } from "./useCommercialQuery";

const SalesChart = dynamic(() => import("./SalesChart").then((mod) => mod.SalesChart), {
  ssr: false,
  loading: () => <p className="panel p-5 text-sm text-mute">Carregando o gráfico…</p>,
});

const SellersRanking = dynamic(() => import("./SellersRanking").then((mod) => mod.SellersRanking), {
  ssr: false,
  loading: () => <p className="panel p-5 text-sm text-mute">Carregando o ranking…</p>,
});

type ReportView = {
  metrics: CommercialReport["metrics"];
  grain: CommercialReport["grain"];
  series: CommercialReport["series"];
  sellers: CommercialReport["sellers"];
  funnels: CommercialReport["funnels"];
  salesPreview: SaleRow[];
  salesTotal: number;
};

type DashboardResponse = {
  configured: boolean;
  tablesReady: boolean;
  provisional: boolean;
  sync: PublicSync | null;
  pipelines: { id: number; name: string }[];
  users: { id: number; name: string }[];
  report: ReportView | null;
  notice: string;
  v4: V4SummaryView | null;
  error: string;
};

function preview(report: CommercialReport): ReportView {
  return {
    metrics: report.metrics,
    grain: report.grain,
    series: report.series,
    sellers: report.sellers,
    funnels: report.funnels,
    salesPreview: report.sales.slice(0, 8),
    salesTotal: report.sales.length,
  };
}

export function CommercialDashboard() {
  const query = useCommercialQuery();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [status, setStatus] = useState(0);
  const [failure, setFailure] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const search = commercialSearch({
      from: query.from,
      to: query.to,
      pipeline: query.pipeline,
      user: query.user,
    });
    const url = `/api/kommo/dashboard?${search}`;
    const cached = readViewCache<DashboardResponse>(url);
    if (cached) {
      setData(cached);
      setStatus(200);
      setFailure("");
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setStatus(response.status);
          setData(null);
          setFailure(typeof body.error === "string" ? body.error : "Não consegui carregar o comercial.");
          return;
        }
        setStatus(200);
        setFailure("");
        setData(body as DashboardResponse);
        writeViewCache(url, body);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) setFailure("Não consegui carregar o comercial.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query.from, query.pipeline, query.to, query.user]);

  const sample = status === 503 || Boolean(data && (!data.configured || !data.tablesReady));
  const report = sample ? preview(exampleReport()) : data?.report || null;
  const painelHref = `/kommo?${query.query}`;
  const vendasHref = `/kommo/vendas?${query.query}`;
  const importHref = `/kommo/importacoes?${query.query}`;
  const shownFrom = sample ? exampleFilters.from : query.from;
  const shownTo = sample ? exampleFilters.to : query.to;

  return (
    <KommoShell
      title="Comercial Kommo"
      description="Vendas, receita, conversão e funis dos negócios do Kommo. Os lançamentos do dia a dia continuam na outra tela."
      active="painel"
      painelHref={painelHref}
      vendasHref={vendasHref}
      importHref={importHref}
    >
      {status === 401 ? (
        <section className="panel p-5">
          <h2 className="font-serif text-2xl">Entre para ver o comercial</h2>
          <p className="mt-2 text-sm text-mute">Receita e vendedores ficam visíveis só para quem está logado.</p>
          <Link href={`/login?next=${encodeURIComponent(painelHref)}`} className="btn btn-primary mt-4">
            Entrar
          </Link>
        </section>
      ) : null}

      {sample ? (
        <>
          <p className="rounded-2xl border border-brass/40 bg-brassSoft px-4 py-3 text-sm">
            Amostra de outubro de 2026 para mostrar o layout. Estes números não vieram da sua conta Kommo.
          </p>
          <SetupChecklist message={data?.error || failure} />
        </>
      ) : null}

      {loading && !report ? <p className="text-sm text-mute">Carregando o comercial…</p> : null}

      {!sample && data?.configured && !data.report && !loading ? (
        <section className="panel p-5">
          <h2 className="font-serif text-2xl">Ainda não há negócios importados</h2>
          <p className="mt-2 text-sm text-mute">
            Abra as configurações e traga o histórico. A tela passa a usar os negócios reais quando a primeira leitura terminar.
          </p>
          <Link href="/kommo/configuracoes" className="btn btn-primary mt-4">
            Abrir configurações
          </Link>
        </section>
      ) : null}
      {!sample && !report && data?.v4 ? <V4Panel summary={data.v4} importHref={importHref} /> : null}

      {report ? (
        <>
          {!sample && data ? <SyncStatus sync={data.sync} provisional={data.provisional} error={data.error} /> : null}
          {!sample && data?.notice ? <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-mute">{data.notice}</p> : null}
          <DashboardFilters
            from={shownFrom}
            to={shownTo}
            pipeline={sample ? "" : query.pipeline}
            user={sample ? "" : query.user}
            pipelines={sample ? [] : data?.pipelines || []}
            users={sample ? [] : data?.users || []}
            disabled={sample}
            onChange={(next) => query.update(next)}
          />
          <p className="text-sm text-mute">
            Período {formatDate(shownFrom)} a {formatDate(shownTo)}, no fuso de São Paulo.
          </p>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Novos leads" value={formatInt(report.metrics.newLeads)} hint="Negócios distintos criados no período." />
            <MetricCard
              label="Vendas ganhas"
              value={formatInt(report.metrics.wonCount)}
              hint="Negócios distintos ganhos no período. Abre a lista usada na conta."
              href={sample ? undefined : vendasHref}
            />
            <MetricCard
              label="Receita de vendas"
              value={formatBrl(report.metrics.revenue)}
              hint="Soma do valor atual dos negócios ganhos no período."
            />
            <MetricCard
              label="Ticket médio"
              value={report.metrics.averageTicket == null ? "—" : formatBrl(report.metrics.averageTicket)}
              hint="Receita de vendas ÷ vendas ganhas."
            />
            <article className="panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-mute">Conversão</p>
              <p className="mt-2 text-sm">
                Do período{" "}
                <span className="font-serif text-2xl">
                  {report.metrics.conversionPeriod == null ? "—" : formatPct(report.metrics.conversionPeriod)}
                </span>
              </p>
              <p className="mt-1 text-sm">
                Da safra{" "}
                <span className="font-serif text-2xl">
                  {report.metrics.conversionCohort == null ? "—" : formatPct(report.metrics.conversionCohort)}
                </span>
              </p>
              <p className="mt-2 text-xs leading-5 text-mute">
                Do período: vendas fechadas no intervalo ÷ leads criados no intervalo. Da safra: leads criados no intervalo
                que hoje estão ganhos ÷ leads criados no intervalo.
              </p>
            </article>
            <MetricCard
              label="Vendas perdidas"
              value={formatInt(report.metrics.lostCount)}
              hint="Negócios encerrados como perdidos no período."
            />
            <MetricCard
              label="Em negociação"
              value={formatInt(report.metrics.openCount)}
              hint="Carteira aberta neste momento. O período não altera este número."
            />
            <MetricCard
              label="Valor em aberto"
              value={formatBrl(report.metrics.openValue)}
              hint="Soma dos negócios abertos neste momento. O período não altera este número."
            />
          </section>
          {report.metrics.wonWithoutClose > 0 ? (
            <p className="text-sm text-mute">
              {formatInt(report.metrics.wonWithoutClose)} negócio{report.metrics.wonWithoutClose === 1 ? "" : "s"} ganho
              {report.metrics.wonWithoutClose === 1 ? "" : "s"} sem data de fechamento. Entra na safra e fica de fora das
              vendas do período.
            </p>
          ) : null}
          {!sample && data?.v4 ? <V4Panel summary={data.v4} importHref={importHref} /> : null}
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            <SalesChart series={report.series} grain={report.grain} />
            <SellersRanking sellers={report.sellers} />
          </div>
          <FunnelChart funnels={report.funnels} />
          <article className="panel min-w-0 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">Vendas do período</h2>
                <p className="mt-1 text-sm text-mute">
                  {formatInt(report.salesTotal)} negócios entram na conta de vendas ganhas.
                </p>
              </div>
              {sample ? null : (
                <Link href={vendasHref} className="btn">
                  Abrir auditoria
                </Link>
              )}
            </div>
            <div className="mt-4">
              <SalesTable sales={report.salesPreview} />
            </div>
          </article>
        </>
      ) : null}
      {!sample && failure && status !== 401 ? <p className="text-sm text-wine">{failure}</p> : null}
    </KommoShell>
  );
}
