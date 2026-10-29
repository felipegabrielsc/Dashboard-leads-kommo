import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCommercialFilters } from "../kommo/filters";
import { relationMissing } from "../kommo/rpcError";
import { roundMoney } from "./parse";
import { sellerMatches } from "./consolidate";

export type RepurchaseLine = {
  id: string;
  saleDate: string;
  customerName: string;
  amount: number;
  purchaseNumber: number;
  sellerName: string;
  alreadyInKommo: boolean;
};

export type RepurchaseAudit = {
  ready: boolean;
  imported: boolean;
  rows: RepurchaseLine[];
  count: number;
  revenue: number;
  ticket: number | null;
  excludedCount: number;
};

const emptyAudit = (partial: Partial<RepurchaseAudit> = {}): RepurchaseAudit => ({
  ready: false,
  imported: false,
  rows: [],
  count: 0,
  revenue: 0,
  ticket: null,
  excludedCount: 0,
  ...partial,
});

export async function loadRepurchaseAudit(
  supabase: SupabaseClient,
  search: URLSearchParams,
  users: { id: number; name: string }[],
): Promise<RepurchaseAudit> {
  const filters = parseCommercialFilters(search);
  if ("error" in filters) return emptyAudit();
  const seller = users.find((user) => user.id === filters.userId)?.name || "";
  const query = (search.get("q") || "").trim().toLowerCase();
  try {
    const batchResult = await supabase
      .from("v4_import_batches")
      .select("id")
      .eq("status", "active")
      .order("imported_at", { ascending: false })
      .limit(1);
    if (batchResult.error) {
      if (relationMissing(batchResult.error)) return emptyAudit();
      return emptyAudit({ ready: true });
    }
    const batch = batchResult.data?.[0];
    if (!batch) return emptyAudit({ ready: true, imported: false });
    const rows: RepurchaseLine[] = [];
    const pageSize = 1000;
    for (let start = 0; ; start += pageSize) {
      const { data, error } = await supabase
        .from("v4_sales")
        .select("id,sale_date,customer_name,amount,purchase_number,seller_name,already_in_kommo")
        .eq("import_batch_id", batch.id)
        .eq("is_repurchase", true)
        .gte("sale_date", filters.from)
        .lte("sale_date", filters.to)
        .order("sale_date", { ascending: false })
        .order("id")
        .range(start, start + pageSize - 1);
      if (error) return emptyAudit({ ready: true, imported: true });
      for (const row of data || []) {
        rows.push({
          id: String(row.id),
          saleDate: String(row.sale_date || ""),
          customerName: String(row.customer_name || ""),
          amount: Number(row.amount) || 0,
          purchaseNumber: Number(row.purchase_number) || 0,
          sellerName: String(row.seller_name || ""),
          alreadyInKommo: Boolean(row.already_in_kommo),
        });
      }
      if (!data || data.length < pageSize) break;
    }
    const filtered = rows.filter((row) => {
      if (seller && !sellerMatches(row.sellerName, seller)) return false;
      if (!query) return true;
      return row.customerName.toLowerCase().includes(query) || row.sellerName.toLowerCase().includes(query);
    });
    const included = filtered.filter((row) => !row.alreadyInKommo);
    const revenue = roundMoney(included.reduce((sum, row) => sum + row.amount, 0));
    return {
      ready: true,
      imported: true,
      rows: filtered,
      count: included.length,
      revenue,
      ticket: included.length ? roundMoney(revenue / included.length) : null,
      excludedCount: filtered.filter((row) => row.alreadyInKommo).length,
    };
  } catch (error) {
    if (relationMissing(error)) return emptyAudit();
    return emptyAudit({ ready: true });
  }
}
