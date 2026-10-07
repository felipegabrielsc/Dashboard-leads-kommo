export type GroupId = "interesse" | "sem_retorno" | "perdidos";

export type Category = {
  id: string;
  label: string;
  group: GroupId;
  builtin?: boolean;
};

export type ReviewStatus = "ok" | "pendente";

export type DayRecord = {
  date: string;
  review: ReviewStatus;
  pendingCount: number;
  declaredQuantity: number | null;
  counts: Record<string, number>;
};

export type AnalysisLead = {
  id: string;
  phone: string;
  date: string;
  description: string;
};

export type ChangeEntry = {
  id: string;
  createdAt: string;
  actor: string;
  kind: string;
  day: string;
  categoryId: string;
  summary: string;
};

export type LeadState = {
  version: 1;
  categories: Category[];
  days: DayRecord[];
  analysis: AnalysisLead[];
};

export type ReviewFilter = "todos" | "ok" | "pendente";
export type DivergenceFilter = "todos" | "somente";

export type Filters = {
  from: string;
  to: string;
  months: string[];
  weekdays: number[];
  review: ReviewFilter;
  divergence: DivergenceFilter;
  groups: GroupId[];
  motives: string[];
  query: string;
};
