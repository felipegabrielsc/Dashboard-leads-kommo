import assert from "node:assert/strict";
import seed from "../data/seed.json";
import { normalizeState } from "./store";
import { computeTotals } from "./metrics";
import { defaultFilters, filterDays } from "./filters";

const state = normalizeState(seed);
assert.ok(state, "seed normaliza");
assert.equal(state.days.length, 81);
assert.equal(state.analysis.length, 2);
assert.equal(state.days[0].date, "2026-06-23");
assert.equal(state.days.at(-1)?.date, "2026-10-01");

const totals = computeTotals(state.days, state.analysis.length, state.categories);
assert.equal(totals.interesse, 86);
assert.equal(totals.comprou, 4);
assert.equal(totals.semRetorno, 551);
assert.equal(totals.perdidos, 780);
assert.equal(totals.outros, 18);
assert.equal(totals.curriculo, 580);
assert.equal(totals.engano, 169);
assert.equal(totals.classified, 1421);
assert.equal(totals.totalGeral, 1423);
assert.equal(totals.pendingDays, 2);
assert.equal(totals.divergentDays, 13);
assert.ok(Math.abs(totals.taxaInteresse - 90 / 1423) < 1e-12);
assert.ok(Math.abs(totals.taxaComercial - 90 / 656) < 1e-12);
assert.ok(Math.abs(totals.conversao - 4 / 90) < 1e-12);

const september = filterDays(state.days, state.analysis, {
  ...defaultFilters(),
  months: ["2026-09"],
});
assert.equal(september.length, 30);

const pending = filterDays(state.days, state.analysis, {
  ...defaultFilters(),
  review: "pendente",
});
assert.deepEqual(
  pending.map((day) => day.date),
  ["2026-09-11", "2026-09-29"],
);

console.log("metrics ok");
