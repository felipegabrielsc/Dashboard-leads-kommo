import type { SupabaseClient } from "@supabase/supabase-js";
import { kommoCredentials, leadUrl } from "../kommo/client";
import { kommoStore } from "../kommo/db";
import { dayInSaoPaulo } from "../kommo/metrics";
import { errorText } from "../kommo/rpcError";
import { candidateWindow, rankLinkCandidates, type LinkCandidate, type ManualSale, type PreviousLink } from "./links";
import type { ManualRepurchase } from "./manual";

export type SaleSource = "planilha" | "manual";

export type SaleRow = {
  id: string;
  import_batch_id: string | null;
  source: SaleSource;
  source_row: number | null;
  sale_date: string;
  customer_name: string | null;
  customer_key: string | null;
  amount: number | string | null;
  purchase_number: number | null;
  is_repurchase: boolean | null;
  seller_name: string | null;
  profit: number | string | null;
  kommo_lead_id: number | string | null;
  already_in_kommo: boolean | null;
};

export class V4StoreError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const MIGRATION_HINT = "Execute supabase/v4-vinculos-recompras.sql no SQL Editor para liberar vínculos e recompras manuais.";

export function columnMissing(error: unknown): boolean {
  const code = error && typeof error === "object" ? (error as { code?: string }).code : "";
  const text = errorText(error).toLowerCase();
  return code === "42703" || code === "PGRST204" || (text.includes("column") && (text.includes("does not exist") || text.includes("could not find")));
}

