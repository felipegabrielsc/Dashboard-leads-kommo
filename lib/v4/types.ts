export type V4Row = {
  sourceRow: number;
  saleDate: string;
  customerName: string;
  customerKey: string;
  amount: number;
  purchaseNumber: number;
  isRepurchase: boolean;
  sellerName: string;
  rawMaterialCost: number | null;
  taxCost: number | null;
  operationalCost: number | null;
  profit: number | null;
};

export type V4Issue = {
  sourceRow: number;
  message: string;
};

export type V4Candidate = {
  id: number;
  name: string;
  price: number;
  closedOn: string;
  strong: boolean;
};

export type V4Suggestion = {
  sourceRow: number;
  candidates: V4Candidate[];
};

export type V4Customer = {
  key: string;
  name: string;
  purchases: number;
  amount: number;
  sellers: string;
};

export type V4SummaryView = {
  ready: boolean;
  imported: boolean;
  kommoRevenue: number;
  repurchaseRevenue: number;
  consolidatedRevenue: number;
  repurchaseCount: number;
  repurchaseTicket: number | null;
  estimatedProfit: number;
  excludedCount: number;
  customers: V4Customer[];
  batch: { fileName: string; importedAt: string; rowCount: number } | null;
  note: string;
};
