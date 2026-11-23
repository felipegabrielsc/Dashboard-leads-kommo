import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCommercialFilters } from "../kommo/filters";
import { relationMissing } from "../kommo/rpcError";
import { roundMoney } from "./parse";
import { sellerMatches } from "./consolidate";
import { activeBatch, currentSales, leadNames, manualReady, type SaleSource } from "./store";

export type RepurchaseLine = {
  id: string;
  saleDate: string;
  customerName: string;
  amount: number;
  purchaseNumber: number;
  isRepurchase: boolean;
  sellerName: string;
  profit: number | null;
  source: SaleSource;
  alreadyInKommo: boolean;
  kommoLeadId: number | null;
  kommoName: string;
  kommoUrl: string;
};

export type RepurchaseAudit = {
  ready: boolean;
  imported: boolean;
  manualReady: boolean;
  batchFileName: string;
  rows: RepurchaseLine[];
  count: number;
  revenue: number;
  ticket: number | null;
  excludedCount: number;
  manualCount: number;
};

const emptyAudit = (partial: Partial<RepurchaseAudit> = {}): RepurchaseAudit => ({
  ready: false,
  imported: false,
  manualReady: false,
  batchFileName: "",
  rows: [],
  count: 0,
  revenue: 0,
  ticket: null,
  excludedCount: 0,
  manualCount: 0,
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
  let batch;
  let manual = false;
  try {
    batch = await activeBatch(supabase);
    manual = await manualReady(supabase);
  } catch (error) {
    if (relationMissing(error)) return emptyAudit();
    return emptyAudit({ ready: true });
  }
  const base = { ready: true, manualReady: manual, batchFileName: batch?.file_name || "" };
  try {
    const sales = await currentSales(supabase, { batchId: batch?.id || null, manual }, { from: filters.from, to: filters.to });
    const names = await leadNames(
      supabase,
      sales.flatMap((row) => (row.kommo_lead_id == null ? [] : [Number(row.kommo_lead_id)])),
    );
    const rows: RepurchaseLine[] = sales.map((row) => {
      const leadId = row.kommo_lead_id == null ? null : Number(row.kommo_lead_id);
      const lead = leadId == null ? undefined : names.get(leadId);
      return {
        id: String(row.id),
        saleDate: String(row.sale_date || ""),
        customerName: String(row.customer_name || ""),
        amount: Number(row.amount) || 0,
        purchaseNumber: Number(row.purchase_number) || 0,
        isRepurchase: Boolean(row.is_repurchase),
        sellerName: String(row.seller_name || ""),
        profit: row.profit == null ? null : Number(row.profit),
        source: row.source,
        alreadyInKommo: Boolean(row.already_in_kommo),
        kommoLeadId: leadId,
        kommoName: lead?.name || "",
        kommoUrl: lead?.url || "",
      };
    });
    const filtered = rows.filter((row) => {
      if (seller && !sellerMatches(row.sellerName, seller)) return false;
      if (!query) return true;
      return (
        row.customerName.toLowerCase().includes(query) ||
        row.sellerName.toLowerCase().includes(query) ||
        row.kommoName.toLowerCase().includes(query) ||
        String(row.kommoLeadId || "") === query
      );
    });
    const repurchases = filtered.filter((row) => row.isRepurchase);
    const included = repurchases.filter((row) => !row.alreadyInKommo);
    const revenue = roundMoney(included.reduce((sum, row) => sum + row.amount, 0));
    const manualCount = repurchases.filter((row) => row.source === "manual").length;
    return {
      ...base,
      imported: Boolean(batch) || rows.some((row) => row.source === "manual"),
      rows: filtered,
      count: included.length,
      revenue,
      ticket: included.length ? roundMoney(revenue / included.length) : null,
      excludedCount: repurchases.filter((row) => row.alreadyInKommo).length,
      manualCount,
    };
  } catch (error) {
    if (relationMissing(error)) return emptyAudit();
    return emptyAudit({ ...base, imported: Boolean(batch) });
  }
}
