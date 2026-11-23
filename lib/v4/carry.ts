import type { SupabaseClient } from "@supabase/supabase-js";
import { carryLinks, manualOverlaps, type ManualOverlap } from "./links";
import { leadNames, manualSales, previousLinks } from "./store";
import type { V4Candidate, V4Row, V4Suggestion } from "./types";

export type CarriedLink = { sourceRow: number; candidate: V4Candidate; alreadyInKommo: boolean };

export async function carriedForImport(
  supabase: SupabaseClient,
  rows: V4Row[],
  suggestions: V4Suggestion[],
): Promise<{ carried: CarriedLink[]; overlaps: ManualOverlap[] }> {
  let carried: CarriedLink[] = [];
  let overlaps: ManualOverlap[] = [];
  try {
    const links = carryLinks(await previousLinks(supabase), rows);
    const names = await leadNames(supabase, [...links.values()].map((link) => link.kommoLeadId));
    carried = [...links].map(([sourceRow, { kommoLeadId: leadId, alreadyInKommo }]) => {
      const suggested = suggestions.find((item) => item.sourceRow === sourceRow)?.candidates.find((item) => item.id === leadId);
      const lead = names.get(leadId);
      return {
        sourceRow,
        alreadyInKommo,
        candidate: suggested || {
          id: leadId,
          name: lead?.name || `Negócio ${leadId}`,
          price: lead?.price || 0,
          closedOn: lead?.closedOn || "",
          strong: true,
        },
      };
    });
  } catch {
    carried = [];
  }
  try {
    overlaps = manualOverlaps(await manualSales(supabase), rows);
  } catch {
    overlaps = [];
  }
  return { carried, overlaps };
}
