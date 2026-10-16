import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildQuote, draftFromQuote, formatCm, formatMeasuresCm, parseQuotes, searchQuotes } from "./quotes";

const text = readFileSync(new URL("../data/medidas-de-exemplo.txt", import.meta.url), "utf8");
const quotes = parseQuotes(text);

assert.ok(quotes.length > 40, `esperava dezenas de caixas, veio ${quotes.length}`);

const classic = quotes.find((quote) => quote.width === 220 && quote.depth === 220 && quote.height === 160 && /onda b/i.test(quote.material));
assert.ok(classic);
assert.deepEqual(
  classic.tiers.map((tier) => [tier.quantity, tier.unitPrice]),
  [
    [100, 2.92],
    [200, 2.5],
    [500, 2.25],
    [1000, 1.58],
  ],
);
assert.equal(quotes.filter((quote) => quote.id === classic.id).length, 1);

const dieCut = quotes.find((quote) => quote.width === 220 && quote.depth === 150 && quote.height === 70);
assert.ok(dieCut);
assert.match(dieCut.note, /corte e vinco/i);
assert.equal(dieCut.tiers[0]?.quantity, 1000);
assert.equal(dieCut.tiers[0]?.unitPrice, 2.6);
assert.equal(dieCut.tiers.at(-1)?.quantity, 5000);

const sameLine = quotes.find((quote) => quote.width === 120 && quote.depth === 80 && quote.height === 250);
assert.ok(sameLine);
assert.equal(sameLine.material, "Papelão Onda B");

const divider = quotes.find((quote) => quote.width === 300 && quote.depth === 300 && quote.height === 180);
assert.ok(divider);
assert.match(divider.note, /divis[oó]ria/i);
assert.equal(divider.material, "");

const reinforced = quotes.filter((quote) => quote.width === 380 && quote.depth === 260 && quote.height === 340);
assert.equal(reinforced.length, 2);
assert.ok(reinforced.some((quote) => /refor/i.test(quote.material)));

const triple = quotes.filter((quote) => quote.width === 270 && quote.depth === 220 && quote.height === 100);
assert.equal(triple.length, 3);
assert.deepEqual(
  triple.find((quote) => /onda c/i.test(quote.material))?.tiers.map((tier) => tier.quantity),
  [500, 1000],
);

assert.equal(searchQuotes(quotes, "220 x 150 x 70").length, 1);
assert.equal(searchQuotes(quotes, "onda dupla reforcada").length, 1);
assert.ok(searchQuotes(quotes, "220").length > 1);
assert.equal(searchQuotes(quotes, "900 x 80").some((quote) => quote.height === 650), true);

const manual = buildQuote({
  width: "300",
  depth: "200",
  height: "100",
  material: "Papelão Onda B",
  note: "com tampa",
  tiers: [
    { quantity: "1.000", unitPrice: "1,40" },
    { quantity: "100", unitPrice: "R$ 2,10" },
  ],
});
if (!("quote" in manual)) throw new Error(manual.error);
assert.equal(manual.quote.width, 300);
assert.deepEqual(
  manual.quote.tiers.map((tier) => [tier.quantity, tier.unitPrice]),
  [
    [100, 2.1],
    [1000, 1.4],
  ],
);
assert.match(manual.quote.note, /tampa/);
assert.equal(draftFromQuote(manual.quote).tiers[0]?.unitPrice, "2,10");

const missingPrice = buildQuote({
  width: "10",
  depth: "10",
  height: "10",
  material: "",
  note: "",
  tiers: [{ quantity: "100", unitPrice: "" }],
});
assert.ok("error" in missingPrice);

assert.equal(formatCm(220), "22");
assert.equal(formatCm(225), "22,5");
assert.equal(formatCm(5), "0,5");
assert.equal(formatMeasuresCm({ width: 220, depth: 220, height: 160 }, "x"), "22 x 22 x 16 cm");

console.log("quotes ok", quotes.length);
