import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCommercialFilters } from "../kommo/filters";
import { relationMissing } from "../kommo/rpcError";
import { summarizePurchases, type PurchaseSlice } from "./consolidate";
import type { V4SummaryView } from "./types";

async function selectPeriodSales(supabase: SupabaseClient, batchId: string, from: string, to: string) {
  const rows: {
    customer_name: string | null;
    customer_key: string | null;
    amount: number | string | null;
    is_repurchase: boolean | null;
    seller_name: string | null;
    profit: number | string | null;
    already_in_kommo: boolean | null;
  }[] = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("v4_sales")
      .select("customer_name,customer_key,amount,is_repurchase,seller_name,profit,already_in_kommo")
      .eq("import_batch_id", batchId)
      .gte("sale_date", from)
      .lte("sale_date", to)
      .order("sale_date")
      .order("id")
      .range(start, start + pageSize - 1);
    if (error) return { data: rows, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { data: rows, error: null };
}

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
  try {
    const batchResult = await supabase
      .from("v4_import_batches")
      .select("id,file_name,imported_at,row_count")
      .eq("status", "active")
      .order("imported_at", { ascending: false })
      .limit(1);
    if (batchResult.error) {
      if (relationMissing(batchResult.error)) return emptySummary({ kommoRevenue, consolidatedRevenue: kommoRevenue });
      return emptySummary({
        ready: true,
        kommoRevenue,
        consolidatedRevenue: kommoRevenue,
        note: "Não consegui ler as recompras.",
      });
    }
    const batch = batchResult.data?.[0];
    if (!batch) return emptySummary({ ready: true, kommoRevenue, consolidatedRevenue: kommoRevenue });
    const salesResult = await selectPeriodSales(supabase, String(batch.id), filters.from, filters.to);
    const batchView = {
      fileName: String(batch.file_name || ""),
      importedAt: String(batch.imported_at || ""),
      rowCount: Number(batch.row_count) || 0,
    };
    if (salesResult.error) {
      return emptySummary({
        ready: true,
        imported: true,
        kommoRevenue,
        consolidatedRevenue: kommoRevenue,
        batch: batchView,
        note: "Não consegui ler as recompras deste período.",
      });
    }
    const rows: PurchaseSlice[] = (salesResult.data || []).map((row) => ({
      customerName: String(row.customer_name || ""),
      customerKey: String(row.customer_key || ""),
      amount: Number(row.amount) || 0,
      isRepurchase: Boolean(row.is_repurchase),
      sellerName: String(row.seller_name || ""),
      profit: row.profit == null ? null : Number(row.profit),
      alreadyInKommo: Boolean(row.already_in_kommo),
    }));
    return {
      ready: true,
      imported: true,
      ...summarizePurchases(rows, kommoRevenue, seller || null),
      batch: batchView,
      note: "",
    };
  } catch (error) {
    if (relationMissing(error)) return emptySummary({ kommoRevenue, consolidatedRevenue: kommoRevenue });
    return emptySummary({ ready: true, kommoRevenue, consolidatedRevenue: kommoRevenue, note: "Não consegui ler as recompras." });
  }
}
