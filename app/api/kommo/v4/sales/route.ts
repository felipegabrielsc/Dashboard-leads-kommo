import { commercialEditor } from "@/lib/kommo/access";
import { privateJson } from "@/lib/kommo/http";
import { dayInSaoPaulo } from "@/lib/kommo/metrics";
import { storeFailure } from "@/lib/v4/http";
import { parseManualRepurchase } from "@/lib/v4/manual";
import { createManualRepurchase } from "@/lib/v4/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const editor = await commercialEditor();
  if ("error" in editor) return privateJson({ error: editor.error }, editor.status);
  const body = await request.json().catch(() => null);
  const parsed = parseManualRepurchase(body, dayInSaoPaulo(new Date().toISOString()) || "");
  if (!parsed.ok) return privateJson({ error: parsed.error }, 400);
  try {
    const id = await createManualRepurchase(editor.supabase, parsed.value, editor.userId);
    return privateJson({ id }, 201);
  } catch (error) {
    return storeFailure(error, "Não consegui salvar a recompra.");
  }
}