export async function activeBatch(
  supabase: SupabaseClient,
): Promise<{ id: string; file_name: string; imported_at: string; row_count: number } | null> {
  const { data, error } = await supabase
    .from("v4_import_batches")
    .select("id,file_name,imported_at,row_count")
    .eq("status", "active")
    .order("imported_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  return row
    ? { id: String(row.id), file_name: String(row.file_name || ""), imported_at: String(row.imported_at || ""), row_count: Number(row.row_count) || 0 }
    : null;
}

export async function manualReady(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.from("v4_sales").select("source").limit(1);
  if (!error) return true;
  if (columnMissing(error)) return false;
  throw error;
}

const SALE_COLUMNS =
  "id,import_batch_id,source,source_row,sale_date,customer_name,customer_key,amount,purchase_number,is_repurchase,seller_name,profit,kommo_lead_id,already_in_kommo";
const LEGACY_COLUMNS =
  "id,import_batch_id,source_row,sale_date,customer_name,customer_key,amount,purchase_number,is_repurchase,seller_name,profit,kommo_lead_id,already_in_kommo";

export async function currentSales(
  supabase: SupabaseClient,
  scope: { batchId: string | null; manual: boolean },
  period: { from: string; to: string } | null,
  options: { repurchasesOnly?: boolean } = {},
): Promise<SaleRow[]> {
  if (!scope.batchId && !scope.manual) return [];
  const rows: SaleRow[] = [];
  const pageSize = 1000;
  const columns: string = scope.manual ? SALE_COLUMNS : LEGACY_COLUMNS;
  for (let start = 0; ; start += pageSize) {
    let query = supabase.from("v4_sales").select(columns);
    if (scope.batchId && scope.manual) query = query.or(`import_batch_id.eq.${scope.batchId},source.eq.manual`);
    else if (scope.batchId) query = query.eq("import_batch_id", scope.batchId);
    else query = query.eq("source", "manual");
    if (options.repurchasesOnly) query = query.eq("is_repurchase", true);
    if (period) query = query.gte("sale_date", period.from).lte("sale_date", period.to);
    const { data, error } = await query
      .order("sale_date", { ascending: false })
      .order("id")
      .range(start, start + pageSize - 1);
    if (error) throw error;
    const chunk = (data || []) as unknown as SaleRow[];
    for (const row of chunk) rows.push({ ...row, source: row.source === "manual" ? "manual" : "planilha" });
    if (chunk.length < pageSize) break;
  }
  return rows;
}

export async function kommoAccount(supabase: SupabaseClient): Promise<{ accountId: number; subdomain: string } | null> {
  const credentials = kommoCredentials();
  if (!credentials) return null;
  const state = await kommoStore(supabase).getState(credentials.subdomain);
  return state ? { accountId: state.accountId, subdomain: credentials.subdomain } : null;
}

type LeadDb = { id: number | string; name: string | null; price: number | string | null; closed_at: string | null; kommo_url: string | null };

function leadHint(row: LeadDb, subdomain: string) {
  const id = Number(row.id);
  return {
    id,
    name: String(row.name || ""),
    price: Number(row.price) || 0,
    closedOn: dayInSaoPaulo(row.closed_at) || "",
    url: row.kommo_url || leadUrl(subdomain, id),
  };
}

export async function leadNames(
  supabase: SupabaseClient,
  ids: number[],
): Promise<Map<number, { name: string; url: string; closedOn: string; price: number }>> {
  const names = new Map<number, { name: string; url: string; closedOn: string; price: number }>();
  const unique = [...new Set(ids)].filter((id) => Number.isFinite(id));
  if (!unique.length) return names;
  const account = await kommoAccount(supabase).catch(() => null);
  if (!account) return names;
  for (let index = 0; index < unique.length; index += 200) {
    const { data, error } = await supabase
      .from("kommo_leads")
      .select("id,name,price,closed_at,kommo_url")
      .eq("account_id", account.accountId)
      .in("id", unique.slice(index, index + 200));
    if (error) return names;
    for (const row of (data || []) as LeadDb[]) {
      const hint = leadHint(row, account.subdomain);
      names.set(hint.id, { name: hint.name, url: hint.url, closedOn: hint.closedOn, price: hint.price });
    }
  }
  return names;
}

async function loadSale(supabase: SupabaseClient, saleId: string): Promise<SaleRow> {
  if (!/^[0-9a-f-]{36}$/i.test(saleId)) throw new V4StoreError("Venda não encontrada.", 404);
  const { data, error } = await supabase.from("v4_sales").select(SALE_COLUMNS).eq("id", saleId).maybeSingle();
  if (error) {
    if (columnMissing(error)) throw new V4StoreError(MIGRATION_HINT, 503);
    throw error;
  }
  if (!data) throw new V4StoreError("Venda não encontrada.", 404);
  return data as unknown as SaleRow;
}

async function assertCurrent(supabase: SupabaseClient, sale: SaleRow): Promise<string | null> {
  const batch = await activeBatch(supabase);
  if (sale.source !== "manual" && sale.import_batch_id !== batch?.id) {
    throw new V4StoreError("Esta venda é de uma planilha substituída. Atualize a página.", 409);
  }
  return batch?.id || null;
}

async function linkedSales(supabase: SupabaseClient, batchId: string | null, leadIds: number[]): Promise<Map<number, string>> {
  const linked = new Map<number, string>();
  if (!leadIds.length) return linked;
  let query = supabase.from("v4_sales").select("id,kommo_lead_id").in("kommo_lead_id", leadIds);
  query = batchId ? query.or(`import_batch_id.eq.${batchId},source.eq.manual`) : query.eq("source", "manual");
  const { data, error } = await query;
  if (error) throw error;
  for (const row of data || []) linked.set(Number(row.kommo_lead_id), String(row.id));
  return linked;
}

function searchTerm(raw: string): string {
  return raw.replace(/[%_,()*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function loadLinkCandidates(
  supabase: SupabaseClient,
  saleId: string,
  rawQuery: string,
): Promise<{ candidates: LinkCandidate[]; window: { from: string; to: string } | null }> {
  const sale = await loadSale(supabase, saleId);
  const batchId = await assertCurrent(supabase, sale);
  const account = await kommoAccount(supabase);
  if (!account) throw new V4StoreError("Sincronize o Kommo antes de vincular vendas.", 409);
  const term = searchTerm(rawQuery);
  let query = supabase
    .from("kommo_leads")
    .select("id,name,price,closed_at,kommo_url")
    .eq("account_id", account.accountId)
    .eq("is_deleted", false)
    .eq("status_kind", "won");
  let window: { from: string; to: string } | null = null;
  if (/^\d{1,15}$/.test(term)) {
    query = query.eq("id", Number(term));
  } else if (term) {
    query = query.ilike("name", `%${term}%`).order("closed_at", { ascending: false }).limit(60);
  } else {
    window = candidateWindow(sale.sale_date);
    query = query
      .gte("closed_at", `${window.from}T03:00:00.000Z`)
      .lt("closed_at", `${window.to}T03:00:00.000Z`)
      .limit(2000);
  }
  const { data, error } = await query;
  if (error) throw error;
  const leads = ((data || []) as LeadDb[]).map((row) => leadHint(row, account.subdomain)).filter((lead) => lead.closedOn);
  const linked = await linkedSales(supabase, batchId, leads.map((lead) => lead.id));
  const candidates = rankLinkCandidates(
    { id: sale.id, saleDate: sale.sale_date, customerName: String(sale.customer_name || ""), amount: Number(sale.amount) || 0 },
    leads,
    linked,
  );
  return { candidates, window };
}

export async function linkSale(supabase: SupabaseClient, saleId: string, leadId: number, userId: string): Promise<void> {
  if (!Number.isInteger(leadId) || leadId <= 0) throw new V4StoreError("Escolha um negócio do Kommo.", 400);
  const sale = await loadSale(supabase, saleId);
  const batchId = await assertCurrent(supabase, sale);
  const account = await kommoAccount(supabase);
  if (!account) throw new V4StoreError("Sincronize o Kommo antes de vincular vendas.", 409);
  const { data: lead, error } = await supabase
    .from("kommo_leads")
    .select("id,status_kind,is_deleted")
    .eq("account_id", account.accountId)
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw error;
  if (!lead || lead.is_deleted) throw new V4StoreError("Este negócio não está no Kommo sincronizado.", 404);
  if (lead.status_kind !== "won") throw new V4StoreError("Só dá para vincular negócios ganhos no Kommo.", 409);
  const other = (await linkedSales(supabase, batchId, [leadId])).get(leadId);
  if (other && other !== sale.id) throw new V4StoreError("Este negócio do Kommo já está vinculado a outra venda.", 409);
  const update = await supabase
    .from("v4_sales")
    .update({ kommo_lead_id: leadId, already_in_kommo: true, linked_by: userId, linked_at: new Date().toISOString() })
    .eq("id", sale.id);
  if (update.error) throw update.error;
}

export async function unlinkSale(supabase: SupabaseClient, saleId: string, userId: string): Promise<void> {
  const sale = await loadSale(supabase, saleId);
  await assertCurrent(supabase, sale);
  const { error } = await supabase
    .from("v4_sales")
    .update({ kommo_lead_id: null, already_in_kommo: false, linked_by: userId, linked_at: new Date().toISOString() })
    .eq("id", sale.id);
  if (error) throw error;
}

export async function previousLinks(supabase: SupabaseClient): Promise<PreviousLink[]> {
  const batch = await activeBatch(supabase);
  if (!batch) return [];
  const { data, error } = await supabase
    .from("v4_sales")
    .select("sale_date,customer_key,amount,purchase_number,kommo_lead_id")
    .eq("import_batch_id", batch.id)
    .not("kommo_lead_id", "is", null)
    .order("source_row");
  if (error) throw error;
  return (data || []).map((row) => ({
    saleDate: String(row.sale_date),
    customerKey: String(row.customer_key || ""),
    amount: Number(row.amount) || 0,
    purchaseNumber: Number(row.purchase_number) || 0,
    kommoLeadId: Number(row.kommo_lead_id),
  }));
}

export async function manualLinkedLeads(supabase: SupabaseClient): Promise<number[]> {
  if (!(await manualReady(supabase))) return [];
  const { data, error } = await supabase
    .from("v4_sales")
    .select("kommo_lead_id")
    .eq("source", "manual")
    .not("kommo_lead_id", "is", null);
  if (error) throw error;
  return (data || []).map((row) => Number(row.kommo_lead_id));
}

export async function manualSales(supabase: SupabaseClient): Promise<ManualSale[]> {
  if (!(await manualReady(supabase))) return [];
  const rows = await currentSales(supabase, { batchId: null, manual: true }, null);
  return rows.map((row) => ({
    id: row.id,
    saleDate: row.sale_date,
    customerName: String(row.customer_name || ""),
    customerKey: String(row.customer_key || ""),
    amount: Number(row.amount) || 0,
    purchaseNumber: Number(row.purchase_number) || 0,
  }));
}

function manualColumns(value: ManualRepurchase) {
  return {
    sale_date: value.saleDate,
    customer_name: value.customerName,
    customer_key: value.customerKey,
    amount: value.amount,
    purchase_number: value.purchaseNumber,
    is_repurchase: true,
    seller_name: value.sellerName,
    profit: value.profit,
  };
}

function writeError(error: unknown): never {
  if (columnMissing(error) || errorText(error).includes("import_batch_id")) throw new V4StoreError(MIGRATION_HINT, 503);
  throw error;
}

export async function createManualRepurchase(supabase: SupabaseClient, value: ManualRepurchase, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("v4_sales")
    .insert({ ...manualColumns(value), source: "manual", import_batch_id: null, source_row: 0, created_by: userId })
    .select("id")
    .single();
  if (error) writeError(error);
  return String(data.id);
}

async function loadManual(supabase: SupabaseClient, saleId: string): Promise<SaleRow> {
  const sale = await loadSale(supabase, saleId);
  if (sale.source !== "manual") throw new V4StoreError("Vendas da planilha só mudam com uma nova importação.", 409);
  return sale;
}

export async function updateManualRepurchase(supabase: SupabaseClient, saleId: string, value: ManualRepurchase): Promise<void> {
  const sale = await loadManual(supabase, saleId);
  const { error } = await supabase
    .from("v4_sales")
    .update({ ...manualColumns(value), updated_at: new Date().toISOString() })
    .eq("id", sale.id)
    .eq("source", "manual");
  if (error) writeError(error);
}

export async function deleteManualRepurchase(supabase: SupabaseClient, saleId: string): Promise<void> {
  const sale = await loadManual(supabase, saleId);
  const { error } = await supabase.from("v4_sales").delete().eq("id", sale.id).eq("source", "manual");
  if (error) writeError(error);
}
