import * as XLSX from "xlsx";
import { builtinByLabel, normalizeLabel, slugify, withBuiltins } from "./categories";
import type { AnalysisLead, Category, DayRecord, GroupId, LeadState, ReviewStatus } from "./types";

type Matrix = unknown[][];

function sheetMatrix(sheet: XLSX.WorkSheet): Matrix {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: Matrix = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: unknown[] = [];
    for (let c = 0; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      if (!cell) {
        row.push(null);
        continue;
      }
      if (cell.v == null && cell.f) row.push(`=${cell.f}`);
      else row.push(cell.v ?? null);
    }
    rows.push(row);
  }
  return rows;
}

export function dateToISO(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return utc.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const text = value.trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) {
      return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    }
  }
  return null;
}

function asNumber(value: unknown): number {
  if (value == null || value === "" || value === "#") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const text = String(value).trim();
  if (!text || text === "#") return 0;
  const parsed = Number(text.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function asPhone(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number") return String(Math.round(value));
  const text = String(value).trim();
  if (text.startsWith("=")) return text.slice(1).replace(/['"]/g, "").trim();
  return text;
}

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parseReview(value: unknown): { review: ReviewStatus; pendingCount: number } {
  const text = asText(value);
  if (text.includes("❌")) {
    const digits = text.replace(/\D/g, "");
    return { review: "pendente", pendingCount: digits ? Number(digits) : 1 };
  }
  return { review: "ok", pendingCount: 0 };
}

const STRUCTURAL = new Set([
  "aviso",
  "dias",
  "quantidade por dias",
  "interessados",
  "perdidos",
]);

function isStructural(label: string): boolean {
  const key = normalizeLabel(label);
  return STRUCTURAL.has(key) || key.startsWith("obs:");
}

function findSheet(workbook: XLSX.WorkBook, predicate: (name: string) => boolean): XLSX.WorkSheet | null {
  const name = workbook.SheetNames.find((sheet) => predicate(normalizeLabel(sheet)));
  return name ? workbook.Sheets[name] : null;
}

function resolveCategory(label: string, group: GroupId, categories: Category[]): Category {
  const builtin = builtinByLabel(label);
  if (builtin) {
    if (!categories.some((category) => category.id === builtin.id)) categories.push({ ...builtin });
    return { ...builtin };
  }
  const existing = categories.find(
    (category) => normalizeLabel(category.label) === normalizeLabel(label),
  );
  if (existing) return existing;
  let id = slugify(label);
  let n = 2;
  while (categories.some((category) => category.id === id)) id = `${slugify(label)}_${n++}`;
  const created: Category = { id, label: label.trim(), group, builtin: false };
  categories.push(created);
  return created;
}

function parseOriginal(workbook: XLSX.WorkBook): LeadState {
  const sheet =
    findSheet(workbook, (name) => name === "dados") || workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheetMatrix(sheet);
  const blockStarts: number[] = [];
  rows.forEach((row, index) => {
    if (normalizeLabel(asText(row[0])) === "aviso") blockStarts.push(index);
  });
  if (!blockStarts.length) {
    throw new Error("Não encontrei a linha AVISO na aba Dados. Use a planilha original ou um backup exportado daqui.");
  }

  const categories: Category[] = [];
  const days: DayRecord[] = [];
  for (let b = 0; b < blockStarts.length; b++) {
    const start = blockStarts[b];
    const end = blockStarts[b + 1] ?? rows.length;
    const block = rows.slice(start, end);
    const dias = block.find((row) => normalizeLabel(asText(row[0])) === "dias");
    const quantidade = block.find((row) => normalizeLabel(asText(row[0])) === "quantidade por dias");
    const aviso = block[0];
    if (!dias) continue;

    let group: GroupId | null = null;
    const categoryRows: { category: Category; row: unknown[] }[] = [];
    for (const row of block) {
      const label = asText(row[0]);
      if (!label) continue;
      const key = normalizeLabel(label);
      if (key === "interessados") {
        group = "interesse";
        continue;
      }
      if (key === "perdidos") {
        group = "perdidos";
        continue;
      }
      if (key === "sem retorno") group = "sem_retorno";
      if (isStructural(label) || !group) continue;
      const category = resolveCategory(label, group, categories);
      categoryRows.push({ category, row });
    }

    const blockDays: (DayRecord & { active: boolean })[] = [];
    for (let col = 1; col < dias.length; col++) {
      const date = dateToISO(dias[col]);
      if (!date) continue;
      const counts: Record<string, number> = {};
      for (const entry of categoryRows) counts[entry.category.id] = asNumber(entry.row[col]);
      const declared = quantidade ? asNumber(quantidade[col]) : 0;
      const sum = Object.values(counts).reduce((total, value) => total + value, 0);
      const review = parseReview(aviso?.[col]);
      blockDays.push({
        date,
        review: review.review,
        pendingCount: review.pendingCount,
        declaredQuantity: declared !== sum ? declared : null,
        counts,
        active: declared > 0 || sum > 0 || review.pendingCount > 0,
      });
    }
    let last = -1;
    blockDays.forEach((day, index) => {
      if (day.active) last = index;
    });
    for (const day of blockDays.slice(0, last + 1)) {
      const { active: _active, ...record } = day;
      days.push(record);
    }
  }

  const analysisSheet = findSheet(
    workbook,
    (name) => name.includes("analise") || name.includes("análise"),
  );
  const analysis = analysisSheet ? parseAnalysisSheet(analysisSheet) : [];
  return finish({ categories, days, analysis });
}

function parseAnalysisSheet(sheet: XLSX.WorkSheet): AnalysisLead[] {
  const rows = sheetMatrix(sheet);
  const leads: AnalysisLead[] = [];
  rows.slice(1).forEach((row, index) => {
    const phone = asPhone(row[0]);
    if (!phone) return;
    leads.push({
      id: `analise-${index + 1}-${phone}`,
      phone,
      date: dateToISO(row[1]) || "",
      description: asText(row[2]),
    });
  });
  return leads;
}

function parseExported(workbook: XLSX.WorkBook): LeadState {
  const sheet =
    findSheet(workbook, (name) => name === "lancamentos" || name.startsWith("lancamento")) ||
    workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheetMatrix(sheet);
  if (!rows.length) throw new Error("A planilha exportada está vazia.");
  const headers = rows[0].map((cell) => asText(cell));
  const indexOf = (name: string) => headers.findIndex((header) => normalizeLabel(header) === name);
  const dateCol = indexOf("data");
  if (dateCol < 0) throw new Error("A planilha precisa de uma coluna Data.");
  const reviewCol = indexOf("conferencia");
  const pendingCol = indexOf("pendentes");
  const declaredCol = indexOf("quantidade informada");
  const reserved = new Set([
    "data",
    "conferencia",
    "pendentes",
    "quantidade informada",
    "telefones",
    "descricoes",
    "descrições",
  ]);
  const categories: Category[] = [];
  const savedGroups = new Map<string, GroupId>();
  const motiveSheet = findSheet(workbook, (name) => name === "motivos");
  if (motiveSheet) {
    for (const row of sheetMatrix(motiveSheet).slice(1)) {
      const label = asText(row[1] ?? row[0]);
      const group = asText(row[2]);
      if (!label) continue;
      if (group === "interesse" || group === "sem_retorno" || group === "perdidos") {
        savedGroups.set(normalizeLabel(label), group);
      }
    }
  }
  const columnCategories = headers
    .map((header, index) => ({ header, index }))
    .filter((column) => column.header && !reserved.has(normalizeLabel(column.header)));
  const resolved = columnCategories.map((column) =>
    resolveCategory(
      column.header,
      savedGroups.get(normalizeLabel(column.header)) || "perdidos",
      categories,
    ),
  );
  // Group of known labels comes from builtin; unknown exported columns need a better group.
  // idForLabel already assigns builtin groups. Unknown ones defaulted to perdidos — fix via header suffix? Keep perdidos only if not builtin.
  const days: DayRecord[] = [];
  for (const row of rows.slice(1)) {
    const date = dateToISO(row[dateCol]);
    if (!date) continue;
    const counts: Record<string, number> = {};
    columnCategories.forEach((column, position) => {
      counts[resolved[position].id] = asNumber(row[column.index]);
    });
    const reviewText = reviewCol >= 0 ? normalizeLabel(asText(row[reviewCol])) : "conferido";
    const pending = pendingCol >= 0 ? asNumber(row[pendingCol]) : 0;
    const review: ReviewStatus = reviewText.includes("pend") || pending > 0 ? "pendente" : "ok";
    const declared = declaredCol >= 0 ? asNumber(row[declaredCol]) : 0;
    const sum = Object.values(counts).reduce((total, value) => total + value, 0);
    days.push({
      date,
      review,
      pendingCount: review === "pendente" ? Math.max(1, pending) : 0,
      declaredQuantity: declaredCol >= 0 && declared !== sum ? declared : null,
      counts,
    });
  }

  const analysisSheet = findSheet(workbook, (name) => name.includes("analise"));
  const analysis = analysisSheet ? parseAnalysisSheet(analysisSheet) : [];
  return finish({ categories, days, analysis });
}

function finish(partial: { categories: Category[]; days: DayRecord[]; analysis: AnalysisLead[] }): LeadState {
  const byDate = new Map<string, DayRecord>();
  for (const day of partial.days) byDate.set(day.date, day);
  const seenLeads = new Set<string>();
  const analysis: AnalysisLead[] = [];
  for (const lead of partial.analysis) {
    const key = `${lead.phone}|${lead.date}`;
    if (seenLeads.has(key)) continue;
    seenLeads.add(key);
    analysis.push(lead);
  }
  return {
    version: 1,
    categories: withBuiltins(partial.categories),
    days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    analysis,
  };
}

export function parseWorkbook(data: ArrayBuffer | Uint8Array): LeadState {
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const names = workbook.SheetNames.map((name) => normalizeLabel(name));
  if (names.some((name) => name === "lancamentos" || name.startsWith("lancamento"))) {
    return parseExported(workbook);
  }
  if (names.some((name) => name === "dados")) return parseOriginal(workbook);
  const first = sheetMatrix(workbook.Sheets[workbook.SheetNames[0]]);
  const header = (first[0] || []).map((cell) => normalizeLabel(asText(cell)));
  if (header.includes("data") && header.includes("conferencia")) return parseExported(workbook);
  return parseOriginal(workbook);
}

export function mergeStates(current: LeadState, incoming: LeadState): LeadState {
  const categories = withBuiltins([...current.categories]);
  for (const category of incoming.categories) {
    const sameId = categories.find((item) => item.id === category.id);
    const sameLabel = categories.find(
      (item) => normalizeLabel(item.label) === normalizeLabel(category.label),
    );
    if (!sameId && !sameLabel) categories.push(category);
  }
  const days = new Map(current.days.map((day) => [day.date, day]));
  for (const day of incoming.days) days.set(day.date, day);
  const analysis = [...current.analysis];
  for (const lead of incoming.analysis) {
    const exists = analysis.some((item) => item.phone === lead.phone && item.date === lead.date);
    if (!exists) {
      analysis.push({ ...lead, id: `analise-${crypto.randomUUID()}` });
    }
  }
  return {
    version: 1,
    categories,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    analysis,
  };
}
