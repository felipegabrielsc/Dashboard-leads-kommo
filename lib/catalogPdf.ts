import { jsPDF } from "jspdf";
import { formatDate, formatPhone } from "./format";
import { displayNote, formatMeasuresCm, groupQuotes, tierQuantityLabel, type Quote } from "./quotes";
import { emptyCatalogIdentity, type CatalogIdentity } from "./types";

export type { CatalogIdentity };

export type CatalogKind = "precos" | "medidas";

const ink = [28, 25, 21] as const;
const mute = [109, 101, 92] as const;
const paper = [243, 239, 230] as const;
const card = [255, 253, 248] as const;
const line = [228, 220, 207] as const;
const pine = [27, 107, 67] as const;
const brass = [138, 90, 18] as const;
const cream = [243, 239, 230] as const;

const TITLE_LEAD = 5.2;
const NOTE_LEAD = 3.6;
const TIER_LEAD = 4.6;

type CardLayout = {
  height: number;
  titleLines: string[];
  noteLines: string[];
};

function pdfInt(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function pdfMoney(value: number): string {
  const [reais, cents] = value.toFixed(2).split(".");
  return `R$ ${pdfInt(Number(reais))},${cents}`;
}

function fill(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function inkText(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function layoutCard(doc: jsPDF, quote: Quote, width: number): CardLayout {
  const inner = width - 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const titleLines = doc.splitTextToSize(`${quote.width} x ${quote.depth} x ${quote.height}`, inner) as string[];
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  const note = displayNote(quote);
  const noteLines = note ? (doc.splitTextToSize(note, inner) as string[]) : [];
  const badge = quote.family === "corte_vinco" ? 4.2 : 0;
  let height = 6 + badge + titleLines.length * TITLE_LEAD;
  if (noteLines.length) height += 1 + noteLines.length * NOTE_LEAD;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const tierInner = Math.max(24, inner - (showPrices ? 24 : 0));
  const tierLineCount = showPrices
    ? quote.tiers.reduce((total, tier) => total + (doc.splitTextToSize(tierQuantityLabel(tier), tierInner) as string[]).length, 0)
    : 0;
  height += showPrices ? 7 + tierLineCount * TIER_LEAD : 3;
  return { height, titleLines, noteLines };
}

function drawCard(doc: jsPDF, quote: Quote, x: number, y: number, width: number, height: number, layout: CardLayout) {
  fill(doc, card);
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, width, height, 2, 2, "FD");

  let cursor = y + 5.5;
  if (quote.family === "corte_vinco") {
    inkText(doc, brass);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("CORTE E VINCO", x + 4, cursor);
    cursor += 4.2;
  }
  inkText(doc, ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(layout.titleLines, x + 4, cursor);
  cursor += layout.titleLines.length * TITLE_LEAD;

  if (layout.noteLines.length) {
    cursor += 1;
    inkText(doc, mute);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(layout.noteLines, x + 4, cursor);
    cursor += layout.noteLines.length * NOTE_LEAD;
  }

  cursor += 2;
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.line(x + 4, cursor, x + width - 4, cursor);
  cursor += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const tierInner = Math.max(24, width - 8 - 24);
  for (const tier of quote.tiers) {
    const lines = doc.splitTextToSize(tierQuantityLabel(tier), tierInner) as string[];
    inkText(doc, mute);
    doc.text(lines, x + 4, cursor);
    doc.setFont("helvetica", "bold");
    inkText(doc, ink);
    doc.text(pdfMoney(tier.unitPrice), x + width - 4, cursor, { align: "right" });
    cursor += lines.length * TIER_LEAD;
  }
}

export function catalogFilename(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `catalogo-caixas-${year}-${month}-${day}.pdf`;
}

export function buildCatalogPdf(quotes: Quote[], options?: { filtered?: boolean; generatedAt?: Date }): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const generatedAt = options?.generatedAt ?? new Date();
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(generatedAt);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const gap = 4;
  const colW = (pageW - margin * 2 - gap) / 2;
  const bottom = pageH - 16;
  let page = 1;

  function paintBackground() {
    fill(doc, paper);
    doc.rect(0, 0, pageW, pageH, "F");
  }

  function paintHeader(): number {
    fill(doc, ink);
    doc.rect(0, 0, pageW, 28, "F");
    inkText(doc, cream);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Catálogo de caixas", margin, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${quotes.length} ${quotes.length === 1 ? "caixa" : "caixas"}`, pageW - margin, 11, { align: "right" });
    cursor += 6;
    const detail = showPrices ? "valores unitários por quantidade" : "sem valores";
    const scope = options?.filtered ? "Recorte da pesquisa · " : "";
    const hasDieCut = quotes.some((quote) => quote.family === "corte_vinco");
    const hasCommon = quotes.some((quote) => quote.family !== "corte_vinco");
    const mix = hasDieCut && hasCommon ? " · corte e vinco separado" : hasDieCut ? " · corte e vinco" : "";
    doc.text(`${scope}Medidas em centímetros · ${detail}${mix}`, margin, cursor);
    cursor += 5;
    if (contact) {
      doc.text(contact, margin, cursor);
      cursor += 5;
    }
    doc.text(dateLabel, margin, cursor);
    return headerH + 8;
  }

  function paintFooter() {
    inkText(doc, mute);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Para divulgação. O valor é por unidade, conforme a quantidade.", margin, pageH - 8);
    doc.text(String(page), pageW - margin, pageH - 8, { align: "right" });
  }

  function nextPage(): number {
    paintFooter();
    doc.addPage();
    page += 1;
    paintBackground();
    return paintHeader();
  }

  paintBackground();
  let y = paintHeader();

  if (!quotes.length) {
    inkText(doc, mute);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Nenhuma caixa neste recorte.", margin, y + 4);
    paintFooter();
    return doc;
  }

  function paintGroup(label: string, dieCut: boolean) {
    inkText(doc, dieCut ? brass : pine);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, margin, y + 4);
    y += 8;
  }

  for (const group of groupQuotes(quotes)) {
    let open = false;
    for (let index = 0; index < group.quotes.length; index += 2) {
      const left = group.quotes[index];
      const right = group.quotes[index + 1];
      const leftLayout = layoutCard(doc, left, colW);
      const rightLayout = right ? layoutCard(doc, right, colW) : null;
      const rowH = Math.max(leftLayout.height, rightLayout?.height ?? 0);
      const needed = rowH + (open ? 0 : 8);
      if (y + needed > bottom && y > 40) {
        y = nextPage();
        open = false;
      }
      if (!open) {
        paintGroup(group.label, group.family === "corte_vinco");
        open = true;
      }
      drawCard(doc, left, margin, y, colW, rowH, leftLayout);
      if (right && rightLayout) drawCard(doc, right, margin + colW + gap, y, colW, rowH, rightLayout);
      y += rowH + gap;
    }
    y += 2;
  }

  paintFooter();
  return doc;
}

export function downloadCatalogPdf(quotes: Quote[], filtered: boolean) {
  buildCatalogPdf(quotes, { filtered }).save(catalogFilename());
}
