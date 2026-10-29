import { customerKey, roundMoney } from "./parse";
import type { V4Candidate, V4Row, V4Suggestion } from "./types";

export type WonLeadHint = {
  id: number;
  name: string;
  price: number;
  closedOn: string;
};

export function namesOverlap(left: string, right: string): boolean {
  const a = customerKey(left);
  const b = customerKey(right);
  if (!a || !b) return false;
  if (a.length < 3 || b.length < 3) return a === b;
  return a.includes(b) || b.includes(a);
}

export function suggestKommoMatches(rows: V4Row[], leads: WonLeadHint[]): V4Suggestion[] {
  const byKey = new Map<string, WonLeadHint[]>();
  for (const lead of leads) {
    const key = `${lead.closedOn}|${roundMoney(lead.price).toFixed(2)}`;
    const list = byKey.get(key) || [];
    list.push(lead);
    byKey.set(key, list);
  }
  const suggestions: V4Suggestion[] = [];
  for (const row of rows) {
    const found = byKey.get(`${row.saleDate}|${row.amount.toFixed(2)}`) || [];
    if (!found.length) continue;
    const candidates: V4Candidate[] = found.slice(0, 5).map((lead) => ({
      id: lead.id,
      name: lead.name,
      price: roundMoney(lead.price),
      closedOn: lead.closedOn,
      strong: namesOverlap(row.customerName, lead.name),
    }));
    candidates.sort((a, b) => Number(b.strong) - Number(a.strong) || a.id - b.id);
    suggestions.push({ sourceRow: row.sourceRow, candidates });
  }
  return suggestions;
}
