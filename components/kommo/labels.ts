export function formatWhen(iso: string | null): string {
  if (!iso) return "ainda não";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function phaseLabel(phase: string): string {
  if (phase === "pipelines") return "Lendo funis";
  if (phase === "leads") return "Lendo negócios";
  if (phase === "deleted") return "Conferindo exclusões";
  return "Em dia";
}

export function grainLabel(grain: "day" | "week" | "month"): string {
  if (grain === "week") return "por semana";
  if (grain === "month") return "por mês";
  return "por dia";
}
