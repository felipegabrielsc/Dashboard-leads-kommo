import { commercialReader } from "@/lib/kommo/access";
import { privateJson } from "@/lib/kommo/http";
import { relationMissing, rpcMissing } from "@/lib/kommo/rpcError";
import { loadV4Suggestions } from "@/lib/v4/matches";
import { fileHash, parseV4Workbook } from "@/lib/v4/parse";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

type Link = { sourceRow?: unknown; kommoLeadId?: unknown };

function linksOf(raw: FormDataEntryValue | null): Map<number, number> {
  if (typeof raw !== "string" || !raw.trim()) return new Map();
  try {
    const parsed = JSON.parse(raw) as Link[];
    if (!Array.isArray(parsed)) return new Map();
    const links = new Map<number, number>();
    for (const item of parsed) {
      const sourceRow = Number(item?.sourceRow);
      const leadId = Number(item?.kommoLeadId);
      if (Number.isInteger(sourceRow) && sourceRow > 0 && Number.isInteger(leadId) && leadId > 0) {
        links.set(sourceRow, leadId);
      }
    }
    return links;
  } catch {
    return new Map();
  }
}

export async function POST(request: Request) {
  const reader = await commercialReader();
  if ("error" in reader) return privateJson({ error: reader.error }, reader.status);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return privateJson({ error: "Envie a planilha .xlsx." }, 400);
  if (file.size <= 0 || file.size > MAX_BYTES) return privateJson({ error: "A planilha precisa ter até 8 MB." }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseV4Workbook(bytes);
  } catch {
    return privateJson({ error: "Não consegui ler esta planilha. Use um arquivo Excel .xlsx." }, 400);
  }
  if (!parsed.rows.length) return privateJson({ error: "A planilha não tem vendas válidas para gravar." }, 400);
  const suggestions = await loadV4Suggestions(reader.supabase, parsed.rows);
  const allowed = new Map<number, Set<number>>();
  for (const suggestion of suggestions) {
    allowed.set(suggestion.sourceRow, new Set(suggestion.candidates.map((candidate) => candidate.id)));
  }
  const links = linksOf(form?.get("links") ?? null);
  const rows = parsed.rows.map((row) => {
    const leadId = links.get(row.sourceRow);
    const accepted = leadId != null && allowed.get(row.sourceRow)?.has(leadId);
    return {
      ...row,
      kommoLeadId: accepted ? leadId : null,
      alreadyInKommo: Boolean(accepted),
    };
  });
  const { data, error } = await reader.supabase.rpc("v4_commit_import", {
    p_file_name: file.name,
    p_file_hash: fileHash(bytes),
    p_rows: rows,
  });
  if (error) {
    if (relationMissing(error) || rpcMissing(error)) {
      return privateJson({ error: "Execute supabase/v4-vendas.sql no SQL Editor antes de importar." }, 503);
    }
    return privateJson({ error: "Não consegui gravar a importação." }, 500);
  }
  const body = data && typeof data === "object" ? (data as { ok?: boolean; error?: string }) : null;
  if (body?.ok === false && body.error === "same") {
    return privateJson({ error: "Esta planilha já é a importação ativa. Nada foi somado de novo." }, 409);
  }
  if (!body?.ok) return privateJson({ error: "Não consegui gravar a importação." }, 400);
  return privateJson({ saved: data, totals: parsed.totals });
}
