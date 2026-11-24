import { commercialEditor } from "@/lib/kommo/access";
import { privateJson } from "@/lib/kommo/http";
import { storeFailure } from "@/lib/v4/http";
import { deleteImportBatch } from "@/lib/v4/store";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  const editor = await commercialEditor();
  if ("error" in editor) return privateJson({ error: editor.error }, editor.status);
  const { id } = await context.params;
  try {
    const result = await deleteImportBatch(editor.supabase, id);
    return privateJson(result);
  } catch (error) {
    return storeFailure(error, "Não consegui remover a planilha.");
  }
}
