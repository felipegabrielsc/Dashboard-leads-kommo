import { commercialReader } from "@/lib/kommo/access";
import { privateJson } from "@/lib/kommo/http";
import { relationMissing } from "@/lib/kommo/rpcError";

export const dynamic = "force-dynamic";

export async function GET() {
  const reader = await commercialReader();
  if ("error" in reader) return privateJson({ error: reader.error }, reader.status);
  const { data, error } = await reader.supabase
    .from("v4_import_batches")
    .select("id,file_name,imported_at,row_count,first_count,repurchase_count,total_amount,first_amount,repurchase_amount,status")
    .order("imported_at", { ascending: false })
    .limit(20);
  if (error) {
    if (relationMissing(error)) return privateJson({ ready: false, batches: [] });
    return privateJson({ error: "Não consegui ler o histórico de importações." }, 500);
  }
  return privateJson({
    ready: true,
    batches: (data || []).map((row) => ({
      id: String(row.id),
      fileName: String(row.file_name || ""),
      importedAt: String(row.imported_at || ""),
      rowCount: Number(row.row_count) || 0,
      firstCount: Number(row.first_count) || 0,
      repurchaseCount: Number(row.repurchase_count) || 0,
      totalAmount: Number(row.total_amount) || 0,
      firstAmount: Number(row.first_amount) || 0,
      repurchaseAmount: Number(row.repurchase_amount) || 0,
      status: row.status === "active" ? "active" : "replaced",
    })),
  });
}
