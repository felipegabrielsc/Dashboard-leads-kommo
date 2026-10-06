"use client";

import { useEffect, useState } from "react";
import { GROUP_META, categoryValue, sumCategories } from "@/lib/categories";
import type { Category, DayRecord, GroupId } from "@/lib/types";

type Draft = {
  originalDate: string;
  date: string;
  review: "ok" | "pendente";
  pendingCount: string;
  declared: string;
  counts: Record<string, string>;
  phones: string;
};

export function DayEditor({
  day,
  categories,
  onClose,
  onSave,
}: {
  day: DayRecord | null;
  categories: Category[];
  onClose: () => void;
  onSave: (day: DayRecord, extraPhones: string[]) => string | null;
}) {
  const [draft, setDraft] = useState<Draft>(() => fromDay(day, categories));
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(fromDay(day, categories));
    setError("");
  }, [categories, day]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save(event: React.FormEvent) {
    event.preventDefault();
    const counts: Record<string, number> = {};
    for (const category of categories) {
      counts[category.id] = draft.counts[category.id] ? Number(draft.counts[category.id]) : 0;
    }
    const sum = sumCategories(counts, categories);
    const declaredNumber = draft.declared.trim() === "" ? null : Number(draft.declared);
    const pending = draft.pendingCount.trim() === "" ? 1 : Number(draft.pendingCount);
    const message = onSave(
      {
        date: draft.date,
        review: draft.review,
        pendingCount: draft.review === "pendente" ? Math.max(1, pending || 1) : 0,
        declaredQuantity: declaredNumber == null || declaredNumber === sum ? null : declaredNumber,
        counts,
      },
      draft.phones
        .split(/[\n,;]+/)
        .map((phone) => phone.trim())
        .filter(Boolean),
    );
    if (message) setError(message);
  }

  const groups: GroupId[] = ["interesse", "sem_retorno", "perdidos"];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" role="presentation" onMouseDown={onClose}>
      <form
        onSubmit={save}
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col bg-paper shadow-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">Lançamento</p>
            <h2 id="editor-title" className="font-serif text-3xl">
              {day ? "Editar dia" : "Adicionar dia"}
            </h2>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <label className="block text-sm">
            Data
            <input
              required
              type="date"
              className="field mt-1"
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
            />
          </label>
          <fieldset>
            <legend className="text-sm">Conferência do dia</legend>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className={`chip ${draft.review === "ok" ? "chip-on" : ""}`}
                onClick={() => setDraft({ ...draft, review: "ok" })}
              >
                Conferido
              </button>
              <button
                type="button"
                className={`chip ${draft.review === "pendente" ? "chip-on" : ""}`}
                onClick={() => setDraft({ ...draft, review: "pendente" })}
              >
                Tem lead em análise
              </button>
            </div>
          </fieldset>
          {draft.review === "pendente" && (
            <label className="block text-sm">
              Quantos leads ainda faltam classificar
              <input
                className="field mt-1"
                inputMode="numeric"
                value={draft.pendingCount}
                onChange={(event) => setDraft({ ...draft, pendingCount: event.target.value.replace(/\D/g, "") })}
              />
            </label>
          )}
          <label className="block text-sm">
            Quantidade anotada à parte
            <input
              className="field mt-1"
              inputMode="numeric"
              placeholder="Opcional. Deixe vazio para usar a soma dos motivos"
              value={draft.declared}
              onChange={(event) => setDraft({ ...draft, declared: event.target.value.replace(/\D/g, "") })}
            />
          </label>
          {groups.map((group) => (
            <fieldset key={group}>
              <legend className="text-sm font-semibold" style={{ color: GROUP_META[group].ink }}>
                {GROUP_META[group].label}
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {categories
                  .filter((category) => category.group === group)
                  .map((category) => (
                    <label key={category.id} className="block text-sm">
                      {category.label}
                      <input
                        className="field mt-1"
                        inputMode="numeric"
                        value={draft.counts[category.id] || ""}
                        placeholder="0"
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            counts: { ...draft.counts, [category.id]: event.target.value.replace(/\D/g, "") },
                          })
                        }
                      />
                    </label>
                  ))}
              </div>
            </fieldset>
          ))}
          <label className="block text-sm">
            Telefones para a lista de análise
            <textarea
              className="field mt-1 min-h-24"
              placeholder="Um por linha. Eles entram na aba Em análise nesta data."
              value={draft.phones}
              onChange={(event) => setDraft({ ...draft, phones: event.target.value })}
            />
          </label>
          {error && <p className="text-sm text-wine">{error}</p>}
        </div>
        <div className="border-t border-line px-5 py-4">
          <button className="btn btn-primary w-full" type="submit">
            Salvar dia
          </button>
        </div>
      </form>
    </div>
  );
}

function fromDay(day: DayRecord | null, categories: Category[]): Draft {
  const counts: Record<string, string> = {};
  for (const category of categories) {
    const value = day ? categoryValue(day.counts, category.id) : 0;
    counts[category.id] = value ? String(value) : "";
  }
  return {
    originalDate: day?.date || "",
    date: day?.date || "",
    review: day?.review || "ok",
    pendingCount: day?.pendingCount ? String(day.pendingCount) : "1",
    declared: day?.declaredQuantity != null ? String(day.declaredQuantity) : "",
    counts,
    phones: "",
  };
}
