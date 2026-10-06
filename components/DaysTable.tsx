"use client";

import { useEffect, useMemo, useState } from "react";
import { GROUP_META, categoryValue, shortLabel, sumCategories } from "@/lib/categories";
import { formatDate, formatPhone, weekdayIndex } from "@/lib/format";
import { WEEKDAYS } from "@/lib/categories";
import { isDivergent } from "@/lib/metrics";
import type { AnalysisLead, Category, DayRecord } from "@/lib/types";

type SortMode = "desc" | "asc" | "volume";

export function DaysTable({
  days,
  categories,
  analysis,
  onCell,
  onToggleReview,
  onEdit,
  onDelete,
  onReconcile,
}: {
  days: DayRecord[];
  categories: Category[];
  analysis: AnalysisLead[];
  onCell: (date: string, categoryId: string, value: number) => void;
  onToggleReview: (day: DayRecord) => void;
  onEdit: (day: DayRecord) => void;
  onDelete: (date: string) => void;
  onReconcile: (date: string) => void;
}) {
  const [sort, setSort] = useState<SortMode>("desc");
  const rows = useMemo(() => {
    const copy = [...days];
    if (sort === "asc") copy.sort((a, b) => a.date.localeCompare(b.date));
    if (sort === "desc") copy.sort((a, b) => b.date.localeCompare(a.date));
    if (sort === "volume") {
      copy.sort(
        (a, b) =>
          sumCategories(b.counts, categories) - sumCategories(a.counts, categories) ||
          b.date.localeCompare(a.date),
      );
    }
    return copy;
  }, [categories, days, sort]);

  const totals = categories.map((category) =>
    days.reduce((sum, day) => sum + categoryValue(day.counts, category.id), 0),
  );

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <h2 className="font-serif text-2xl">Lançamentos</h2>
          <p className="mt-1 text-sm text-mute">
            Cada linha é um dia. Edite o número direto na célula. Zero aparece em branco, como na planilha.
          </p>
        </div>
        <label className="text-sm text-mute">
          Ordem{" "}
          <select className="field ml-1 w-auto" value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
            <option value="desc">Mais recentes</option>
            <option value="asc">Mais antigos</option>
            <option value="volume">Maior volume</option>
          </select>
        </label>
      </div>

      {!rows.length ? (
        <p className="px-5 pb-8 text-sm text-mute">Nenhum dia neste recorte. Limpe um filtro ou adicione um lançamento.</p>
      ) : (
        <div className="sheet-scroll border-t border-line">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs text-mute">
                <th className="sticky-col left-0 min-w-40 bg-card px-3 py-3 font-medium">Data</th>
                <th className="sticky-col left-40 min-w-36 bg-card px-3 py-3 font-medium">Conferência</th>
                <th className="bg-card px-3 py-3 font-medium">Total</th>
                {categories.map((category) => (
                  <th
                    key={category.id}
                    className="bg-card px-2 py-3 font-medium"
                    style={{ boxShadow: `inset 0 3px 0 ${GROUP_META[category.group].bar}` }}
                    title={category.label}
                  >
                    <span className="block w-24 leading-tight">{shortLabel(category)}</span>
                  </th>
                ))}
                <th className="bg-card px-3 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((day) => {
                const leads = analysis.filter((lead) => lead.date === day.date);
                const total = sumCategories(day.counts, categories);
                const divergent = isDivergent(day);
                return (
                  <tr key={day.date} className={day.review === "pendente" ? "bg-brassSoft/50" : "bg-card"}>
                    <td className={`sticky-col left-0 px-3 py-2 ${day.review === "pendente" ? "bg-[#fbf6ea]" : "bg-card"}`}>
                      <p className="font-medium">{formatDate(day.date)}</p>
                      <p className="text-xs text-mute">{WEEKDAYS[weekdayIndex(day.date)].label}</p>
                      {leads.length > 0 && (
                        <p className="mt-1 max-w-36 text-xs text-brass" title={leads.map((lead) => formatPhone(lead.phone)).join(", ")}>
                          {leads.length} em análise
                        </p>
                      )}
                    </td>
                    <td className={`sticky-col left-40 px-3 py-2 ${day.review === "pendente" ? "bg-[#fbf6ea]" : "bg-card"}`}>
                      <button
                        type="button"
                        onClick={() => onToggleReview(day)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          day.review === "pendente" ? "bg-brass text-white" : "bg-pineSoft text-pine"
                        }`}
                      >
                        {day.review === "pendente" ? `${day.pendingCount} pendente` : "Conferido"}
                      </button>
                      {divergent && (
                        <p className="mt-1 text-xs text-wine">Anotado: {day.declaredQuantity}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 font-semibold">{total || "—"}</td>
                    {categories.map((category) => (
                      <td key={category.id} className="px-2 py-1.5">
                        <CountCell
                          value={categoryValue(day.counts, category.id)}
                          label={`${shortLabel(category)} em ${formatDate(day.date)}`}
                          onCommit={(value) => onCell(day.date, category.id, value)}
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2">
                      <button type="button" className="text-sm underline-offset-2 hover:underline" onClick={() => onEdit(day)}>
                        Editar
                      </button>
                      {divergent && (
                        <button type="button" className="ml-3 text-sm text-wine underline-offset-2 hover:underline" onClick={() => onReconcile(day.date)}>
                          Usar a soma
                        </button>
                      )}
                      <button
                        type="button"
                        className="ml-3 text-sm text-mute underline-offset-2 hover:underline"
                        onClick={() => onDelete(day.date)}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line text-sm font-semibold">
                <td className="sticky-col left-0 bg-[#f7f3ea] px-3 py-3">Total do recorte</td>
                <td className="sticky-col left-40 bg-[#f7f3ea] px-3 py-3">{days.length} dias</td>
                <td className="bg-[#f7f3ea] px-3 py-3">{totals.reduce((sum, value) => sum + value, 0)}</td>
                {totals.map((value, index) => (
                  <td key={categories[index].id} className="bg-[#f7f3ea] px-3 py-3">
                    {value}
                  </td>
                ))}
                <td className="bg-[#f7f3ea]" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function CountCell({
  value,
  label,
  onCommit,
}: {
  value: number;
  label: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value ? String(value) : "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value ? String(value) : "");
  }, [focused, value]);

  return (
    <input
      aria-label={label}
      inputMode="numeric"
      className="w-16 rounded-lg border border-transparent bg-transparent px-2 py-1 text-center outline-none hover:border-line focus:border-brass focus:bg-white"
      value={draft}
      placeholder="–"
      onFocus={() => setFocused(true)}
      onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
      onBlur={() => {
        setFocused(false);
        onCommit(draft === "" ? 0 : Number(draft));
      }}
    />
  );
}
