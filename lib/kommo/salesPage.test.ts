import assert from "node:assert/strict";
import { pageSales } from "./salesPage";
import type { SaleRow } from "./types";

function sale(id: number, name: string): SaleRow {
  return {
    id,
    name,
    price: 10,
    closedAt: "2026-10-01T15:00:00.000Z",
    createdAt: "2026-09-01T15:00:00.000Z",
    pipelineName: "Funil",
    statusName: "Ganho",
    userName: "Ana",
    url: "",
  };
}

const sales = [sale(11, "MultiTec"), sale(12, "BHN"), sale(13, "Caio Vision")];
const found = pageSales(sales, "bhn", 1, 50);
assert.equal(found.salesTotal, 3);
assert.equal(found.matchTotal, 1);
assert.equal(found.sales[0]?.id, 12);

const page = pageSales(sales, "", 2, 2);
assert.equal(page.salesTotal, 3);
assert.equal(page.matchTotal, 3);
assert.deepEqual(page.sales.map((row) => row.id), [13]);

console.log("sales page ok");
