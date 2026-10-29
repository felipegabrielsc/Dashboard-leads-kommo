import { commercialReader } from "@/lib/kommo/access";
import { privateJson } from "@/lib/kommo/http";
import { loadPagedSales } from "@/lib/kommo/reportQuery";
import { readCommercial } from "@/lib/kommo/read";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  const reader = await commercialReader();
  if ("error" in reader) return privateJson({ error: reader.error }, reader.status);
  const search = new URL(request.url).searchParams;
  const read = await readCommercial(reader.supabase, search);
  if (!read.ok) return privateJson({ error: read.error }, read.status);
  const page = Math.max(1, Math.floor(Number(search.get("page")) || 1));
  const paged = await loadPagedSales(
    reader.supabase,
    search,
    read.report?.sales || [],
    read.aggregated,
    page,
    PAGE_SIZE,
  );
  return privateJson({
    ...read,
    report: undefined,
    metrics: read.report?.metrics || null,
    sales: paged.sales,
    salesTotal: read.aggregated ? paged.salesTotal : read.salesTotal,
    matchTotal: paged.matchTotal,
    page: paged.page,
    pageSize: paged.pageSize,
  });
}
