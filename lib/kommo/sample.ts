import { buildCommercialReport } from "./metrics";
import type { CommercialLead, CommercialReport, Stage } from "./types";

export const exampleFilters = { from: "2026-10-01", to: "2026-10-31", pipelineId: null, userId: null };

export const exampleStages: Stage[] = [
  { pipelineId: 1, pipelineName: "Vendas", statusId: 10, name: "Entrada", sort: 10, kind: "unsorted" },
  { pipelineId: 1, pipelineName: "Vendas", statusId: 11, name: "Contato", sort: 20, kind: "open" },
  { pipelineId: 1, pipelineName: "Vendas", statusId: 12, name: "Proposta", sort: 30, kind: "open" },
  { pipelineId: 1, pipelineName: "Vendas", statusId: 13, name: "Ganho", sort: 10000, kind: "won" },
  { pipelineId: 1, pipelineName: "Vendas", statusId: 14, name: "Perdido", sort: 11000, kind: "lost" },
];

function lead(partial: Partial<CommercialLead> & Pick<CommercialLead, "id" | "statusKind">): CommercialLead {
  return {
    name: `Negócio ${partial.id}`,
    price: 0,
    pipelineId: 1,
    statusId: partial.statusKind === "won" ? 13 : partial.statusKind === "lost" ? 14 : 11,
    statusName: partial.statusKind === "won" ? "Ganho" : partial.statusKind === "lost" ? "Perdido" : "Contato",
    userId: 1,
    userName: "Ana",
    createdAt: "2026-10-02T15:00:00.000Z",
    updatedAt: "2026-10-02T15:00:00.000Z",
    closedAt: null,
    isDeleted: false,
    url: `https://exemplo.kommo.com/leads/detail/${partial.id}`,
    ...partial,
  };
}

export const exampleLeads: CommercialLead[] = [
  lead({ id: 1, name: "Caixa pequena", price: 1000, statusKind: "open", statusId: 11, userId: 1, userName: "Ana" }),
  lead({
    id: 2,
    name: "Pedido da Ana",
    price: 2500,
    statusKind: "won",
    createdAt: "2026-10-03T15:00:00.000Z",
    updatedAt: "2026-10-10T15:00:00.000Z",
    closedAt: "2026-10-10T15:00:00.000Z",
  }),
  lead({
    id: 2,
    name: "Pedido da Ana antigo",
    price: 900,
    statusKind: "open",
    updatedAt: "2026-10-04T15:00:00.000Z",
  }),
  lead({
    id: 3,
    name: "Pedido antigo fechado agora",
    price: 1800,
    statusKind: "won",
    userId: 2,
    userName: "João",
    createdAt: "2026-09-20T15:00:00.000Z",
    updatedAt: "2026-10-12T15:00:00.000Z",
    closedAt: "2026-10-12T15:00:00.000Z",
  }),
  lead({
    id: 4,
    name: "Pedido perdido",
    price: 900,
    statusKind: "lost",
    statusId: 14,
    userId: 2,
    userName: "João",
    createdAt: "2026-10-04T15:00:00.000Z",
    closedAt: "2026-10-08T15:00:00.000Z",
    updatedAt: "2026-10-08T15:00:00.000Z",
  }),
  lead({ id: 5, name: "Proposta do Luiz", price: 700, statusKind: "open", statusId: 12, userId: 3, userName: "Luiz", createdAt: "2026-10-05T15:00:00.000Z" }),
  lead({
    id: 8,
    name: "Ganho sem data",
    price: 400,
    statusKind: "won",
    createdAt: "2026-10-06T15:00:00.000Z",
    updatedAt: "2026-10-06T15:00:00.000Z",
    closedAt: null,
  }),
  lead({ id: 9, name: "Apagado", price: 5000, statusKind: "won", isDeleted: true, closedAt: "2026-10-09T15:00:00.000Z" }),
  lead({
    id: 10,
    name: "Reaberto",
    price: 500,
    statusKind: "open",
    createdAt: "2026-10-01T15:00:00.000Z",
    closedAt: "2026-10-15T15:00:00.000Z",
    updatedAt: "2026-10-16T15:00:00.000Z",
  }),
];

export function exampleReport(): CommercialReport {
  return buildCommercialReport(exampleLeads, exampleStages, exampleFilters);
}
