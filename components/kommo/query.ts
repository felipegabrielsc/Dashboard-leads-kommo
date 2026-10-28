import { addDays } from "@/lib/format";

export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function monthStart(today = localToday()): string {
  return `${today.slice(0, 7)}-01`;
}

export function commercialSearch(input: {
  from: string;
  to: string;
  pipeline?: string;
  user?: string;
  q?: string;
  page?: number;
}): string {
  const params = new URLSearchParams();
  params.set("from", input.from);
  params.set("to", input.to);
  if (input.pipeline) params.set("pipeline", input.pipeline);
  if (input.user) params.set("user", input.user);
  if (input.q) params.set("q", input.q);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  return params.toString();
}

export function periodPresets(today = localToday()) {
  return [
    { id: "mes", label: "Este mês", from: monthStart(today), to: today },
    { id: "30", label: "30 dias", from: addDays(today, -29), to: today },
    { id: "7", label: "7 dias", from: addDays(today, -6), to: today },
  ];
}
