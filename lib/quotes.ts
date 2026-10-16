import { normalizeLabel, slugify } from "./categories";

export type QuoteTier = {
  quantity: number;
  unitPrice: number;
};

export type Quote = {
  id: string;
  width: number;
  depth: number;
  height: number;
  material: string;
  note: string;
  tiers: QuoteTier[];
};

const DIMENSIONS = /(\d+)\s*x\s*(\d+)\s*x\s*(\d+)/i;

export function quoteKey(quote: Pick<Quote, "width" | "depth" | "height" | "material" | "note">): string {
  return `${quote.width}x${quote.depth}x${quote.height}|${normalizeLabel(quote.material)}|${normalizeLabel(quote.note)}`;
}

export function quoteId(quote: Pick<Quote, "width" | "depth" | "height" | "material" | "note">): string {
  return slugify(quoteKey(quote).replace(/\|/g, " "));
}

export function quoteTitle(quote: Pick<Quote, "width" | "depth" | "height" | "note">): string {
  const base = `Caixa ${quote.width} × ${quote.depth} × ${quote.height}`;
  return quote.note ? `${base} ${quote.note}` : base;
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

function parsePriceLine(line: string): QuoteTier | null {
  const match = line.match(
    /^(\d{1,3}(?:\.\d{3})+|\d+)\s+caixas?\s*(?:[-–—]\s*)?R\$\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})/i,
  );
  if (!match) return null;
  const quantity = Number(match[1].replaceAll(".", ""));
  const unitPrice = Number(match[2].replaceAll(".", "").replace(",", "."));
  if (!quantity || !Number.isFinite(unitPrice)) return null;
  return { quantity, unitPrice };
}

function splitExtra(before: string, after: string): { material: string; note: string } {
  const material: string[] = [];
  const note: string[] = [];
  for (const part of [before, after]) {
    const text = part.replace(/\s+/g, " ").trim().replace(/^[-–—]\s*/, "").replace(/\.$/, "").trim();
    if (!text) continue;
    if (/papel[aã]o/i.test(text)) material.push(text);
    else note.push(text);
  }
  return { material: material.join(" "), note: note.join(" ") };
}

export function parseQuotes(text: string): Quote[] {
  const quotes: Quote[] = [];
  let current: Quote | null = null;

  function commit() {
    if (current && current.tiers.length) quotes.push(current);
    current = null;
  }

  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^quantidade\s+valor/i.test(line) || /^esse e o formato/i.test(normalizeLabel(line))) continue;

    const caixa = line.match(/^caixa\b(.*)$/i);
    const dims = caixa ? caixa[1].match(DIMENSIONS) : null;
    if (caixa && dims && dims.index != null) {
      commit();
      const extra = splitExtra(caixa[1].slice(0, dims.index), caixa[1].slice(dims.index + dims[0].length));
      const draft = {
        width: Number(dims[1]),
        depth: Number(dims[2]),
        height: Number(dims[3]),
        material: extra.material,
        note: extra.note,
        tiers: [] as QuoteTier[],
      };
      current = { ...draft, id: quoteId(draft) };
      continue;
    }

    if (/^papel[aã]o\b/i.test(line)) {
      if (current) current.material = line.replace(/\.$/, "").trim();
      if (current) current.id = quoteId(current);
      continue;
    }

    const tier = parsePriceLine(line);
    if (tier && current) current.tiers.push(tier);
  }
  commit();

  const byId = new Map<string, Quote>();
  for (const quote of quotes) byId.set(quote.id, quote);
  return [...byId.values()].sort(
    (a, b) => a.width - b.width || a.depth - b.depth || a.height - b.height || a.material.localeCompare(b.material, "pt-BR"),
  );
}

export function searchQuotes(quotes: Quote[], query: string, material = ""): Quote[] {
  const numbers = [...query.matchAll(/\d+/g)].map((item) => Number(item[0]));
  const ignored = new Set(["x", "caixa", "caixas", "rs", "unidade"]);
  const words = normalizeLabel(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !ignored.has(token) && !/^\d+$/.test(token));
  return quotes.filter((quote) => {
    if (material === "__none__" && quote.material) return false;
    if (material && material !== "__none__" && normalizeLabel(quote.material) !== normalizeLabel(material)) return false;
    const dims = [quote.width, quote.depth, quote.height];
    if (numbers.length === 3 && /\d\s*x\s*\d\s*x\s*\d/i.test(query)) {
      if (dims[0] !== numbers[0] || dims[1] !== numbers[1] || dims[2] !== numbers[2]) return false;
    } else if (numbers.length > 0 && !numbers.every((number) => dims.includes(number))) {
      return false;
    }
    if (!words.length) return true;
    const haystack = normalizeLabel(`${quote.material} ${quote.note}`);
    return words.every((word) => haystack.includes(word));
  });
}

export type QuoteDraft = {
  width: string;
  depth: string;
  height: string;
  material: string;
  note: string;
  tiers: { quantity: string; unitPrice: string }[];
};

export function emptyQuoteDraft(): QuoteDraft {
  return {
    width: "",
    depth: "",
    height: "",
    material: "",
    note: "",
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

  const partial = {
    width,
    depth,
    height,
    material: draft.material.trim().replace(/\.$/, ""),
    note: draft.note.trim(),
    tiers,
  };
  return { quote: { ...partial, id: quoteId(partial) } };
}

export function lowestUnitPrice(quote: Quote): number {
  return Math.min(...quote.tiers.map((tier) => tier.unitPrice));
}

export function groupQuotes(quotes: Quote[]): { material: string; quotes: Quote[] }[] {
  const groups = new Map<string, Quote[]>();
  for (const quote of quotes) {
    const label = quote.material || "Papelão não informado";
    const list = groups.get(label);
    if (list) list.push(quote);
    else groups.set(label, [quote]);
  }
  return [...groups.keys()]
    .sort((a, b) => {
      if (a === "Papelão não informado") return 1;
      if (b === "Papelão não informado") return -1;
      return a.localeCompare(b, "pt-BR");
    })
    .map((material) => ({ material, quotes: groups.get(material) || [] }));
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
  const quotes = [...byId.values()].sort(
    (a, b) => a.width - b.width || a.depth - b.depth || a.height - b.height || a.material.localeCompare(b.material, "pt-BR"),
  );
  return { quotes, added, updated };
}
