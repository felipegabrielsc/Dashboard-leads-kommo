export type StatusKind = "unsorted" | "open" | "won" | "lost";

export type CommercialLead = {
  id: number;
  name: string;
  price: number;
  pipelineId: number | null;
  statusId: number | null;
  statusName: string;
  statusKind: StatusKind;
  userId: number | null;
  userName: string;
  createdAt: string | null;
  updatedAt: string | null;
  closedAt: string | null;
  isDeleted: boolean;
  url: string;
};

export type Stage = {
  pipelineId: number;
  pipelineName: string;
  statusId: number;
  name: string;
  sort: number;
  kind: StatusKind;
};

export type CommercialFilters = {
  from: string;
  to: string;
  pipelineId: number | null;
  userId: number | null;
};

export type SaleRow = {
  id: number;
  name: string;
  price: number;
  closedAt: string | null;
  createdAt: string | null;
  pipelineName: string;
  statusName: string;
  userName: string;
  url: string;
};

export type PublicSync = {
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string;
  phase: "idle" | "pipelines" | "leads" | "deleted";
  pagesDone: number;
  upserted: number;
  fullReconcileAt: string | null;
  mode: "full" | "incremental";
};

export type CommercialReport = {
  metrics: {
    newLeads: number;
    wonCount: number;
    revenue: number;
    averageTicket: number | null;
    conversionPeriod: number | null;
    conversionCohort: number | null;
    lostCount: number;
    openCount: number;
    openValue: number;
    wonWithoutClose: number;
  };
  grain: "day" | "week" | "month";
  series: { key: string; label: string; leads: number; sales: number; revenue: number }[];
  sellers: { id: number | null; name: string; leads: number; sales: number; revenue: number; conversion: number | null }[];
  funnels: { pipelineId: number; pipelineName: string; stages: { statusId: number; name: string; kind: StatusKind; count: number; value: number }[] }[];
  sales: SaleRow[];
};
