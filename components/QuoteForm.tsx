"use client";

import { useState } from "react";
import { buildQuote, type Quote, type QuoteDraft } from "@/lib/quotes";

export function QuoteForm({
  materials,
  initial,
  title,
  onCancel,
  onSave,
}: {
  materials: string[];
  initial: QuoteDraft;
  title: string;
  onCancel: () => void;
  onSave: (quote: Quote) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");

  function patch(partial: Partial<QuoteDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function patchTier(index: number, partial: Partial<QuoteDraft["tiers"][number]>) {
    setDraft((current) => ({
      ...current,
      tiers: current.tiers.map((tier, tierIndex) => (tierIndex === index ? { ...tier, ...partial } : tier)),
    }));
  }

  return (
    <form
      className="rounded-2xl border border-line bg-paper p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const result = buildQuote(draft);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setError("");
        onSave(result.quote);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl">{title}</h3>
          <p className="mt-1 text-sm text-mute">
            As três medidas entram em milímetros, na ordem do anúncio. 220 x 220 x 160 mm vira 22 x 22 x 16 cm no catálogo.
          </p>
        </div>
        <button type="button" className="text-sm text-mute underline-offset-2 hover:underline" onClick={onCancel}>
          Cancelar
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          1ª medida
          <input
            autoFocus
            inputMode="numeric"
            className="field mt-1"
            placeholder="220"
            value={draft.width}
            onChange={(event) => patch({ width: event.target.value })}
          />
        </label>
        <label className="text-sm">
          2ª medida
          <input
            inputMode="numeric"
            className="field mt-1"
            placeholder="220"
            value={draft.depth}
            onChange={(event) => patch({ depth: event.target.value })}
          />
        </label>
        <label className="text-sm">
          3ª medida
          <input
            inputMode="numeric"
            className="field mt-1"
            placeholder="160"
            value={draft.height}
            onChange={(event) => patch({ height: event.target.value })}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Papelão
          <input
            className="field mt-1"
            list="quote-materials"
            placeholder="Papelão Onda B"
            value={draft.material}
            onChange={(event) => patch({ material: event.target.value })}
          />
          <datalist id="quote-materials">
            {materials.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="text-sm">
          Detalhe
          <input
            className="field mt-1"
            placeholder="corte e vinco, divisória"
            value={draft.note}
            onChange={(event) => patch({ note: event.target.value })}
          />
        </label>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium">Faixas de quantidade</p>
        {draft.tiers.map((tier, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <label className="text-sm">
              {index === 0 ? "Quantidade" : <span className="sr-only">Quantidade</span>}
              <input
                inputMode="numeric"
                className="field mt-1"
                placeholder="100"
                value={tier.quantity}
                onChange={(event) => patchTier(index, { quantity: event.target.value })}
              />
            </label>
            <label className="text-sm">
              {index === 0 ? "Valor unitário" : <span className="sr-only">Valor unitário</span>}
              <input
                inputMode="decimal"
                className="field mt-1"
                placeholder="2,92"
                value={tier.unitPrice}
                onChange={(event) => patchTier(index, { unitPrice: event.target.value })}
              />
            </label>
            <button
              type="button"
              className="btn disabled:cursor-not-allowed disabled:opacity-40"
              disabled={draft.tiers.length === 1}
              onClick={() => patch({ tiers: draft.tiers.filter((_, tierIndex) => tierIndex !== index) })}
            >
              Tirar
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-pine underline-offset-2 hover:underline"
          onClick={() => patch({ tiers: [...draft.tiers, { quantity: "", unitPrice: "" }] })}
        >
          Outra faixa
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-wine">{error}</p>}
      <button type="submit" className="btn btn-primary mt-4">
        Salvar medida
      </button>
    </form>
  );
}
