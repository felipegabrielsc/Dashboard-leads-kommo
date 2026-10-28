import { createSupabaseServer, createSupabaseService } from "../supabaseServer";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function commercialReader(): Promise<{ supabase: SupabaseClient } | { error: string; status: number }> {
  const supabase = await createSupabaseServer();
  if (!supabase) return { error: "O Supabase ainda não está configurado.", status: 503 };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Entre para ver o comercial.", status: 401 };
  return { supabase };
}

export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim() || process.env.KOMMO_SYNC_SECRET?.trim() || "";
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const bearer = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : "";
  return bearer === secret;
}

export function syncWriter(): SupabaseClient | null {
  return createSupabaseService();
}
