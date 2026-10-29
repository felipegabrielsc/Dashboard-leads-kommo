import { roundMoney } from "./parse";
import type { V4Customer, V4SummaryView } from "./types";

export type PurchaseSlice = {
  customerName: string;
  customerKey: string;
  amount: number;
  isRepurchase: boolean;
  sellerName: string;
  profit: number | null;
  alreadyInKommo: boolean;
};

export function sellerMatches(sellerName: string, selectedName: string): boolean {
  const seller = sellerName.trim().toLowerCase();
  const selected = selectedName.trim().toLowerCase();
  if (!selected) return true;
  if (!seller) return false;
  return seller.includes(selected) || selected.includes(seller);
}

export function decideBatch(activeHash: string | null, nextHash: string): "reject" | "replace" | "create" {
  if (activeHash && activeHash === nextHash) return "reject";
  if (activeHash) return "replace";
  return "create";
}

export function totalsAfterImport(
  active: { hash: string; total: number } | null,
  incoming: { hash: string; total: number },
): { decision: "reject" | "replace" | "create"; total: number } {
  const decision = decideBatch(active?.hash ?? null, incoming.hash);
  if (decision === "reject") return { decision, total: active?.total ?? incoming.total };
  return { decision, total: incoming.total };
}

export function summarizePurchases(
  rows: PurchaseSlice[],
  kommoRevenue: number,
  sellerFilter: string | null,
): Pick<
  V4SummaryView,
  | "kommoRevenue"
  | "repurchaseRevenue"
  | "consolidatedRevenue"
  | "repurchaseCount"
  | "repurchaseTicket"
  | "estimatedProfit"
  | "excludedCount"
  | "customers"
> {
  const filtered = sellerFilter ? rows.filter((row) => sellerMatches(row.sellerName, sellerFilter)) : rows;
  const included = filtered.filter((row) => row.isRepurchase && !row.alreadyInKommo);
  const repurchaseRevenue = roundMoney(included.reduce((sum, row) => sum + row.amount, 0));
  const estimatedProfit = roundMoney(filtered.reduce((sum, row) => sum + (row.profit || 0), 0));
  const customers = new Map<string, V4Customer & { sellerSet: Set<string> }>();
  for (const row of filtered) {
    const current = customers.get(row.customerKey) || {
      key: row.customerKey,
      name: row.customerName,
      purchases: 0,
      amount: 0,
      sellers: "",
      sellerSet: new Set<string>(),
    };
    current.purchases += 1;
    current.amount = roundMoney(current.amount + row.amount);
    if (row.sellerName) current.sellerSet.add(row.sellerName);
    customers.set(row.customerKey, current);
  }
  return {
    kommoRevenue,
    repurchaseRevenue,
    consolidatedRevenue: roundMoney(kommoRevenue + repurchaseRevenue),
    repurchaseCount: included.length,
    repurchaseTicket: included.length ? roundMoney(repurchaseRevenue / included.length) : null,
    estimatedProfit,
    excludedCount: filtered.filter((row) => row.isRepurchase && row.alreadyInKommo).length,
    customers: [...customers.values()]
      .map((row) => ({
        key: row.key,
        name: row.name,
        purchases: row.purchases,
        amount: row.amount,
        sellers: [...row.sellerSet].join(", "),
      }))
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "pt-BR")),
  };
}
