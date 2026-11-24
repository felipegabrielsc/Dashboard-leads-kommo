import assert from "node:assert/strict";
import {
  acceptImportLinks,
  allowFollowing,
  carryLinks,
  followingPurchases,
  inheritedLinks,
  leadConflict,
  manualOverlaps,
  rankLinkCandidates,
  saoPauloClosedRange,
} from "./links";
import { parseManualRepurchase } from "./manual";
import type { V4Row } from "./types";

const today = "2026-04-20";

const manual = parseManualRepurchase(
  { saleDate: "2026-04-10", customerName: "  Oficina   Álfa ", amount: "1.500,50", purchaseNumber: "3", sellerName: "Ana", profit: "" },
  today,
);
assert.equal(manual.ok, true);
if (manual.ok) {
  assert.equal(manual.value.customerName, "Oficina Álfa");
  assert.equal(manual.value.customerKey, "oficina alfa");
  assert.equal(manual.value.amount, 1500.5);
  assert.equal(manual.value.purchaseNumber, 3);
  assert.equal(manual.value.profit, null);
}

const thousands = parseManualRepurchase({ saleDate: "2026-04-10", customerName: "A", amount: "1.500", purchaseNumber: 2 }, today);
assert.equal(thousands.ok && thousands.value.amount, 1500);
const negativeProfit = parseManualRepurchase({ saleDate: "2026-04-10", customerName: "A", amount: 900, purchaseNumber: 2, profit: "-120,40" }, today);
assert.equal(negativeProfit.ok && negativeProfit.value.profit, -120.4);

const rejected = [
  { saleDate: "2026-04-21", customerName: "A", amount: 10, purchaseNumber: 2 },
  { saleDate: "2026-02-30", customerName: "A", amount: 10, purchaseNumber: 2 },
  { saleDate: "2026-04-10", customerName: "   ", amount: 10, purchaseNumber: 2 },
  { saleDate: "2026-04-10", customerName: "A", amount: 0, purchaseNumber: 2 },
  { saleDate: "2026-04-10", customerName: "A", amount: "abc", purchaseNumber: 2 },
  { saleDate: "2026-04-10", customerName: "A", amount: 10, purchaseNumber: 1 },
  { saleDate: "2026-04-10", customerName: "A", amount: 10, purchaseNumber: 2.5 },
];
for (const input of rejected) assert.equal(parseManualRepurchase(input, today).ok, false, JSON.stringify(input));
assert.equal(parseManualRepurchase(null, today).ok, false);

const sale = { id: "venda", saleDate: "2026-04-10", customerName: "Oficina Alfa", customerKey: "oficina alfa", amount: 750 };
const use = (saleId: string, customerKey: string, alreadyInKommo: boolean) => ({ saleId, customerKey, customerName: customerKey, alreadyInKommo });
const ranked = rankLinkCandidates(
  sale,
  [
    { id: 1, name: "Outro cliente", price: 750, closedOn: "2026-04-10", url: "" },
    { id: 2, name: "Oficina Alfa Ltda", price: 750, closedOn: "2026-04-12", url: "" },
    { id: 3, name: "Oficina Alfa", price: 900, closedOn: "2026-04-10", url: "" },
    { id: 4, name: "Oficina Alfa", price: 750, closedOn: "2026-04-10", url: "" },
    { id: 5, name: "Sem relação", price: 120, closedOn: "2026-04-25", url: "" },
    { id: 6, name: "Primeira compra", price: 2000, closedOn: "2026-02-01", url: "" },
  ],
  new Map([
    [4, [use("outra-venda", "bhn", true)]],
    [6, [use("primeira", "oficina alfa", true)]],
  ]),
);
assert.deepEqual(
  ranked.map((item) => item.id),
  [6, 2, 1, 3, 5, 4],
);
assert.equal(ranked[0]?.customerLead, true);
assert.equal(ranked[0]?.countedSaleId, "primeira");
assert.equal(ranked[1]?.sameAmount, true);
assert.equal(ranked[1]?.nameMatch, true);
assert.equal(ranked[1]?.dayGap, 2);
assert.equal(ranked[5]?.otherCustomer, "bhn");
const self = rankLinkCandidates(sale, [{ id: 4, name: "Oficina Alfa", price: 750, closedOn: "2026-04-10", url: "" }], new Map([[4, [use("venda", "oficina alfa", true)]]]));
assert.equal(self[0]?.customerLead, false);
assert.equal(self[0]?.countedSaleId, null);

