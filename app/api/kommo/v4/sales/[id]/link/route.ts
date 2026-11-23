import { commercialEditor } from "@/lib/kommo/access";
import { privateJson } from "@/lib/kommo/http";
import { storeFailure } from "@/lib/v4/http";
import { linkSale, loadLinkCandidates, unlinkSale } from "@/lib/v4/store";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const editor = await commercialEditor();
  if ("error" in editor) return privateJson({ error: editor.error }, editor.status);
  const { id } = await context.params;
  const query = new URL(request.url).searchParams.get("q") || "";
  try {
    return privateJson(await loadLinkCandidates(editor.supabase, id, query));
  } catch (error) {
    return storeFailure(error, "Não consegui buscar os negócios do Kommo.");
  }
}

export async function PUT(request: Request, context: Context) {
  const editor = await commercialEditor();
  if ("error" in editor) return privateJson({ error: editor.error }, editor.status);
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { kommoLeadId?: unknown } | null;
  try {
    await linkSale(editor.supabase, id, Number(body?.kommoLeadId), editor.userId);
    return privateJson({ id });
  } catch (error) {
    return storeFailure(error, "Não consegui vincular a venda.");
  }
}

export async function DELETE(_request: Request, context: Context) {
  const editor = await commercialEditor();
  if ("error" in editor) return privateJson({ error: editor.error }, editor.status);
  const { id } = await context.params;
  try {
    await unlinkSale(editor.supabase, id, editor.userId);
    return privateJson({ id });
  } catch (error) {
    return storeFailure(error, "Não consegui desvincular a venda.");
  }
}
