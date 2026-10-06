import assert from "node:assert/strict";
import fs from "node:fs";
import { computeTotals } from "./metrics";
import { parseWorkbook } from "./parseSheet";

const file = fs.readFileSync(new URL("../data/relatorio-leads.xlsx", import.meta.url));
const state = parseWorkbook(file);
const totals = computeTotals(state.days, state.analysis.length, state.categories);

assert.equal(state.days.length, 81);
assert.equal(state.days[0].date, "2026-06-23");
assert.equal(state.days.at(-1)?.date, "2026-10-01");
assert.equal(totals.interesse, 86);
assert.equal(totals.comprou, 4);
assert.equal(totals.semRetorno, 551);
assert.equal(totals.perdidos, 780);
assert.equal(totals.divergentDays, 13);
assert.equal(state.analysis.length, 2);
assert.equal(state.analysis[0].phone, "5511942192114");
assert.equal(state.analysis[0].date, "2026-09-11");
assert.equal(state.analysis[1].phone, "5519990093000");
assert.equal(state.analysis[1].date, "2026-09-29");
assert.equal(
  state.days.find((day) => day.date === "2026-09-11")?.review,
  "pendente",
);
assert.equal(state.days.filter((day) => day.date >= "2026-10-02").length, 0);

console.log("parse ok");
