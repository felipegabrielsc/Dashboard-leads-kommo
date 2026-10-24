import { normalizeLabel, slugify } from "./categories";

export type QuoteFamily = "padrao" | "corte_vinco";

export type QuoteTier = {
  quantity: number;
  unitPrice: number;
  detail?: string;
};

export type Quote = {
  id: string;
  width: number;
  depth: number;
  height: number;
  material: string;
  note: string;
  family: QuoteFamily;
  tiers: QuoteTier[];
};

const DIMENSIONS = /(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/i;
const BARE_DIMENSIONS = /^(\d+)\s*x\s*(\d+)\s*x\s*(\d+)\s*$/i;
const QTY = String.raw`(\d{1,3}(?:\.\d{3})+|\d+)`;
const MONEY = String.raw`(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})`;

type QuoteIdentity = Pick<Quote, "width" | "depth" | "height" | "material" | "note"> & {
  family?: QuoteFamily;
};

export function quoteKey(quote: QuoteIdentity): string {
  const note = normalizeLabel(quote.note);
  const base = `${quote.width}x${quote.depth}x${quote.height}|${normalizeLabel(quote.material)}|${note}`;
  if (quote.family === "corte_vinco" && !note.includes("vinco")) return `${base}|corte_vinco`;
  return base;
}

export function quoteId(quote: QuoteIdentity): string {
  return slugify(quoteKey(quote).replace(/\|/g, " "));
}

export function familyLabel(family: QuoteFamily | undefined): string {
  return family === "corte_vinco" ? "Corte e vinco" : "Caixas comuns";
}

export function displayNote(quote: Pick<Quote, "note" | "family">): string {
  const note = quote.note.trim();
  if (quote.family !== "corte_vinco") return note;
  return note
    .replace(/corte\s+e\s+vinco/gi, "")
    .replace(/corte\s+vinco/gi, "")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-–—\s]+|[-–—\s]+$/g, "")
    .trim();
}

export function quoteTitle(quote: Pick<Quote, "width" | "depth" | "height" | "note" | "family">): string {
  const base = `Caixa ${quote.width} × ${quote.depth} × ${quote.height}`;
  const note = displayNote(quote);
  return note ? `${base} ${note}` : base;
}

export function tierQuantityLabel(tier: QuoteTier, noun = "un."): string {
  if (tier.quantity === 1 && tier.detail === "a unidade") return "a unidade";
  const amount = Math.round(tier.quantity)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const base = `${amount} ${noun}`.trim();
  return tier.detail ? `${base} · ${tier.detail}` : base;
}

export function formatCm(millimeters: number): string {
  const tenths = Math.round(millimeters);
  const whole = Math.trunc(tenths / 10);
  const fraction = Math.abs(tenths % 10);
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return fraction ? `${grouped},${fraction}` : grouped;
}

export function formatMeasuresCm(quote: Pick<Quote, "width" | "depth" | "height">, separator = "×"): string {
  return `${formatCm(quote.width)} ${separator} ${formatCm(quote.depth)} ${separator} ${formatCm(quote.height)} cm`;
}

function readMoney(raw: string): number {
  return Number(raw.replaceAll(".", "").replace(",", "."));
}

function parseQuantity(raw: string): number {
  return Number(raw.replaceAll(".", ""));
}

function detailFrom(line: string): string {
  return [...line.matchAll(/\(([^)]+)\)/g)]
    .map((item) => item[1].trim())
    .filter(Boolean)
    .join(", ");
}

type ParsedPrice = { kind: "tier"; tier: QuoteTier } | { kind: "fixed"; unitPrice: number };

function parsePriceLine(line: string): ParsedPrice | null {
  const fixed = line.match(new RegExp(`^${MONEY}\\s+fixo\\b`, "i"));
  if (fixed) {
    const unitPrice = readMoney(fixed[1]);
    return Number.isFinite(unitPrice) ? { kind: "fixed", unitPrice } : null;
  }

  const unitOnly = line.match(new RegExp(`^R\\$\\s*${MONEY}\\s+a\\s+unidade\\b`, "i"));
  if (unitOnly) {
    const unitPrice = readMoney(unitOnly[1]);
    if (!Number.isFinite(unitPrice)) return null;
    return { kind: "tier", tier: { quantity: 1, unitPrice, detail: "a unidade" } };
  }

  const withQty = line.match(
    new RegExp(`^${QTY}\\s*(?:caixas?\\s*)?(?:[-–—]\\s*)?(?:R\\$\\s*)?${MONEY}\\b`, "i"),
  );
  if (!withQty || !/caixas?\b|R\$|[-–—]/i.test(line)) return null;
  const quantity = parseQuantity(withQty[1]);
  const unitPrice = readMoney(withQty[2]);
  if (!quantity || !Number.isFinite(unitPrice)) return null;
  const detail = detailFrom(line);
  return { kind: "tier", tier: detail ? { quantity, unitPrice, detail } : { quantity, unitPrice } };
}

