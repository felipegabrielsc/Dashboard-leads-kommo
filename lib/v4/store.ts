import type { SupabaseClient } from "@supabase/supabase-js";
import { kommoCredentials, leadUrl } from "../kommo/client";
import { kommoStore } from "../kommo/db";
import { dayInSaoPaulo } from "../kommo/metrics";
import { errorText, relationMissing } from "../kommo/rpcError";
import {
  candidateWindow,
  followingPurchases,
  leadConflict,
  rankLinkCandidates,
  saoPauloClosedRange,
  type LeadUse,
  type LinkCandidate,
  type ManualSale,
  type PreviousLink,
} from "./links";
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

function scopeCurrent<Q extends { or: (filter: string) => Q; eq: (column: string, value: string) => Q }>(query: Q, batchId: string | null): Q {
  return batchId ? query.or(`import_batch_id.eq.${batchId},source.eq.manual`) : query.eq("source", "manual");
}

async function leadUses(supabase: SupabaseClient, batchId: string | null, leadIds: number[]): Promise<Map<number, LeadUse[]>> {
  const uses = new Map<number, LeadUse[]>();
  if (!leadIds.length) return uses;
  const query = supabase
    .from("v4_sales")
    .select("id,kommo_lead_id,customer_key,customer_name,already_in_kommo")
    .in("kommo_lead_id", leadIds);
  const { data, error } = await scopeCurrent(query, batchId);
  if (error) throw error;
  for (const row of data || []) {
    const leadId = Number(row.kommo_lead_id);
    const list = uses.get(leadId) || [];
    list.push({
      saleId: String(row.id),
      customerKey: String(row.customer_key || ""),
      customerName: String(row.customer_name || ""),
      alreadyInKommo: Boolean(row.already_in_kommo),
    });
    uses.set(leadId, list);
  }
  return uses;
}

async function customerSales(supabase: SupabaseClient, batchId: string | null, customerKey: string) {
  const query = supabase
    .from("v4_sales")
    .select("id,sale_date,purchase_number,kommo_lead_id,already_in_kommo")
    .eq("customer_key", customerKey);
  const { data, error } = await scopeCurrent(query, batchId);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.id),
    saleDate: String(row.sale_date),
    purchaseNumber: Number(row.purchase_number) || 0,
    kommoLeadId: row.kommo_lead_id == null ? null : Number(row.kommo_lead_id),
    alreadyInKommo: Boolean(row.already_in_kommo),
  }));
}

