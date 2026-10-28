import type { CommercialFilters } from "./types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseCommercialFilters(search: URLSearchParams): CommercialFilters | { error: string } {
  const from = search.get("from") || "";
  const to = search.get("to") || "";
  if (!DAY.test(from) || !DAY.test(to)) return { error: "Informe o período com datas válidas." };
  const pipeline = Number(search.get("pipeline") || "");
  const user = Number(search.get("user") || "");
  return {
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    pipelineId: Number.isInteger(pipeline) && pipeline > 0 ? pipeline : null,
    userId: Number.isInteger(user) && user > 0 ? user : null,
  };
}
