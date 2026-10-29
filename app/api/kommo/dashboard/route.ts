import { commercialReader } from "@/lib/kommo/access";
import { privateJson } from "@/lib/kommo/http";
import { readCommercial } from "@/lib/kommo/read";
import { loadV4Summary } from "@/lib/v4/summary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const reader = await commercialReader();
  if ("error" in reader) return privateJson({ error: reader.error }, reader.status);
  const search = new URL(request.url).searchParams;
  const read = await readCommercial(reader.supabase, search);
  if (!read.ok) return privateJson({ error: read.error }, read.status);
  const report = read.report
    ? {
        metrics: read.report.metrics,
        grain: read.report.grain,
        series: read.report.series,
        sellers: read.report.sellers,
        funnels: read.report.funnels,
        salesPreview: read.report.sales.slice(0, 8),
        salesTotal: read.salesTotal,
      }
    : null;
  const v4 = await loadV4Summary(reader.supabase, search, read.users, report?.metrics.revenue || 0);
  return privateJson({ ...read, report, v4 });
}
