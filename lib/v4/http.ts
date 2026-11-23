import { privateJson } from "../kommo/http";
import { relationMissing } from "../kommo/rpcError";
import { V4StoreError } from "./store";

export function storeFailure(error: unknown, fallback: string) {
  if (error instanceof V4StoreError) return privateJson({ error: error.message }, error.status);
  if (relationMissing(error)) return privateJson({ error: "Execute supabase/v4-vendas.sql no SQL Editor antes de continuar." }, 503);
  return privateJson({ error: fallback }, 500);
}
