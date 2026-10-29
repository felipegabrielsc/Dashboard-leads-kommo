import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { customerKey, parseMoney, parseSaleDate, parseV4Workbook, roundMoney } from "./parse";

assert.equal(parseMoney("R$ 1.362,90"), 1362.9);
assert.equal(parseMoney("3.305,38"), 3305.38);
assert.equal(parseMoney(4179.78), 4179.78);
assert.equal(parseSaleDate("02/04/2026"), "2026-04-02");
assert.equal(parseSaleDate("2/4/26"), "2026-04-02");
assert.equal(parseSaleDate(new Date("2026-04-02T00:00:00.000Z")), "2026-04-02");

const serial = Math.round((Date.UTC(2026, 3, 2) - Date.UTC(1899, 11, 30)) / 86400000);
assert.equal(parseSaleDate(serial), "2026-04-02");
assert.equal(customerKey("  Caio  Visão "), "caio visao");

function excelDay(day: number): number {
  return Math.round((Date.UTC(2026, 3, day) - Date.UTC(1899, 11, 30)) / 86400000);
}

const rows: unknown[][] = [
  ["Vendas pela V4", null, null, null, null, 0.14, 0.02, 0.19],
  ["Data", "Cliente", "Valor", "N° da compra", "Vendedor", "Matéria-prima", "Imposto", "Operacional", "Lucro"],
  [],
];
for (let index = 0; index < 15; index += 1) {
  rows.push([excelDay(1 + (index % 28)), `Cliente ${index}`, 3000, 1, "Renan", 0.14, 0.02, 0.19, 10]);
}
rows.push(["02/10/2026", "Cliente especial", "R$ 4.179,78", 1, "Felipe", 100, 20, 30, 40]);
for (let index = 0; index < 11; index += 1) {
  rows.push([excelDay(3 + index), `Recompra ${index}`, 3330, index === 0 ? "2ª" : 2, "Renan", 50, 10, 20, 80]);
}
rows.push([excelDay(20), "Recompra final", "R$ 3.305,38", 3, "Renan", 0.14, 0.02, 0.19, 12]);

const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Informações");
const parsed = parseV4Workbook(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);

assert.equal(parsed.totals.totalCount, 28);
assert.equal(parsed.totals.firstCount, 16);
assert.equal(parsed.totals.repurchaseCount, 12);
assert.equal(parsed.totals.firstAmount, 49179.78);
assert.equal(parsed.totals.repurchaseAmount, 39935.38);
assert.equal(parsed.totals.totalAmount, 89115.16);
assert.equal(parsed.rows[0]?.rawMaterialCost, 420);
assert.equal(parsed.rows[0]?.taxCost, 60);
assert.equal(parsed.rows[0]?.operationalCost, roundMoney(0.19 * 3000));
assert.equal(parsed.rows.find((row) => row.customerName === "Cliente especial")?.rawMaterialCost, 100);
assert.equal(parsed.invalid.length, 0);

const messy = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  messy,
  XLSX.utils.aoa_to_sheet([
    ["Data", "Cliente", "Valor", "N° da compra", "Vendedor"],
    [serial, "Oficina Alfa", "R$ 750,00", 1, "Ana"],
    [],
    ["", "", "", "", ""],
    ["data ruim", "Sem valor", "abc", 1, "Ana"],
    [serial, "Oficina Alfa", "R$ 750,00", 1, "Ana"],
    [serial, "", 10, 1, "Ana"],
  ]),
  "Informações",
);
const issues = parseV4Workbook(XLSX.write(messy, { type: "buffer", bookType: "xlsx" }) as Buffer);
assert.equal(issues.rows.length, 2);
assert.equal(issues.rows[0]?.amount, 750);
assert.equal(issues.rows[0]?.saleDate, "2026-04-02");
assert.equal(issues.rows[0]?.isRepurchase, false);
assert.equal(issues.warnings.length, 1);
assert.ok(issues.invalid.some((issue) => issue.message.includes("valor inválido")));
assert.ok(issues.invalid.some((issue) => issue.message.includes("cliente vazio")));

console.log("v4 parse ok");