function takeTrailingTier(text: string): { rest: string; tier: QuoteTier | null } {
  const match = text.match(
    /(?:^|\s)[-–—]?\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s+a\s+unidade\b\.?\s*$/i,
  );
  if (!match || match.index == null) return { rest: text, tier: null };
  const unitPrice = readMoney(match[1]);
  if (!Number.isFinite(unitPrice)) return { rest: text, tier: null };
  return { rest: text.slice(0, match.index), tier: { quantity: 1, unitPrice, detail: "a unidade" } };
}

function splitExtra(before: string, after: string): { material: string; note: string } {
  const material: string[] = [];
  const note: string[] = [];
  for (const part of [before, after]) {
    const text = part
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[-–—]\s*/, "")
      .replace(/\s*[-–—]\s*$/, "")
      .replace(/\.$/, "")
      .trim();
    if (!text) continue;
    if (/papel[aã]o/i.test(text)) material.push(text);
    else note.push(text);
  }
  return { material: material.join(" "), note: note.join(" ") };
}

type RawQuote = {
  width: number;
  depth: number;
  height: number;
  material: string;
  note: string;
  tiers: QuoteTier[];
  header: string;
  headerKind: "caixa" | "bare";
  mentionedVinco: boolean;
  pendingPrice: number | null;
};

function blankRaw(
  width: number,
  depth: number,
  height: number,
  header: string,
  headerKind: "caixa" | "bare",
  material: string,
  note: string,
  tier: QuoteTier | null,
): RawQuote {
  return {
    width,
    depth,
    height,
    material,
    note,
    tiers: tier ? [tier] : [],
    header,
    headerKind,
    mentionedVinco: /vinco/i.test(header),
    pendingPrice: null,
  };
}

function measuresFor(raw: RawQuote, family: QuoteFamily): { width: number; depth: number; height: number } {
  const width = raw.width;
  const depth = raw.depth;
  const height = raw.height;
  if (family !== "corte_vinco" || /\bmm\b|mil[ií]met/i.test(raw.header)) return { width, depth, height };
  if (/\bcm\b|cent[ií]met/i.test(raw.header) || Math.max(width, depth, height) < 100) {
    return { width: width * 10, depth: depth * 10, height: height * 10 };
  }
  return { width, depth, height };
}

function finishRaw(raws: RawQuote[]): Quote[] {
  const explicit = raws.filter((raw) => raw.mentionedVinco || raw.headerKind === "bare").length;
  const withPaper = raws.filter((raw) => raw.material.trim()).length;
  const fileIsDieCut = withPaper === 0 && explicit > 0;
  const quotes: Quote[] = [];

  for (const raw of raws) {
    const family: QuoteFamily =
      raw.mentionedVinco || raw.headerKind === "bare" || (fileIsDieCut && !raw.material.trim())
        ? "corte_vinco"
        : "padrao";
    const measures = measuresFor(raw, family);
    const tiers = [...raw.tiers];
    if (raw.pendingPrice != null) tiers.push({ quantity: 1, unitPrice: raw.pendingPrice, detail: "preço fixo" });
    tiers.sort((a, b) => a.quantity - b.quantity);
    const partial = {
      ...measures,
      material: raw.material,
      note: raw.note,
      family,
      tiers,
    };
    quotes.push({ ...partial, id: quoteId(partial) });
  }

  const byId = new Map<string, Quote>();
  for (const quote of quotes) byId.set(quote.id, quote);
  return [...byId.values()].sort(compareQuotes);
}

