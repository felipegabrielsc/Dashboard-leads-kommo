import type { V4Row } from "./types";

export type CustomerSale = {
  id: string;
  saleDate: string;
  purchaseNumber: number;
};

export function followingPurchases<T extends CustomerSale>(saleId: string, customerSales: T[]): T[] {
  const ordered = [...customerSales].sort(
    (a, b) => a.saleDate.localeCompare(b.saleDate) || a.purchaseNumber - b.purchaseNumber || a.id.localeCompare(b.id),
  );
  const index = ordered.findIndex((item) => item.id === saleId);
  if (index < 0) return [];
  const following: T[] = [];
  for (const item of ordered.slice(index + 1)) {
    if (item.purchaseNumber <= 1) break;
    following.push(item);
  }
  return following;
}

export function followingRows(rows: V4Row[], sourceRow: number): V4Row[] {
  const row = rows.find((item) => item.sourceRow === sourceRow);
  if (!row) return [];
  const siblings = rows
    .filter((item) => item.customerKey === row.customerKey)
    .map((item) => ({ id: String(item.sourceRow).padStart(9, "0"), saleDate: item.saleDate, purchaseNumber: item.purchaseNumber, row: item }));
  return followingPurchases(String(sourceRow).padStart(9, "0"), siblings).map((item) => item.row);
}

export function inheritedLinks(rows: V4Row[], picked: Map<number, number>): Map<number, number> {
  const inherited = new Map<number, number>();
  for (const [sourceRow, leadId] of picked) {
    for (const next of followingRows(rows, sourceRow)) {
      if (!picked.has(next.sourceRow) && !inherited.has(next.sourceRow)) inherited.set(next.sourceRow, leadId);
    }
  }
  return inherited;
}
