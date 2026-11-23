import assert from "node:assert/strict";
import { carryLinks, manualOverlaps, rankLinkCandidates } from "./links";
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

const sale = { id: "venda", saleDate: "2026-04-10", customerName: "Oficina Alfa", amount: 750 };
const ranked = rankLinkCandidates(
  sale,
  [
    { id: 1, name: "Outro cliente", price: 750, closedOn: "2026-04-10", url: "" },
    { id: 2, name: "Oficina Alfa Ltda", price: 750, closedOn: "2026-04-12", url: "" },
    { id: 3, name: "Oficina Alfa", price: 900, closedOn: "2026-04-10", url: "" },
    { id: 4, name: "Oficina Alfa", price: 750, closedOn: "2026-04-10", url: "" },
    { id: 5, name: "Sem relação", price: 120, closedOn: "2026-04-25", url: "" },
  ],
  new Map([[4, "outra-venda"]]),
);
assert.deepEqual(
  ranked.map((item) => item.id),
  [2, 1, 3, 5, 4],
);
assert.equal(ranked[0]?.sameAmount, true);
assert.equal(ranked[0]?.nameMatch, true);
assert.equal(ranked[0]?.dayGap, 2);
assert.equal(ranked[4]?.linkedSaleId, "outra-venda");
const self = rankLinkCandidates(sale, [{ id: 4, name: "Oficina Alfa", price: 750, closedOn: "2026-04-10", url: "" }], new Map([[4, "venda"]]));
assert.equal(self[0]?.linkedSaleId, null);

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
    { saleDate: "2026-04-10", customerKey: "oficina alfa", amount: 750, purchaseNumber: 2, kommoLeadId: 44 },
    { saleDate: "2026-04-11", customerKey: "bhn", amount: 300, purchaseNumber: 1, kommoLeadId: 55 },
    { saleDate: "2026-04-11", customerKey: "bhn", amount: 300, purchaseNumber: 1, kommoLeadId: 56 },
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
  [7, 44],
  [9, 55],
  [10, 56],
]);

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

console.log("v4 links ok");
