import { addDays, parseISODate } from "../format";
import { roundMoney } from "./parse";
import { namesOverlap, type WonLeadHint } from "./suggest";
import type { V4Row } from "./types";

export type LinkCandidate = {
  id: number;
  name: string;
  price: number;
  closedOn: string;
  url: string;
  sameAmount: boolean;
  dayGap: number;
  nameMatch: boolean;
  linkedSaleId: string | null;
};

export type LinkableSale = {
  id: string;
  saleDate: string;
  customerName: string;
  amount: number;
};

export const CANDIDATE_WINDOW_DAYS = 15;

export function candidateWindow(saleDate: string): { from: string; to: string } {
  return { from: addDays(saleDate, -CANDIDATE_WINDOW_DAYS), to: addDays(saleDate, CANDIDATE_WINDOW_DAYS) };
}

function dayGap(left: string, right: string): number {
  return Math.round(Math.abs(parseISODate(left).getTime() - parseISODate(right).getTime()) / 86_400_000);
}

export function rankLinkCandidates(
  sale: LinkableSale,
  leads: (WonLeadHint & { url: string })[],
  linkedBy: Map<number, string>,
  limit = 15,
): LinkCandidate[] {
  const amount = roundMoney(sale.amount);
  const ranked = leads.map((lead) => {
    const price = roundMoney(lead.price);
    const linkedSaleId = linkedBy.get(lead.id) || null;
    return {
      id: lead.id,
      name: lead.name,
      price,
      closedOn: lead.closedOn,
      url: lead.url,
      sameAmount: price === amount,
      dayGap: dayGap(sale.saleDate, lead.closedOn),
      nameMatch: namesOverlap(sale.customerName, lead.name),
      linkedSaleId: linkedSaleId === sale.id ? null : linkedSaleId,
    };
  });
  const score = (item: LinkCandidate) =>
    (item.sameAmount ? 4 : 0) + (item.nameMatch ? 3 : 0) + (item.dayGap === 0 ? 2 : item.dayGap <= 3 ? 1 : 0);
  ranked.sort(
    (a, b) =>
      Number(Boolean(a.linkedSaleId)) - Number(Boolean(b.linkedSaleId)) ||
      score(b) - score(a) ||
      a.dayGap - b.dayGap ||
      a.id - b.id,
  );
  return ranked.slice(0, limit);
}

export type PreviousLink = {
  saleDate: string;
  customerKey: string;
  amount: number;
  purchaseNumber: number;
  kommoLeadId: number;
};

function saleKey(row: { saleDate: string; customerKey: string; amount: number; purchaseNumber: number }): string {
  return `${row.saleDate}|${row.customerKey}|${roundMoney(row.amount).toFixed(2)}|${row.purchaseNumber}`;
}

export function carryLinks(previous: PreviousLink[], rows: V4Row[]): Map<number, number> {
  const queues = new Map<string, number[]>();
  for (const link of previous) {
    const key = saleKey(link);
    const queue = queues.get(key) || [];
    queue.push(link.kommoLeadId);
    queues.set(key, queue);
  }
  const carried = new Map<number, number>();
  for (const row of rows) {
    const leadId = queues.get(saleKey(row))?.shift();
    if (leadId != null) carried.set(row.sourceRow, leadId);
  }
  return carried;
}

export type ManualSale = {
  id: string;
  saleDate: string;
  customerName: string;
  customerKey: string;
  amount: number;
  purchaseNumber: number;
};

export type ManualOverlap = {
  sourceRow: number;
  manual: ManualSale;
};

export function manualOverlaps(manual: ManualSale[], rows: V4Row[]): ManualOverlap[] {
  const overlaps: ManualOverlap[] = [];
  const used = new Set<string>();
  for (const row of rows) {
    if (!row.isRepurchase) continue;
    const match = manual.find(
      (item) =>
        !used.has(item.id) &&
        item.customerKey === row.customerKey &&
        (item.purchaseNumber === row.purchaseNumber ||
          (roundMoney(item.amount) === row.amount && dayGap(item.saleDate, row.saleDate) <= 7)),
    );
    if (!match) continue;
    used.add(match.id);
    overlaps.push({ sourceRow: row.sourceRow, manual: match });
  }
  return overlaps;
}
