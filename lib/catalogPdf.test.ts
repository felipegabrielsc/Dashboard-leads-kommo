import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCatalogPdf, catalogFilename } from "./catalogPdf";
import { parseQuotes } from "./quotes";

const quotes = parseQuotes(readFileSync(new URL("../data/medidas-de-exemplo.txt", import.meta.url), "utf8"));
const generatedAt = new Date(2026, 9, 13, 12, 0, 0);

const full = buildCatalogPdf(quotes, { generatedAt });
assert.ok(full.getNumberOfPages() >= 2, `catálogo completo em ${full.getNumberOfPages()} página`);

const one = buildCatalogPdf([quotes[0]], { filtered: true, generatedAt });
assert.equal(one.getNumberOfPages(), 1);
const bytes = Buffer.from(one.output("arraybuffer"));
assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");

const empty = buildCatalogPdf([], { generatedAt });
assert.equal(empty.getNumberOfPages(), 1);

assert.equal(catalogFilename(generatedAt), "catalogo-caixas-2026-10-13.pdf");

console.log("catalog pdf ok", full.getNumberOfPages());