function searchTerm(raw: string): string {
  return raw.replace(/[%_,()*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

const LEAD_COLUMNS = "id,name,price,closed_at,kommo_url";

export async function loadLinkCandidates(
  supabase: SupabaseClient,
  saleId: string,
  rawQuery: string,
): Promise<{ candidates: LinkCandidate[]; window: { from: string; to: string } | null; followingCount: number }> {
  const sale = await loadSale(supabase, saleId);
  const batchId = await assertCurrent(supabase, sale);
  const account = await kommoAccount(supabase);
  if (!account) throw new V4StoreError("Sincronize o Kommo antes de vincular vendas.", 409);
  const term = searchTerm(rawQuery);
  const base = () =>
    supabase
      .from("kommo_leads")
      .select(LEAD_COLUMNS)
      .eq("account_id", account.accountId)
      .eq("is_deleted", false)
      .eq("status_kind", "won");
  let query = base();
  let window: { from: string; to: string } | null = null;
  if (/^\d{1,15}$/.test(term)) {
    query = query.eq("id", Number(term));
  } else if (term) {
    query = query.ilike("name", `%${term}%`).order("closed_at", { ascending: false }).limit(60);
  } else {
    window = candidateWindow(sale.sale_date);
    const range = saoPauloClosedRange(window.from, window.to);
    query = query.gte("closed_at", range.from).lt("closed_at", range.to).limit(2000);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []) as LeadDb[];
  const siblings = await customerSales(supabase, batchId, String(sale.customer_key || ""));
  const customerLeadIds = [...new Set(siblings.flatMap((item) => (item.kommoLeadId && item.id !== sale.id ? [item.kommoLeadId] : [])))];
  const missing = customerLeadIds.filter((id) => !rows.some((row) => Number(row.id) === id));
  if (!term && missing.length) {
    const extra = await base().in("id", missing);
    if (extra.error) throw extra.error;
    rows.push(...((extra.data || []) as LeadDb[]));
  }
  const leads = rows.map((row) => leadHint(row, account.subdomain)).filter((lead) => lead.closedOn);
  const uses = await leadUses(supabase, batchId, leads.map((lead) => lead.id));
  const candidates = rankLinkCandidates(
    {
      id: sale.id,
      saleDate: sale.sale_date,
      customerName: String(sale.customer_name || ""),
      customerKey: String(sale.customer_key || ""),
      amount: Number(sale.amount) || 0,
    },
    leads,
    uses,
  );
  const followingCount = followingPurchases(sale.id, siblings).filter((item) => item.kommoLeadId == null).length;
  return { candidates, window, followingCount };
}

export type LinkOptions = { counted: boolean; following: boolean };

type LinkPatch = {
  kommo_lead_id: number | null;
  already_in_kommo: boolean;
  linked_by?: string;
  linked_at?: string;
};

async function writeLinkPatch(
  supabase: SupabaseClient,
  ids: string[],
  patch: LinkPatch,
): Promise<void> {
  if (!ids.length) return;
  const withMeta = { ...patch };
  let result = await supabase.from("v4_sales").update(withMeta).in("id", ids).select("id");
  if (result.error && columnMissing(result.error) && ("linked_by" in withMeta || "linked_at" in withMeta)) {
    const { linked_by: _by, linked_at: _at, ...core } = withMeta;
    result = await supabase.from("v4_sales").update(core).in("id", ids).select("id");
    if (result.error && columnMissing(result.error)) throw new V4StoreError(MIGRATION_HINT, 503);
  }
  if (result.error) {
    if (columnMissing(result.error)) throw new V4StoreError(MIGRATION_HINT, 503);
    throw result.error;
  }
  if (ids.length === 1 && !(result.data || []).length) {
    throw new V4StoreError("Não consegui gravar o vínculo. Atualize a página e tente de novo.", 409);
  }
}

export async function linkSale(
  supabase: SupabaseClient,
  saleId: string,
  leadId: number,
  userId: string,
  options: LinkOptions,
): Promise<{ following: number }> {
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
  const customerKey = String(sale.customer_key || "");
  const conflict = leadConflict({ id: sale.id, customerKey }, (await leadUses(supabase, batchId, [leadId])).get(leadId) || [], options.counted);
  if (conflict && "otherCustomer" in conflict) {
    throw new V4StoreError(`Este negócio do Kommo já está vinculado ao cliente ${conflict.otherCustomer}.`, 409);
  }
  if (conflict) {
    throw new V4StoreError("O valor deste negócio já está contado em outra venda deste cliente. Vincule sem tirar da soma.", 409);
  }
  const now = new Date().toISOString();
  await writeLinkPatch(supabase, [sale.id], {
    kommo_lead_id: leadId,
    already_in_kommo: options.counted,
    linked_by: userId,
    linked_at: now,
  });
  if (!options.following) return { following: 0 };
  const targets = followingPurchases(sale.id, await customerSales(supabase, batchId, customerKey))
    .filter((item) => item.kommoLeadId == null)
    .map((item) => item.id);
  if (!targets.length) return { following: 0 };
  for (let index = 0; index < targets.length; index += 100) {
    await writeLinkPatch(supabase, targets.slice(index, index + 100), {
      kommo_lead_id: leadId,
      already_in_kommo: false,
      linked_by: userId,
      linked_at: now,
    });
  }
  return { following: targets.length };
}

export async function unlinkSale(
  supabase: SupabaseClient,
  saleId: string,
  userId: string,
  following: boolean,
): Promise<{ following: number }> {
  const sale = await loadSale(supabase, saleId);
  const batchId = await assertCurrent(supabase, sale);
  const leadId = sale.kommo_lead_id == null ? null : Number(sale.kommo_lead_id);
  const now = new Date().toISOString();
  const cleared: LinkPatch = { kommo_lead_id: null, already_in_kommo: false, linked_by: userId, linked_at: now };
  await writeLinkPatch(supabase, [sale.id], cleared);
  if (!following || leadId == null) return { following: 0 };
  const targets = followingPurchases(sale.id, await customerSales(supabase, batchId, String(sale.customer_key || "")))
    .filter((item) => item.kommoLeadId === leadId && !item.alreadyInKommo)
    .map((item) => item.id);
  if (!targets.length) return { following: 0 };
  for (let index = 0; index < targets.length; index += 100) {
    await writeLinkPatch(supabase, targets.slice(index, index + 100), cleared);
  }
  return { following: targets.length };
}

export async function deleteImportBatch(supabase: SupabaseClient, batchId: string): Promise<{ id: string; wasActive: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) throw new V4StoreError("Importação não encontrada.", 404);
  const { data, error } = await supabase.from("v4_import_batches").select("id,status").eq("id", batchId).maybeSingle();
  if (error) {
    if (relationMissing(error)) throw new V4StoreError("Execute supabase/v4-vendas.sql no SQL Editor antes de continuar.", 503);
    throw error;
  }
  if (!data) throw new V4StoreError("Importação não encontrada.", 404);
  const wasActive = data.status === "active";
  const removed = await supabase.from("v4_import_batches").delete().eq("id", batchId).select("id");
  if (removed.error) throw removed.error;
  if (!(removed.data || []).length) throw new V4StoreError("Não consegui remover esta planilha.", 409);
  return { id: batchId, wasActive };
}

export async function previousLinks(supabase: SupabaseClient): Promise<PreviousLink[]> {
  const batch = await activeBatch(supabase);
  if (!batch) return [];
  const { data, error } = await supabase
    .from("v4_sales")
    .select("sale_date,customer_key,amount,purchase_number,kommo_lead_id,already_in_kommo")
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
    alreadyInKommo: Boolean(row.already_in_kommo),
  }));
}

export async function manualLeadUses(supabase: SupabaseClient): Promise<{ leadId: number; customerKey: string; counted: boolean }[]> {
  if (!(await manualReady(supabase))) return [];
  const { data, error } = await supabase
    .from("v4_sales")
    .select("kommo_lead_id,customer_key,already_in_kommo")
    .eq("source", "manual")
    .not("kommo_lead_id", "is", null);
  if (error) throw error;
  return (data || []).map((row) => ({
    leadId: Number(row.kommo_lead_id),
    customerKey: String(row.customer_key || ""),
    counted: Boolean(row.already_in_kommo),
  }));
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
