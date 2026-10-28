import { commercialReader } from "@/lib/kommo/access";
import { privateJson } from "@/lib/kommo/http";
import { readCommercial } from "@/lib/kommo/read";
import type { SaleRow } from "@/lib/kommo/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function matches(sale: SaleRow, query: string) {
  if (!query) return true;
  return String(sale.id).includes(query) || sale.name.toLowerCase().includes(query);
}

export async function GET(request: Request) {
  const reader = await commercialReader();
  if ("error" in reader) return privateJson({ error: reader.error }, reader.status);
  const search = new URL(request.url).searchParams;
  const read = await readCommercial(reader.supabase, search);
  if (!read.ok) return privateJson({ error: read.error }, read.status);
  const query = (search.get("q") || "").trim().toLowerCase();
  const page = Math.max(1, Math.floor(Number(search.get("page")) || 1));
  const sales = read.report?.sales || [];
  const matched = sales.filter((sale) => matches(sale, query));
  const start = (page - 1) * PAGE_SIZE;
  return privateJson({
    ...read,
    report: undefined,
    metrics: read.report?.metrics || null,
    sales: matched.slice(start, start + PAGE_SIZE),
    salesTotal: sales.length,
    matchTotal: matched.length,
    page,
    pageSize: PAGE_SIZE,
  });
}