const firstAndRepurchase = [use("primeira", "oficina alfa", true), use("recompra", "oficina alfa", false)];
assert.equal(leadConflict({ id: "nova", customerKey: "oficina alfa" }, firstAndRepurchase, false), null);
assert.deepEqual(leadConflict({ id: "nova", customerKey: "oficina alfa" }, firstAndRepurchase, true), { countedSaleId: "primeira" });
assert.equal(leadConflict({ id: "primeira", customerKey: "oficina alfa" }, firstAndRepurchase, true), null);
assert.deepEqual(leadConflict({ id: "nova", customerKey: "bhn" }, firstAndRepurchase, false), { otherCustomer: "oficina alfa" });

const procar = [
  { id: "p4", saleDate: "2026-10-21", purchaseNumber: 4 },
  { id: "p1", saleDate: "2026-07-24", purchaseNumber: 1 },
  { id: "n1", saleDate: "2026-11-10", purchaseNumber: 1 },
  { id: "p2", saleDate: "2026-08-11", purchaseNumber: 2 },
  { id: "p3", saleDate: "2026-09-15", purchaseNumber: 3 },
];
assert.deepEqual(followingPurchases("p1", procar).map((item) => item.id), ["p2", "p3", "p4"]);
assert.deepEqual(followingPurchases("p3", procar).map((item) => item.id), ["p4"]);
assert.deepEqual(followingPurchases("n1", procar).map((item) => item.id), []);
assert.deepEqual(followingPurchases("ausente", procar), []);

function v4(partial: Partial<V4Row> & Pick<V4Row, "sourceRow">): V4Row {
  return {
    saleDate: "2026-04-10",
    customerName: "Oficina Alfa",
    customerKey: "oficina alfa",
    amount: 750,
    purchaseNumber: 2,
    isRepurchase: true,
    sellerName: "Ana",
    rawMaterialCost: null,
    taxCost: null,
    operationalCost: null,
    profit: null,
    ...partial,
  };
}

const carried = carryLinks(
  [
    { saleDate: "2026-04-10", customerKey: "oficina alfa", amount: 750, purchaseNumber: 2, kommoLeadId: 44, alreadyInKommo: false },
    { saleDate: "2026-04-11", customerKey: "bhn", amount: 300, purchaseNumber: 1, kommoLeadId: 55, alreadyInKommo: true },
    { saleDate: "2026-04-11", customerKey: "bhn", amount: 300, purchaseNumber: 1, kommoLeadId: 56, alreadyInKommo: true },
  ],
  [
    v4({ sourceRow: 7 }),
    v4({ sourceRow: 8, amount: 760 }),
    v4({ sourceRow: 9, saleDate: "2026-04-11", customerKey: "bhn", amount: 300, purchaseNumber: 1, isRepurchase: false }),
    v4({ sourceRow: 10, saleDate: "2026-04-11", customerKey: "bhn", amount: 300, purchaseNumber: 1, isRepurchase: false }),
    v4({ sourceRow: 11, saleDate: "2026-04-11", customerKey: "bhn", amount: 300, purchaseNumber: 1, isRepurchase: false }),
  ],
);
assert.deepEqual([...carried], [
  [7, { kommoLeadId: 44, alreadyInKommo: false }],
  [9, { kommoLeadId: 55, alreadyInKommo: true }],
  [10, { kommoLeadId: 56, alreadyInKommo: true }],
]);