export function parseQuotes(text: string): Quote[] {
  const raws: RawQuote[] = [];
  let current: RawQuote | null = null;

  function commit() {
    if (!current) return;
    if (current.tiers.length || current.pendingPrice != null) raws.push(current);
    current = null;
  }

  function pushTier(parsed: ParsedPrice) {
    if (!current) return;
    if (parsed.kind === "fixed") {
      current.pendingPrice = parsed.unitPrice;
      return;
    }
    current.pendingPrice = null;
    current.tiers.push(parsed.tier);
  }

  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^quantidade\s+valor/i.test(line) || /^esse e o formato/i.test(normalizeLabel(line))) continue;

    const caixa = line.match(/^caixa\b(.*)$/i);
    const dims = caixa ? caixa[1].match(DIMENSIONS) : null;
    if (caixa && dims && dims.index != null) {
      commit();
      const trailing = takeTrailingTier(caixa[1].slice(dims.index + dims[0].length));
      const extra = splitExtra(caixa[1].slice(0, dims.index), trailing.rest);
      current = blankRaw(
        Number(dims[1]),
        Number(dims[2]),
        Number(dims[3]),
        line,
        "caixa",
        extra.material,
        extra.note,
        trailing.tier,
      );
      continue;
    }

    const bare = line.match(BARE_DIMENSIONS);
    if (bare) {
      commit();
      current = blankRaw(Number(bare[1]), Number(bare[2]), Number(bare[3]), line, "bare", "", "", null);
      continue;
    }

    if (/^papel[aã]o\b/i.test(line)) {
      if (current) current.material = line.replace(/\.$/, "").trim();
      continue;
    }

    const minimo = line.match(/^m[ií]nimo\s+de\s+(\d{1,3}(?:\.\d{3})+|\d+)\b/i);
    if (minimo && current?.pendingPrice != null) {
      current.tiers.push({
        quantity: parseQuantity(minimo[1]),
        unitPrice: current.pendingPrice,
        detail: "preço fixo",
      });
      current.pendingPrice = null;
      continue;
    }

    const parsed = parsePriceLine(line);
    if (parsed) pushTier(parsed);
  }
  commit();
  return finishRaw(raws);
}

function compareQuotes(a: Quote, b: Quote): number {
  const familyOrder = (a.family === "corte_vinco" ? 1 : 0) - (b.family === "corte_vinco" ? 1 : 0);
  return (
    familyOrder ||
    a.width - b.width ||
    a.depth - b.depth ||
    a.height - b.height ||
    a.material.localeCompare(b.material, "pt-BR") ||
    a.note.localeCompare(b.note, "pt-BR")
  );
}

const MEASURE = /\d+(?:[.,]\d+)?/g;
const THREE_MEASURES = /\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?/i;

function askedMeasures(query: string): number[] {
  return [...query.matchAll(MEASURE)].map((item) => Number(item[0].replace(",", ".")));
}

function sameMeasure(storedMm: number, asked: number): boolean {
  if (!Number.isFinite(asked)) return false;
  if (storedMm === asked) return true;
  return Math.abs(storedMm / 10 - asked) < 0.051;
}

export function searchQuotes(quotes: Quote[], query: string, material = "", family: "" | QuoteFamily = ""): Quote[] {
  const numbers = askedMeasures(query);
  const ignored = new Set(["x", "caixa", "caixas", "rs", "unidade", "cm", "mm", "centimetro", "milimetro"]);
  const words = normalizeLabel(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !ignored.has(token) && !/^\d+$/.test(token));
  return quotes.filter((quote) => {
    if (family && quote.family !== family) return false;
    if (material === "__none__" && quote.material) return false;
    if (material && material !== "__none__" && normalizeLabel(quote.material) !== normalizeLabel(material)) return false;
    const dims = [quote.width, quote.depth, quote.height];
    if (numbers.length === 3 && THREE_MEASURES.test(query)) {
      if (!dims.every((dim, index) => sameMeasure(dim, numbers[index]))) return false;
    } else if (numbers.length > 0 && !numbers.every((number) => dims.some((dim) => sameMeasure(dim, number)))) {
      return false;
    }
    if (!words.length) return true;
    const familyText = quote.family === "corte_vinco" ? "corte e vinco" : "";
    const haystack = normalizeLabel(`${quote.material} ${quote.note} ${familyText}`);
    return words.every((word) => haystack.includes(word));
  });
}

export type QuoteDraft = {
  width: string;
  depth: string;
  height: string;
  material: string;
  note: string;
  family: QuoteFamily;
  tiers: { quantity: string; unitPrice: string }[];
};

