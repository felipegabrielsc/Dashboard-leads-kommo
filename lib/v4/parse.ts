import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import type { V4Issue, V4Row } from "./types";

export type V4ParseResult = {
  rows: V4Row[];
  invalid: V4Issue[];
  warnings: V4Issue[];
  totals: {
    totalCount: number;
    totalAmount: number;
    firstCount: number;
    firstAmount: number;
    repurchaseCount: number;
    repurchaseAmount: number;
  };
};

const HEADER_DATE = new Set(["data"]);
const HEADER_CUSTOMER = new Set(["cliente"]);

export function fileHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function customerKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function blank(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function normalized(value: unknown): string {
  return customerKey(text(value));
}

export function parseMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return roundMoney(value);
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/r\$/gi, "").replace(/\s/g, "").trim();
  if (!cleaned || !/\d/.test(cleaned)) return null;
  let normalizedMoney = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalizedMoney = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    normalizedMoney = cleaned.replace(/\./g, "").replace(",", ".");
  }
  const parsed = Number(normalizedMoney);
  if (!Number.isFinite(parsed)) return null;
  return roundMoney(parsed);
}

export function parseSaleDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0) return `${year}-${month}-${day}`;
    const localYear = value.getFullYear();
    const localMonth = String(value.getMonth() + 1).padStart(2, "0");
    const localDay = String(value.getDate()).padStart(2, "0");
    return `${localYear}-${localMonth}-${localDay}`;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 20000 && value < 80000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return utc.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const raw = value.trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (br) {
      const year = br[3].length === 2 ? `20${br[3]}` : br[3];
      return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    }
  }
  return null;
}

function parsePurchase(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    if (rounded >= 1 && Math.abs(value - rounded) < 0.001) return rounded;
    return null;
  }
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d+)/);
    if (!match) return null;
    const parsed = Number(match[1]);
    return parsed >= 1 ? parsed : null;
  }
  return null;
}

function materializeCost(value: unknown, amount: number): number | null {
  if (blank(value)) return null;
  const parsed = parseMoney(value);
  if (parsed == null) return null;
  if (amount > 1 && parsed > 0 && parsed <= 1) return roundMoney(parsed * amount);
  return parsed;
}

function sheetRows(sheet: XLSX.WorkSheet): { excelRow: number; cells: unknown[] }[] {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: { excelRow: number; cells: unknown[] }[] = [];
  const last = Math.min(range.e.c, 8);
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells: unknown[] = [];
    for (let c = 0; c <= last; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      cells.push(cell?.v ?? null);
    }
    rows.push({ excelRow: r + 1, cells });
  }
  return rows;
}

function isHeader(cells: unknown[]): boolean {
  return HEADER_DATE.has(normalized(cells[0])) && HEADER_CUSTOMER.has(normalized(cells[1]));
}

function emptyRow(cells: unknown[]): boolean {
  return cells.every((cell) => blank(cell));
}

function totalsOf(rows: V4Row[]): V4ParseResult["totals"] {
  const first = rows.filter((row) => !row.isRepurchase);
  const repurchase = rows.filter((row) => row.isRepurchase);
  const sum = (list: V4Row[]) => roundMoney(list.reduce((total, row) => total + row.amount, 0));
  return {
    totalCount: rows.length,
    totalAmount: sum(rows),
    firstCount: first.length,
    firstAmount: sum(first),
    repurchaseCount: repurchase.length,
    repurchaseAmount: sum(repurchase),
  };
}

export function parseV4Sheet(rows: { excelRow: number; cells: unknown[] }[]): V4ParseResult {
  const parsed: V4Row[] = [];
  const invalid: V4Issue[] = [];
  let started = false;
  for (const row of rows) {
    if (emptyRow(row.cells)) continue;
    if (!started && isHeader(row.cells)) {
      started = true;
      continue;
    }
    const saleDate = parseSaleDate(row.cells[0]);
    const customerName = text(row.cells[1]);
    const amount = parseMoney(row.cells[2]);
    const purchaseNumber = parsePurchase(row.cells[3]);
    if (!saleDate && !customerName && amount == null && purchaseNumber == null) continue;
    started = true;
    const problems: string[] = [];
    if (!saleDate) problems.push("data inválida");
    if (!customerName) problems.push("cliente vazio");
    if (amount == null || amount < 0) problems.push("valor inválido");
    if (!purchaseNumber) problems.push("número da compra inválido");
    if (problems.length || !saleDate || amount == null || !purchaseNumber) {
      invalid.push({ sourceRow: row.excelRow, message: `Linha ${row.excelRow}: ${problems.join(", ")}.` });
      continue;
    }
    parsed.push({
      sourceRow: row.excelRow,
      saleDate,
      customerName,
      customerKey: customerKey(customerName),
      amount,
      purchaseNumber,
      isRepurchase: purchaseNumber > 1,
      sellerName: text(row.cells[4]),
      rawMaterialCost: materializeCost(row.cells[5], amount),
      taxCost: materializeCost(row.cells[6], amount),
      operationalCost: materializeCost(row.cells[7], amount),
      profit: materializeCost(row.cells[8], amount),
    });
  }

  const warnings: V4Issue[] = [];
  const seen = new Map<string, number>();
  for (const row of parsed) {
    const key = [row.customerKey, row.saleDate, row.amount.toFixed(2), row.purchaseNumber, customerKey(row.sellerName)].join("|");
    const previous = seen.get(key);
    if (previous) {
      warnings.push({
        sourceRow: row.sourceRow,
        message: `Linha ${row.sourceRow} repete cliente, data, valor, compra e vendedor da linha ${previous}. As duas foram mantidas para revisão.`,
      });
    } else {
      seen.set(key, row.sourceRow);
    }
  }

  return { rows: parsed, invalid, warnings, totals: totalsOf(parsed) };
}

export function parseV4Workbook(data: ArrayBuffer | Uint8Array): V4ParseResult {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  const name = workbook.SheetNames.find((sheet) => /informa/i.test(sheet)) || workbook.SheetNames[0];
  if (!name) return parseV4Sheet([]);
  return parseV4Sheet(sheetRows(workbook.Sheets[name]));
}
