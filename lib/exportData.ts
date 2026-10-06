import * as XLSX from "xlsx";
import { formatDate, weekdayIndex } from "./format";
import { WEEKDAYS, categoryValue, sumCategories } from "./categories";
import type { LeadState } from "./types";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportJson(state: LeadState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  downloadBlob(blob, `leads-kommo-${stamp()}.json`);
}

export function exportWorkbook(state: LeadState) {
  const headers = [
    "Data",
    "Conferência",
    "Pendentes",
    "Quantidade informada",
    ...state.categories.map((category) => category.label),
    "Telefones",
    "Descrições",
  ];
  const body = state.days.map((day) => {
    const leads = state.analysis.filter((lead) => lead.date === day.date);
    const sum = sumCategories(day.counts, state.categories);
    return [
      day.date,
      day.review === "pendente" ? "Pendente" : "Conferido",
      day.pendingCount,
      day.declaredQuantity ?? sum,
      ...state.categories.map((category) => categoryValue(day.counts, category.id)),
      leads.map((lead) => lead.phone).join(", "),
      leads.map((lead) => lead.description).filter(Boolean).join(" | "),
    ];
  });
  const analysis = [
    ["Interessados em analise", "Data", "Descrição"],
    ...state.analysis.map((lead) => [lead.phone, lead.date, lead.description]),
  ];
  const motives = [
    ["Id", "Motivo", "Grupo"],
    ...state.categories.map((category) => [category.id, category.label, category.group]),
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, ...body]), "Lançamentos");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(analysis), "Em análise");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(motives), "Motivos");
  XLSX.writeFile(book, `leads-kommo-${stamp()}.xlsx`);
}

export function exportCsv(state: LeadState, dates?: Set<string>) {
  const days = dates ? state.days.filter((day) => dates.has(day.date)) : state.days;
  const headers = [
    "Data",
    "Dia da semana",
    "Conferência",
    "Pendentes",
    "Total dos motivos",
    ...state.categories.map((category) => category.label),
  ];
  const lines = [headers, ...days.map((day) => [
    formatDate(day.date),
    WEEKDAYS[weekdayIndex(day.date)].label,
    day.review === "pendente" ? "Pendente" : "Conferido",
    String(day.pendingCount),
    String(sumCategories(day.counts, state.categories)),
    ...state.categories.map((category) => String(categoryValue(day.counts, category.id))),
  ])];
  const csv = lines
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }), `leads-kommo-${stamp()}.csv`);
}

function stamp(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
