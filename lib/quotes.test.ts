import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildQuote, displayNote, draftFromQuote, formatCm, formatMeasuresCm, groupQuotes, parseQuotes, quoteTitle, searchQuotes } from "./quotes";

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
assert.equal(dieCut.family, "corte_vinco");
assert.match(dieCut.note, /corte e vinco/i);
assert.equal(dieCut.tiers[0]?.quantity, 1000);
assert.equal(dieCut.tiers[0]?.unitPrice, 2.6);
assert.equal(dieCut.tiers.at(-1)?.quantity, 5000);

const plain = quotes.find((quote) => quote.width === 900 && quote.depth === 80 && quote.height === 650);
assert.ok(plain);
assert.equal(plain.family, "padrao");
assert.equal(plain.material, "");
assert.equal(classic.family, "padrao");
const groups = groupQuotes(quotes);
assert.equal(groups.some((group) => group.label === "Corte e vinco" && group.quotes.some((quote) => quote.id === dieCut.id)), true);
assert.equal(
  groups.some((group) => group.label === "Papelão não informado" && group.quotes.some((quote) => quote.id === dieCut.id)),
  false,
);

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
assert.equal(searchQuotes(quotes, "22 x 15 x 7").length, 1);
assert.equal(searchQuotes(quotes, "22 x 22 x 16 cm").some((quote) => quote.width === 220 && quote.height === 160), true);
assert.equal(searchQuotes(quotes, "23,5 x 12 x 61").some((quote) => quote.width === 235 && quote.height === 610), true);
assert.equal(searchQuotes(quotes, "onda dupla reforcada").length, 1);
assert.ok(searchQuotes(quotes, "220").length > 1);
assert.equal(searchQuotes(quotes, "900 x 80").some((quote) => quote.height === 650), true);

const manual = buildQuote({
  width: "300",
  depth: "200",
  height: "100",
  material: "Papelão Onda B",
  note: "com tampa",
  family: "padrao",
  tiers: [
    { quantity: "1.000", unitPrice: "1,40" },
    { quantity: "100", unitPrice: "R$ 2,10" },
  ],
});
if (!("quote" in manual)) throw new Error(manual.error);
assert.equal(manual.quote.family, "padrao");
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
  family: "padrao",
  tiers: [{ quantity: "100", unitPrice: "" }],
});
assert.ok("error" in missingPrice);

assert.equal(formatCm(220), "22");
assert.equal(formatCm(225), "22,5");
assert.equal(formatCm(5), "0,5");
assert.equal(formatMeasuresCm({ width: 220, depth: 220, height: 160 }, "x"), "22 x 22 x 16 cm");

const dieCutFile = parseQuotes(readFileSync(new URL("../data/medidas-corte-vinco.txt", import.meta.url), "utf8"));
assert.equal(dieCutFile.length, 13);
assert.equal(dieCutFile.every((quote) => quote.family === "corte_vinco"), true);
assert.equal(groupQuotes(dieCutFile).every((group) => group.family === "corte_vinco"), true);

const smallCm = dieCutFile.find((quote) => quote.width === 240 && quote.depth === 120 && quote.height === 50);
assert.ok(smallCm);
assert.deepEqual(
  smallCm.tiers.map((tier) => [tier.quantity, tier.unitPrice]),
  [
    [1000, 1.8],
    [2000, 1.58],
    [5000, 1.35],
  ],
);
assert.equal(searchQuotes(dieCutFile, "24 x 12 x 5").some((quote) => quote.id === smallCm.id), true);

const glued = dieCutFile.find((quote) => quote.width === 320 && quote.depth === 320 && quote.height === 100);
assert.ok(glued);
assert.equal(glued.tiers[0]?.unitPrice, 6.7);

const compact = dieCutFile.find((quote) => quote.width === 320 && quote.depth === 210 && quote.height === 110 && !/montar/i.test(quote.note));
assert.ok(compact);
assert.equal(compact.tiers[1]?.unitPrice, 5.2);

const custom = dieCutFile.find((quote) => /montar/i.test(quote.note));
assert.ok(custom);
assert.equal(displayNote(custom), "montar");
assert.equal(quoteTitle(smallCm), "Caixa 240 × 120 × 50");
assert.equal(custom.width, 320);
assert.equal(custom.tiers.find((tier) => tier.quantity === 100)?.detail, "sem personalização");
assert.equal(custom.tiers.find((tier) => tier.quantity === 500)?.detail, "personalizada");

const fixed = dieCutFile.find((quote) => quote.width === 160 && quote.depth === 110 && quote.height === 60);
assert.ok(fixed);
assert.equal(fixed.tiers[0]?.quantity, 1000);
assert.equal(fixed.tiers[0]?.unitPrice, 1.1);
assert.equal(fixed.tiers[0]?.detail, "preço fixo");

const unit = dieCutFile.find((quote) => quote.width === 160 && quote.depth === 110 && quote.height === 40);
assert.ok(unit);
assert.equal(unit.tiers[0]?.quantity, 1);
assert.equal(unit.tiers[0]?.unitPrice, 1);
assert.equal(unit.tiers[0]?.detail, "a unidade");

const mixed = dieCutFile.find((quote) => quote.width === 190 && quote.depth === 120 && quote.height === 120);
assert.ok(mixed);
assert.deepEqual(
  mixed.tiers.map((tier) => [tier.quantity, tier.unitPrice]),
  [
    [1, 1.5],
    [10000, 1.1],
  ],
);

const manualDieCut = buildQuote({
  width: "320",
  depth: "210",
  height: "110",
  material: "",
  note: "",
  family: "corte_vinco",
  tiers: [{ quantity: "200", unitPrice: "4,80" }],
});
if (!("quote" in manualDieCut)) throw new Error(manualDieCut.error);
assert.equal(manualDieCut.quote.family, "corte_vinco");
assert.match(manualDieCut.quote.id, /corte_vinco/);

console.log("quotes ok", quotes.length, dieCutFile.length);
