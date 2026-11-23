import { customerKey, parseMoney } from "./parse";

export type ManualRepurchase = {
  saleDate: string;
  customerName: string;
  customerKey: string;
  amount: number;
  purchaseNumber: number;
  sellerName: string;
  profit: number | null;
};

const MAX_AMOUNT = 10_000_000;

function validIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return value;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function money(value: unknown): number | null {
  if (typeof value === "string") {
    const cleaned = value.replace(/r\$/gi, "").replace(/\s/g, "");
    if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) return parseMoney(cleaned.replace(/\./g, ""));
  }
  return parseMoney(value);
}

export function parseManualRepurchase(
  input: unknown,
  today: string,
): { ok: true; value: ManualRepurchase } | { ok: false; error: string } {
  const body = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const saleDate = validIsoDate(body.saleDate);
  if (!saleDate) return { ok: false, error: "Informe a data da recompra." };
  if (saleDate > today) return { ok: false, error: "A data da recompra não pode ser futura." };
  if (saleDate < "2000-01-01") return { ok: false, error: "Confira a data da recompra." };

  const customerName = text(body.customerName);
  if (!customerName) return { ok: false, error: "Informe o cliente." };
  if (customerName.length > 200) return { ok: false, error: "O nome do cliente pode ter até 200 caracteres." };
  const key = customerKey(customerName);
  if (!key) return { ok: false, error: "Informe o cliente." };

  const amount = money(body.amount);
  if (amount == null || amount <= 0) return { ok: false, error: "Informe um valor maior que zero." };
  if (amount > MAX_AMOUNT) return { ok: false, error: "Confira o valor da recompra." };

  const rawNumber = typeof body.purchaseNumber === "string" ? Number(body.purchaseNumber) : body.purchaseNumber;
  if (typeof rawNumber !== "number" || !Number.isInteger(rawNumber) || rawNumber < 2 || rawNumber > 999) {
    return { ok: false, error: "A recompra precisa ser a 2ª compra do cliente ou depois." };
  }

  const sellerName = text(body.sellerName);
  if (sellerName.length > 120) return { ok: false, error: "O nome do vendedor pode ter até 120 caracteres." };

  let profit: number | null = null;
  if (body.profit != null && text(String(body.profit)) !== "") {
    profit = money(body.profit);
    if (profit == null || Math.abs(profit) > MAX_AMOUNT) return { ok: false, error: "Confira o lucro estimado." };
  }

  return {
    ok: true,
    value: { saleDate, customerName, customerKey: key, amount, purchaseNumber: rawNumber, sellerName, profit },
  };
}
