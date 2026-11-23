import { addDays, parseISODate } from "../format";
import { roundMoney } from "./parse";
import { namesOverlap, type WonLeadHint } from "./suggest";
import { followingPurchases, followingRows } from "./sequence";
import type { V4Row } from "./types";

export { followingPurchases, followingRows, inheritedLinks, type CustomerSale } from "./sequence";

export type LinkCandidate = {
  id: number;
  name: string;
  price: number;
  closedOn: string;
  url: string;
  sameAmount: boolean;
  dayGap: number;
  nameMatch: boolean;
  customerLead: boolean;
  otherCustomer: string | null;
  countedSaleId: string | null;
};

export type LinkableSale = {
  id: string;
  saleDate: string;
  customerName: string;
  customerKey: string;
  amount: number;
};

export type LeadUse = {
  saleId: string;
  customerKey: string;
  customerName: string;
  alreadyInKommo: boolean;
};

export const CANDIDATE_WINDOW_DAYS = 15;

export function candidateWindow(saleDate: string): { from: string; to: string } {
  return { from: addDays(saleDate, -CANDIDATE_WINDOW_DAYS), to: addDays(saleDate, CANDIDATE_WINDOW_DAYS) };
}

function dayGap(left: string, right: string): number {
  return Math.round(Math.abs(parseISODate(left).getTime() - parseISODate(right).getTime()) / 86_400_000);
}

export function leadConflict(
  sale: { id: string; customerKey: string },
  uses: LeadUse[],
  counted: boolean,
): { otherCustomer: string } | { countedSaleId: string } | null {
  const others = uses.filter((use) => use.saleId !== sale.id);
  const stranger = others.find((use) => use.customerKey !== sale.customerKey);
  if (stranger) return { otherCustomer: stranger.customerName };
  const countedUse = counted ? others.find((use) => use.alreadyInKommo) : undefined;
  if (countedUse) return { countedSaleId: countedUse.saleId };
  return null;
}

export function rankLinkCandidates(
  sale: LinkableSale,
  leads: (WonLeadHint & { url: string })[],
  usesByLead: Map<number, LeadUse[]>,
  limit = 15,
): LinkCandidate[] {
  const amount = roundMoney(sale.amount);
  const ranked = leads.map((lead) => {
    const price = roundMoney(lead.price);
    const uses = (usesByLead.get(lead.id) || []).filter((use) => use.saleId !== sale.id);
    const stranger = uses.find((use) => use.customerKey !== sale.customerKey);
    return {
      id: lead.id,
      name: lead.name,
      price,
      closedOn: lead.closedOn,
      url: lead.url,
      sameAmount: price === amount,
      dayGap: dayGap(sale.saleDate, lead.closedOn),
      nameMatch: namesOverlap(sale.customerName, lead.name),
      customerLead: !stranger && uses.length > 0,
      otherCustomer: stranger ? stranger.customerName : null,
      countedSaleId: uses.find((use) => use.alreadyInKommo)?.saleId || null,
    };
  });
  const score = (item: LinkCandidate) =>
    (item.customerLead ? 10 : 0) +
    (item.sameAmount ? 4 : 0) +
    (item.nameMatch ? 3 : 0) +
    (item.dayGap === 0 ? 2 : item.dayGap <= 3 ? 1 : 0);
  ranked.sort(
    (a, b) =>
      Number(Boolean(a.otherCustomer)) - Number(Boolean(b.otherCustomer)) ||
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
  alreadyInKommo: boolean;
};

export type CarriedChoice = { kommoLeadId: number; alreadyInKommo: boolean };

function saleKey(row: { saleDate: string; customerKey: string; amount: number; purchaseNumber: number }): string {
  return `${row.saleDate}|${row.customerKey}|${roundMoney(row.amount).toFixed(2)}|${row.purchaseNumber}`;
}

export function carryLinks(previous: PreviousLink[], rows: V4Row[]): Map<number, CarriedChoice> {
  const queues = new Map<string, CarriedChoice[]>();
  for (const link of previous) {
    const key = saleKey(link);
    const queue = queues.get(key) || [];
    queue.push({ kommoLeadId: link.kommoLeadId, alreadyInKommo: link.alreadyInKommo });
    queues.set(key, queue);
  }
  const carried = new Map<number, CarriedChoice>();
  for (const row of rows) {
    const choice = queues.get(saleKey(row))?.shift();
    if (choice) carried.set(row.sourceRow, choice);
  }
  return carried;
}

export type ImportLink = { kommoLeadId: number; alreadyInKommo: boolean };

export function allowFollowing(rows: V4Row[], requested: Map<number, ImportLink>, allowed: Map<number, Set<number>>): Map<number, Set<number>> {
  const expanded = new Map([...allowed].map(([row, set]) => [row, new Set(set)]));
  for (const [sourceRow, link] of requested) {
    if (!allowed.get(sourceRow)?.has(link.kommoLeadId)) continue;
    for (const next of followingRows(rows, sourceRow)) {
      const set = expanded.get(next.sourceRow) || new Set<number>();
      set.add(link.kommoLeadId);
      expanded.set(next.sourceRow, set);
    }
  }
  return expanded;
}

export function acceptImportLinks(
  rows: V4Row[],
  requested: Map<number, ImportLink>,
  allowed: Map<number, Set<number>>,
  manualUses: { leadId: number; customerKey: string; counted: boolean }[],
): Map<number, ImportLink> {
  const owner = new Map<number, string>();
  const counted = new Set<number>();
  for (const use of manualUses) {
    owner.set(use.leadId, use.customerKey);
    if (use.counted) counted.add(use.leadId);
  }
  const accepted = new Map<number, ImportLink>();
  for (const row of rows) {
    const link = requested.get(row.sourceRow);
    if (!link || !allowed.get(row.sourceRow)?.has(link.kommoLeadId)) continue;
    const known = owner.get(link.kommoLeadId);
    if (known != null && known !== row.customerKey) continue;
    const alreadyInKommo = link.alreadyInKommo && !counted.has(link.kommoLeadId);
    owner.set(link.kommoLeadId, row.customerKey);
    if (alreadyInKommo) counted.add(link.kommoLeadId);
    accepted.set(row.sourceRow, { kommoLeadId: link.kommoLeadId, alreadyInKommo });
  }
  return accepted;
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