export function emptyQuoteDraft(): QuoteDraft {
  return {
    width: "",
    depth: "",
    height: "",
    material: "",
    note: "",
    family: "padrao",
    tiers: [{ quantity: "", unitPrice: "" }],
  };
}

export function draftFromQuote(quote: Quote): QuoteDraft {
  return {
    width: String(quote.width),
    depth: String(quote.depth),
    height: String(quote.height),
    material: quote.material,
    note: quote.note,
    family: quote.family === "corte_vinco" ? "corte_vinco" : "padrao",
    tiers: quote.tiers.map((tier) => ({
      quantity: String(tier.quantity),
      unitPrice: tier.unitPrice.toFixed(2).replace(".", ","),
    })),
  };
}

export function parseWholeNumber(value: string): number | null {
  const cleaned = value.trim().replace(/\s/g, "").replace(/\./g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const number = Number(cleaned);
  return number > 0 ? number : null;
}

export function parseMoney(value: string): number | null {
  const cleaned = value.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function buildQuote(draft: QuoteDraft): { quote: Quote } | { error: string } {
  const width = parseWholeNumber(draft.width);
  const depth = parseWholeNumber(draft.depth);
  const height = parseWholeNumber(draft.height);
  if (!width || !depth || !height) return { error: "Informe as três medidas, só com números." };

  const tiers: QuoteTier[] = [];
  const seen = new Set<number>();
  for (const row of draft.tiers) {
    if (!row.quantity.trim() && !row.unitPrice.trim()) continue;
    const quantity = parseWholeNumber(row.quantity);
    const unitPrice = parseMoney(row.unitPrice);
    if (!quantity || unitPrice == null) return { error: "Cada faixa precisa de quantidade e valor, como 100 e 2,92." };
    if (seen.has(quantity)) return { error: "Há duas faixas com a mesma quantidade." };
    seen.add(quantity);
    tiers.push({ quantity, unitPrice });
  }
  if (!tiers.length) return { error: "Inclua pelo menos uma faixa de quantidade e valor." };
  tiers.sort((a, b) => a.quantity - b.quantity);

  const note = draft.note.trim();
  const family: QuoteFamily = draft.family === "corte_vinco" || /vinco/i.test(note) ? "corte_vinco" : "padrao";
  const partial = {
    width,
    depth,
    height,
    material: draft.material.trim().replace(/\.$/, ""),
    note,
    family,
    tiers,
  };
  return { quote: { ...partial, id: quoteId(partial) } };
}

export function lowestUnitPrice(quote: Quote): number {
  return Math.min(...quote.tiers.map((tier) => tier.unitPrice));
}

export type QuoteGroup = {
  key: string;
  label: string;
  family: QuoteFamily;
  material: string;
  quotes: Quote[];
};

export function groupQuotes(quotes: Quote[]): QuoteGroup[] {
  const groups = new Map<string, QuoteGroup>();
  for (const quote of quotes) {
    const family: QuoteFamily = quote.family === "corte_vinco" ? "corte_vinco" : "padrao";
    const material = quote.material.trim();
    const label =
      family === "corte_vinco"
        ? material
          ? `Corte e vinco · ${material}`
          : "Corte e vinco"
        : material || "Papelão não informado";
    const key = `${family}|${label}`;
    const group = groups.get(key);
    if (group) group.quotes.push(quote);
    else groups.set(key, { key, label, family, material, quotes: [quote] });
  }
  return [...groups.values()].sort((a, b) => {
    const familyOrder = (a.family === "corte_vinco" ? 1 : 0) - (b.family === "corte_vinco" ? 1 : 0);
    if (familyOrder) return familyOrder;
    const unnamed = (group: QuoteGroup) => (group.family === "padrao" && !group.material ? 1 : 0);
    return unnamed(a) - unnamed(b) || a.label.localeCompare(b.label, "pt-BR");
  });
}

export function mergeQuotes(current: Quote[], incoming: Quote[]): { quotes: Quote[]; added: number; updated: number } {
  const byId = new Map(current.map((quote) => [quote.id, quote]));
  let added = 0;
  let updated = 0;
  for (const quote of incoming) {
    if (byId.has(quote.id)) updated += 1;
    else added += 1;
    byId.set(quote.id, quote);
  }
  const quotes = [...byId.values()].sort(compareQuotes);
  return { quotes, added, updated };
}
