"use client";

import { useEffect, useState } from "react";
import type { RepurchaseLine } from "@/lib/v4/audit";
import { localToday } from "./query";

type Draft = {
  saleDate: string;
  customerName: string;
  amount: string;
  purchaseNumber: string;
  sellerName: string;
  profit: string;
};

function moneyText(value: number | null): string {
  if (value == null) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

function fresh(sale: RepurchaseLine | null): Draft {
  return {
    saleDate: sale?.saleDate || localToday(),
    customerName: sale?.customerName || "",
    amount: moneyText(sale?.amount ?? null),
    purchaseNumber: sale ? String(sale.purchaseNumber) : "2",
    sellerName: sale?.sellerName || "",
    profit: moneyText(sale?.profit ?? null),
  };
}

export function RepurchaseEditor({
  sale,
  customers,
  sellers,
  onClose,
  onSaved,
}: {
  sale: RepurchaseLine | null;
  customers: { name: string; lastPurchase: number }[];
  sellers: string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => fresh(sale));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [touchedNumber, setTouchedNumber] = useState(Boolean(sale));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const known = customers.find((item) => item.name.trim().toLowerCase() === draft.customerName.trim().toLowerCase());

  function setCustomer(name: string) {
    const match = customers.find((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase());
    setDraft((current) => ({
      ...current,
      customerName: name,
      purchaseNumber: !touchedNumber && match ? String(Math.max(2, match.lastPurchase + 1)) : current.purchaseNumber,
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(sale ? `/api/kommo/v4/sales/${sale.id}` : "/api/kommo/v4/sales", {
        method: sale ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saleDate: draft.saleDate,
          customerName: draft.customerName,
          amount: draft.amount,
          purchaseNumber: Number(draft.purchaseNumber),
          sellerName: draft.sellerName,
          profit: draft.profit,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof body.error === "string" ? body.error : "Não consegui salvar a recompra.");
        return;
      }
      onSaved(sale ? "Recompra atualizada." : "Recompra adicionada. Ela entra na soma até ser vinculada a um negócio do Kommo.");
    } catch {
      setError("Não consegui salvar a recompra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" role="presentation" onMouseDown={onClose}>
      <form
        onSubmit={save}
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col bg-paper shadow-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repurchase-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">Recompra manual</p>
            <h2 id="repurchase-title" className="font-serif text-3xl">
              {sale ? "Editar recompra" : "Adicionar recompra"}
            </h2>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <p className="text-sm text-mute">
            Use para a recompra que ainda não está na planilha. Ela não é apagada quando uma planilha nova é importada.
          </p>
          <label className="block text-sm">
            Data
            <input
              required
              type="date"
              className="field mt-1"
              max={localToday()}
              value={draft.saleDate}
              onChange={(event) => setDraft({ ...draft, saleDate: event.target.value })}
            />
          </label>
          <label className="block text-sm">
            Cliente
            <input
              required
              className="field mt-1"
              list="repurchase-customers"
              maxLength={200}
              value={draft.customerName}
              onChange={(event) => setCustomer(event.target.value)}
            />
            <datalist id="repurchase-customers">
              {customers.map((item) => (
                <option key={item.name} value={item.name} />
              ))}
            </datalist>
            {known && !sale ? (
              <span className="mt-1 block text-xs text-mute">Última compra deste cliente no período: {known.lastPurchase}ª.</span>
            ) : null}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Valor (R$)
              <input
                required
                className="field mt-1"
                inputMode="decimal"
                placeholder="0,00"
                value={draft.amount}
                onChange={(event) => setDraft({ ...draft, amount: event.target.value.replace(/[^\d.,]/g, "") })}
              />
            </label>
            <label className="block text-sm">
              Número da compra
              <input
                required
                className="field mt-1"
                inputMode="numeric"
                value={draft.purchaseNumber}
                onChange={(event) => {
                  setTouchedNumber(true);
                  setDraft({ ...draft, purchaseNumber: event.target.value.replace(/\D/g, "") });
                }}
              />
              <span className="mt-1 block text-xs text-mute">2 para a segunda compra, 3 para a terceira…</span>
            </label>
          </div>
          <label className="block text-sm">
            Vendedor
            <input
              className="field mt-1"
              list="repurchase-sellers"
              maxLength={120}
              placeholder="Opcional"
              value={draft.sellerName}
              onChange={(event) => setDraft({ ...draft, sellerName: event.target.value })}
            />
            <datalist id="repurchase-sellers">
              {sellers.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="block text-sm">
            Lucro estimado (R$)
            <input
              className="field mt-1"
              inputMode="decimal"
              placeholder="Opcional"
              value={draft.profit}
              onChange={(event) => setDraft({ ...draft, profit: event.target.value.replace(/[^\d.,-]/g, "") })}
            />
          </label>
          {error ? <p className="text-sm text-wine">{error}</p> : null}
        </div>
        <div className="border-t border-line px-5 py-4">
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar recompra"}
          </button>
        </div>
      </form>
    </div>
  );
}
