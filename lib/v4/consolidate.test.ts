import assert from "node:assert/strict";
import { summarizePurchases, totalsAfterImport } from "./consolidate";
import type { PurchaseSlice } from "./consolidate";
import { namesOverlap, suggestKommoMatches } from "./suggest";
import type { V4Row } from "./types";

const same = totalsAfterImport({ hash: "planilha", total: 89115.16 }, { hash: "planilha", total: 89115.16 });
assert.equal(same.decision, "reject");
assert.equal(same.total, 89115.16);

const replaced = totalsAfterImport({ hash: "antiga", total: 89115.16 }, { hash: "corrigida", total: 1000 });
assert.equal(replaced.decision, "replace");
assert.equal(replaced.total, 1000);
assert.notEqual(replaced.total, 90115.16);

const created = totalsAfterImport(null, { hash: "nova", total: 39935.38 });
assert.equal(created.decision, "create");
assert.equal(created.total, 39935.38);

function row(partial: Partial<PurchaseSlice> & Pick<PurchaseSlice, "amount" | "isRepurchase">): PurchaseSlice {
  return {
    customerName: partial.customerName || "Cliente",
    customerKey: partial.customerKey || "cliente",
    sellerName: partial.sellerName || "Renan",
    profit: partial.profit ?? 10,
    alreadyInKommo: partial.alreadyInKommo ?? false,
    amount: partial.amount,
    isRepurchase: partial.isRepurchase,
  };
}

const purchases: PurchaseSlice[] = [
  ...Array.from({ length: 15 }, (_, index) => row({ amount: 3000, isRepurchase: false, customerName: `A${index}`, customerKey: `a${index}` })),
  row({ amount: 4179.78, isRepurchase: false, customerName: "Especial", customerKey: "especial", sellerName: "Felipe" }),
  ...Array.from({ length: 11 }, (_, index) => row({ amount: 3330, isRepurchase: true, customerName: `R${index}`, customerKey: `r${index}` })),
  row({ amount: 3305.38, isRepurchase: true, customerName: "Final", customerKey: "final" }),
];

const open = summarizePurchases(purchases, 1000, null);
assert.equal(open.repurchaseCount, 12);
assert.equal(open.repurchaseRevenue, 39935.38);
assert.equal(open.consolidatedRevenue, 40935.38);
assert.equal(open.estimatedProfit, 280);

const marked = purchases.map((item, index) => (index === 16 ? { ...item, alreadyInKommo: true } : item));
const reconciled = summarizePurchases(marked, 1000, null);
assert.equal(reconciled.repurchaseCount, 11);
assert.equal(reconciled.excludedCount, 1);
assert.equal(reconciled.repurchaseRevenue, 36605.38);
assert.equal(reconciled.consolidatedRevenue, 37605.38);

const felipe = summarizePurchases(purchases, 500, "Felipe");
assert.equal(felipe.repurchaseRevenue, 0);
assert.equal(felipe.consolidatedRevenue, 500);
assert.equal(felipe.customers.length, 1);
assert.equal(felipe.customers[0]?.amount, 4179.78);

const sample: V4Row = {
  sourceRow: 2,
  saleDate: "2026-04-02",
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
};
const suggestions = suggestKommoMatches(
  [sample],
  [
    { id: 9, name: "Outro", price: 750, closedOn: "2026-04-02" },
    { id: 4, name: "Oficina Alfa Ltda", price: 750, closedOn: "2026-04-02" },
  ],
);
assert.equal(suggestions.length, 1);
assert.equal(suggestions[0]?.candidates[0]?.id, 4);
assert.equal(suggestions[0]?.candidates[0]?.strong, true);
assert.equal(namesOverlap("BHN", "BHN Comercial"), true);
const untouched = summarizePurchases(
  [row({ amount: 750, isRepurchase: true, alreadyInKommo: false, customerName: "Oficina Alfa", customerKey: "oficina alfa" })],
  1000,
  null,
);
assert.equal(untouched.consolidatedRevenue, 1750);

console.log("v4 consolidate ok");
