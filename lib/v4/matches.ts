import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "../format";
import { kommoCredentials } from "../kommo/client";
import { kommoStore } from "../kommo/db";
import { dayInSaoPaulo } from "../kommo/metrics";
import { suggestKommoMatches } from "./suggest";
import type { V4Row, V4Suggestion } from "./types";

export async function loadV4Suggestions(supabase: SupabaseClient, rows: V4Row[]): Promise<V4Suggestion[]> {
  if (!rows.length) return [];
  const credentials = kommoCredentials();
  if (!credentials) return [];
  try {
    const state = await kommoStore(supabase).getState(credentials.subdomain);
    if (!state) return [];
    const dates = rows.map((row) => row.saleDate).sort();
    const from = `${addDays(dates[0], -1)}T03:00:00.000Z`;
    const to = `${addDays(dates[dates.length - 1], 2)}T03:00:00.000Z`;
    const { data, error } = await supabase
      .from("kommo_leads")
      .select("id,name,price,closed_at")
      .eq("account_id", state.accountId)
      .eq("is_deleted", false)
      .eq("status_kind", "won")
      .gte("closed_at", from)
      .lt("closed_at", to)
      .limit(2000);
    if (error || !data) return [];
    const leads = data.flatMap((row) => {
      const closedOn = dayInSaoPaulo(typeof row.closed_at === "string" ? row.closed_at : null);
      if (!closedOn) return [];
      return [{
        id: Number(row.id),
        name: String(row.name || ""),
        price: Number(row.price) || 0,
        closedOn,
      }];
    });
    return suggestKommoMatches(rows, leads);
  } catch {
    return [];
  }
}
