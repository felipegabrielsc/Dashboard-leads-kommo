import assert from "node:assert/strict";
import { classifyStatuses } from "./classify";
import { parseCommercialFilters } from "./filters";
import { buildCommercialReport, dayInSaoPaulo, reportGrain } from "./metrics";
import { exampleFilters, exampleLeads, exampleReport, exampleStages } from "./sample";

assert.equal(dayInSaoPaulo("2026-10-01T02:30:00.000Z"), "2026-09-30");
assert.equal(dayInSaoPaulo("2026-10-01T15:00:00.000Z"), "2026-10-01");
assert.equal(dayInSaoPaulo(null), null);

const report = exampleReport();
assert.equal(report.metrics.newLeads, 6);
assert.equal(report.metrics.wonCount, 2);
assert.equal(report.metrics.revenue, 4300);
assert.equal(report.metrics.averageTicket, 2150);
assert.equal(report.metrics.lostCount, 1);
assert.equal(report.metrics.openCount, 3);
assert.equal(report.metrics.openValue, 2200);
assert.equal(report.metrics.wonWithoutClose, 1);
assert.ok(report.metrics.conversionPeriod != null && Math.abs(report.metrics.conversionPeriod - 2 / 6) < 1e-12);
assert.ok(report.metrics.conversionCohort != null && Math.abs(report.metrics.conversionCohort - 2 / 6) < 1e-12);
assert.deepEqual(
  report.sales.map((sale) => sale.id),
  [3, 2],
);
assert.equal(report.sales[0].pipelineName, "Vendas");
assert.deepEqual(
  report.sellers.map((seller) => [seller.name, seller.leads, seller.sales, seller.revenue]),
  [
    ["Ana", 4, 1, 2500],
    ["João", 1, 1, 1800],
    ["Luiz", 1, 0, 0],
  ],
);
const ganho = report.funnels[0].stages.find((stage) => stage.name === "Ganho");
const contato = report.funnels[0].stages.find((stage) => stage.name === "Contato");
assert.equal(ganho?.count, 3);
assert.equal(contato?.count, 2);
assert.equal(report.grain, "day");
assert.equal(new Set(exampleLeads.map((lead) => lead.id)).size < exampleLeads.length, true);

const border = buildCommercialReport(
  [
    {
      id: 20,
      name: "Virou o dia",
      price: 10,
      pipelineId: 1,
      statusId: 13,
      statusName: "Ganho",
      statusKind: "won",
      userId: 1,
      userName: "Ana",
      createdAt: "2026-09-01T15:00:00.000Z",
      updatedAt: "2026-10-01T02:30:00.000Z",
      closedAt: "2026-10-01T02:30:00.000Z",
      isDeleted: false,
      url: "https://exemplo.kommo.com/leads/detail/20",
    },
  ],
  exampleStages,
  exampleFilters,
);
assert.equal(border.metrics.wonCount, 0);
const september = buildCommercialReport(
  [
    {
      id: 20,
      name: "Virou o dia",
      price: 10,
      pipelineId: 1,
      statusId: 13,
      statusName: "Ganho",
      statusKind: "won",
      userId: 1,
      userName: "Ana",
      createdAt: "2026-09-01T15:00:00.000Z",
      updatedAt: "2026-10-01T02:30:00.000Z",
      closedAt: "2026-10-01T02:30:00.000Z",
      isDeleted: false,
      url: "https://exemplo.kommo.com/leads/detail/20",
    },
  ],
  exampleStages,
  { from: "2026-09-01", to: "2026-09-30", pipelineId: null, userId: null },
);
assert.equal(september.metrics.wonCount, 1);

const joao = buildCommercialReport(exampleLeads, exampleStages, { ...exampleFilters, userId: 2 });
assert.equal(joao.metrics.newLeads, 1);
assert.equal(joao.metrics.wonCount, 1);
assert.equal(joao.metrics.revenue, 1800);

assert.equal(reportGrain({ from: "2026-01-01", to: "2026-02-14", pipelineId: null, userId: null }), "day");
assert.equal(reportGrain({ from: "2026-01-01", to: "2026-02-15", pipelineId: null, userId: null }), "week");
assert.equal(reportGrain({ from: "2026-01-01", to: "2026-06-29", pipelineId: null, userId: null }), "week");
assert.equal(reportGrain({ from: "2026-01-01", to: "2026-06-30", pipelineId: null, userId: null }), "month");

const swapped = parseCommercialFilters(new URLSearchParams("from=2026-10-31&to=2026-10-01&pipeline=3&user=0"));
assert.ok(!("error" in swapped));
if (!("error" in swapped)) {
  assert.equal(swapped.from, "2026-10-01");
  assert.equal(swapped.to, "2026-10-31");
  assert.equal(swapped.pipelineId, 3);
  assert.equal(swapped.userId, null);
}
assert.ok("error" in parseCommercialFilters(new URLSearchParams("from=ontem&to=2026-10-01")));

const named = classifyStatuses([
  { id: 1, name: "Entrada", sort: 1, type: 1, isEditable: false },
  { id: 2, name: "Proposta", sort: 2, type: 0, isEditable: true },
  { id: 3, name: "Ganho especial", sort: 3, type: 0, isEditable: true },
  { id: 142, name: "Fechado - ganho", sort: 4, type: 0, isEditable: false },
  { id: 143, name: "Fechado - perdido", sort: 5, type: 0, isEditable: false },
]);
assert.equal(named.get(1), "unsorted");
assert.equal(named.get(2), "open");
assert.equal(named.get(3), "open");
assert.equal(named.get(142), "won");
assert.equal(named.get(143), "lost");

const positional = classifyStatuses([
  { id: 8, name: "Novo", sort: 10, type: 0, isEditable: true },
  { id: 9, name: "Negociação", sort: 20, type: 0, isEditable: true },
  { id: 10, name: "Etapa final A", sort: 30, type: 0, isEditable: false },
  { id: 11, name: "Etapa final B", sort: 40, type: 0, isEditable: false },
]);
assert.equal(positional.get(8), "open");
assert.equal(positional.get(10), "won");
assert.equal(positional.get(11), "lost");

console.log("kommo metrics ok");
