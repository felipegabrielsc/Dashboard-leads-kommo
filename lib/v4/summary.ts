import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCommercialFilters } from "../kommo/filters";
import { relationMissing } from "../kommo/rpcError";
import { sellerMatches, summarizePurchases, type PurchaseSlice } from "./consolidate";
import { activeBatch, currentSales, manualReady } from "./store";
import type { V4SummaryView } from "./types";

function emptySummary(partial: Partial<V4SummaryView> = {}): V4SummaryView {
  return {
    ready: false,
    imported: false,
    kommoRevenue: 0,
    repurchaseRevenue: 0,
    consolidatedRevenue: 0,
    repurchaseCount: 0,
    repurchaseTicket: null,
    estimatedProfit: 0,
    excludedCount: 0,
    manualCount: 0,
    customers: [],
    batch: null,
    note: "",
    ...partial,
  };
}

export async function loadV4Summary(
  supabase: SupabaseClient,
  search: URLSearchParams,
  users: { id: number; name: string }[],
  kommoRevenue: number,
): Promise<V4SummaryView> {
  const filters = parseCommercialFilters(search);
  if ("error" in filters) return emptySummary({ note: filters.error, kommoRevenue, consolidatedRevenue: kommoRevenue });
  const seller = users.find((user) => user.id === filters.userId)?.name || "";
  let batch;
  let manual = false;
  try {
    batch = await activeBatch(supabase);
    manual = await manualReady(supabase);
  } catch (error) {
    if (relationMissing(error)) return emptySummary({ kommoRevenue, consolidatedRevenue: kommoRevenue });
    return emptySummary({ ready: true, kommoRevenue, consolidatedRevenue: kommoRevenue, note: "Não consegui ler as recompras." });
  }
  const batchView = batch ? { fileName: batch.file_name, importedAt: batch.imported_at, rowCount: batch.row_count } : null;
  try {
    const sales = await currentSales(supabase, { batchId: batch?.id || null, manual }, { from: filters.from, to: filters.to });
    const hasManual = sales.some((row) => row.source === "manual");
    if (!batch && !hasManual) return emptySummary({ ready: true, kommoRevenue, consolidatedRevenue: kommoRevenue });
    const rows: PurchaseSlice[] = sales.map((row) => ({
      customerName: String(row.customer_name || ""),
      customerKey: String(row.customer_key || ""),
      amount: Number(row.amount) || 0,
      isRepurchase: Boolean(row.is_repurchase),
      sellerName: String(row.seller_name || ""),
      profit: row.profit == null ? null : Number(row.profit),
      alreadyInKommo: Boolean(row.already_in_kommo),
    }));
    const manualCount = sales.filter(
      (row) => row.source === "manual" && !row.already_in_kommo && (!seller || sellerMatches(String(row.seller_name || ""), seller)),
    ).length;
    return {
      ready: true,
      imported: true,
      ...summarizePurchases(rows, kommoRevenue, seller || null),
      manualCount,
      batch: batchView,
      note: "",
    };
  } catch (error) {
    if (relationMissing(error)) return emptySummary({ kommoRevenue, consolidatedRevenue: kommoRevenue });
    return emptySummary({
      ready: true,
      imported: Boolean(batch),
      kommoRevenue,
      consolidatedRevenue: kommoRevenue,
      batch: batchView,
      note: "Não consegui ler as recompras deste período.",
    });
  }
}
