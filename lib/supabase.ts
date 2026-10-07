import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export function createSupabaseBrowser(): SupabaseClient | null {
  const config = supabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.key);
}

export function explainSupabaseError(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : error instanceof Error
        ? error.message
        : "Não consegui falar com o Supabase.";
  if (/relation|schema cache|does not exist/i.test(message)) {
    return "O Supabase ainda não tem as tabelas. Abra o SQL Editor e execute o arquivo supabase/schema.sql.";
  }
  return message;
}
