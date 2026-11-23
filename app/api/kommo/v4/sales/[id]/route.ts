import { commercialEditor } from "@/lib/kommo/access";
import { privateJson } from "@/lib/kommo/http";
import { dayInSaoPaulo } from "@/lib/kommo/metrics";
import { storeFailure } from "@/lib/v4/http";
import { parseManualRepurchase } from "@/lib/v4/manual";
import { deleteManualRepurchase, updateManualRepurchase } from "@/lib/v4/store";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const editor = await commercialEditor();
  if ("error" in editor) return privateJson({ error: editor.error }, editor.status);
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = parseManualRepurchase(body, dayInSaoPaulo(new Date().toISOString()) || "");
  if (!parsed.ok) return privateJson({ error: parsed.error }, 400);
  try {
    await updateManualRepurchase(editor.supabase, id, parsed.value);
    return privateJson({ id });
  } catch (error) {
    return storeFailure(error, "Não consegui salvar a recompra.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const editor = await commercialEditor();
  if ("error" in editor) return privateJson({ error: editor.error }, editor.status);
  const { id } = await context.params;
  try {
    await deleteManualRepurchase(editor.supabase, id);
    return privateJson({ id });
  } catch (error) {
    return storeFailure(error, "Não consegui excluir a recompra.");
  }
}
