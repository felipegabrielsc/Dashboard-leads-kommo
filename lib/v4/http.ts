import { privateJson } from "../kommo/http";
import { errorText, relationMissing } from "../kommo/rpcError";
import { columnMissing, MIGRATION_HINT, V4StoreError } from "./store";

export function storeFailure(error: unknown, fallback: string) {
  if (error instanceof V4StoreError) return privateJson({ error: error.message }, error.status);
  if (relationMissing(error)) return privateJson({ error: "Execute supabase/v4-vendas.sql no SQL Editor antes de continuar." }, 503);
  if (columnMissing(error)) return privateJson({ error: MIGRATION_HINT }, 503);
  const text = errorText(error).toLowerCase();
  if (text.includes("v4_sales_link_check") || text.includes("already_in_kommo")) {
    return privateJson({ error: "Este vínculo ficou inconsistente. Desmarque a opção de valor já contado no Kommo ou escolha outro negócio." }, 409);
  }
  if (text.includes("v4_sales_") && text.includes("check")) {
    return privateJson({ error: "Esta venda tem dados inconsistentes na planilha. Reimporte o arquivo ou exclua a recompra manual." }, 409);
  }
  return privateJson({ error: fallback }, 500);
}