const importRows = [
  v4({ sourceRow: 2, purchaseNumber: 1, isRepurchase: false }),
  v4({ sourceRow: 3, purchaseNumber: 2 }),
  v4({ sourceRow: 4, purchaseNumber: 3 }),
  v4({ sourceRow: 5, customerKey: "bhn" }),
  v4({ sourceRow: 6, customerKey: "zeta" }),
];
const allowAll = new Map(importRows.map((row) => [row.sourceRow, new Set([70, 71])]));
const accepted = acceptImportLinks(
  importRows,
  new Map([
    [2, { kommoLeadId: 70, alreadyInKommo: true }],
    [3, { kommoLeadId: 70, alreadyInKommo: false }],
    [4, { kommoLeadId: 70, alreadyInKommo: true }],
    [5, { kommoLeadId: 70, alreadyInKommo: false }],
    [6, { kommoLeadId: 71, alreadyInKommo: false }],
  ]),
  allowAll,
  [{ leadId: 71, customerKey: "outro", counted: false }],
);
assert.deepEqual([...accepted], [
  [2, { kommoLeadId: 70, alreadyInKommo: true }],
  [3, { kommoLeadId: 70, alreadyInKommo: false }],
  [4, { kommoLeadId: 70, alreadyInKommo: false }],
]);

const cycle = [
  v4({ sourceRow: 20, customerKey: "procar", saleDate: "2026-07-24", purchaseNumber: 1, isRepurchase: false }),
  v4({ sourceRow: 21, customerKey: "procar", saleDate: "2026-08-11", purchaseNumber: 2 }),
  v4({ sourceRow: 22, customerKey: "bhn", saleDate: "2026-08-12", purchaseNumber: 2 }),
  v4({ sourceRow: 23, customerKey: "procar", saleDate: "2026-09-15", purchaseNumber: 3 }),
  v4({ sourceRow: 24, customerKey: "procar", saleDate: "2026-11-10", purchaseNumber: 1, isRepurchase: false }),
];
assert.deepEqual([...inheritedLinks(cycle, new Map([[20, 7003]]))], [
  [21, 7003],
  [23, 7003],
]);
assert.deepEqual([...inheritedLinks(cycle, new Map([[20, 7003], [23, 9000]]))], [[21, 7003]]);
const widened = allowFollowing(cycle, new Map([[20, { kommoLeadId: 7003, alreadyInKommo: true }], [22, { kommoLeadId: 7003, alreadyInKommo: false }]]), new Map([[20, new Set([7003])]]));
assert.deepEqual([...(widened.get(21) || [])], [7003]);
assert.deepEqual([...(widened.get(23) || [])], [7003]);
assert.equal(widened.has(22), false);
assert.equal(widened.has(24), false);

const overlaps = manualOverlaps(
  [
    { id: "m1", saleDate: "2026-04-08", customerName: "Oficina Alfa", customerKey: "oficina alfa", amount: 750, purchaseNumber: 5 },
    { id: "m2", saleDate: "2026-03-01", customerName: "BHN", customerKey: "bhn", amount: 100, purchaseNumber: 3 },
    { id: "m3", saleDate: "2026-03-01", customerName: "Zeta", customerKey: "zeta", amount: 100, purchaseNumber: 2 },
  ],
  [
    v4({ sourceRow: 2 }),
    v4({ sourceRow: 3, customerKey: "bhn", amount: 999, saleDate: "2026-04-15", purchaseNumber: 3 }),
    v4({ sourceRow: 4, customerKey: "zeta", amount: 100, saleDate: "2026-04-15", purchaseNumber: 4 }),
    v4({ sourceRow: 5, customerKey: "zeta", purchaseNumber: 1, isRepurchase: false }),
  ],
);
assert.deepEqual(
  overlaps.map((item) => [item.sourceRow, item.manual.id]),
  [
    [2, "m1"],
    [3, "m2"],
  ],
);

const range = saoPauloClosedRange("2026-04-10", "2026-04-25");
assert.equal(range.from, "2026-04-10T03:00:00.000Z");
assert.equal(range.to, "2026-04-26T03:00:00.000Z");

console.log("v4 links ok");
