import { commercialReader } from "@/lib/kommo/access";
import { privateJson } from "@/lib/kommo/http";
import { readCommercial } from "@/lib/kommo/read";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const reader = await commercialReader();
  if ("error" in reader) return privateJson({ error: reader.error }, reader.status);
  const read = await readCommercial(reader.supabase, new URL(request.url).searchParams);
  if (!read.ok) return privateJson({ error: read.error }, read.status);
  const report = read.report
    ? {
        metrics: read.report.metrics,
        grain: read.report.grain,
        series: read.report.series,
        sellers: read.report.sellers,
        funnels: read.report.funnels,
        salesPreview: read.report.sales.slice(0, 8),
        salesTotal: read.report.sales.length,
      }
    : null;
  return privateJson({ ...read, report });
}
