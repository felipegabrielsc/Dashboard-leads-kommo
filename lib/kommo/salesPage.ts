import type { SaleRow } from "./types";

export function pageSales(sales: SaleRow[], query: string, page: number, pageSize: number) {
  const q = query.trim().toLowerCase();
  const matched = q
    ? sales.filter((sale) => String(sale.id).includes(q) || sale.name.toLowerCase().includes(q))
    : sales;
  const current = Math.max(1, page);
  const start = (current - 1) * pageSize;
  return {
    sales: matched.slice(start, start + pageSize),
    salesTotal: sales.length,
    matchTotal: matched.length,
    page: current,
    pageSize,
  };
}
