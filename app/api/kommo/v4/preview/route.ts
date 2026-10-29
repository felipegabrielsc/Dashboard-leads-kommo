import { commercialReader } from "@/lib/kommo/access";
import { privateJson } from "@/lib/kommo/http";
import { fileHash, parseV4Workbook } from "@/lib/v4/parse";
import { loadV4Suggestions } from "@/lib/v4/matches";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

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
  const suggestions = await loadV4Suggestions(reader.supabase, parsed.rows);
  return privateJson({
    fileName: file.name,
    fileHash: fileHash(bytes),
    ...parsed,
    suggestions,
  });
}
