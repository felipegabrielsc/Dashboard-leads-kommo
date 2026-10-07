"use client";

import type { ReactNode } from "react";
import { GROUP_META, WEEKDAY_ORDER, WEEKDAYS, shortLabel } from "@/lib/categories";
import { activeFilterCount, defaultFilters, motiveFilterCategories, toggleList } from "@/lib/filters";
import { formatMonth } from "@/lib/format";
import type { Category, Filters, GroupId } from "@/lib/types";

export function FilterBar({
  filters,
  months,
  categories,
  canSeePhones,
  onChange,
  onPreset,
  presetActive,
}: {
  filters: Filters;
  months: string[];
  categories: Category[];
  canSeePhones: boolean;
  onChange: (filters: Filters) => void;
  onPreset: (preset: "tudo" | "7" | "30" | "mes" | "anterior") => void;
  presetActive: { tudo: boolean; "7": boolean; "30": boolean; mes: boolean; anterior: boolean };
}) {
  const count = activeFilterCount(filters);
  return (
    <div className="mx-auto max-w-[1440px] space-y-3 px-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="max-w-2xl text-sm text-mute">
          Cada bloco muda uma coisa. Eles se combinam: o período escolhe as datas, e os outros blocos afinam o que entra nessa conta.
        </p>
        {count > 0 && (
          <button type="button" className="text-sm text-mute underline-offset-2 hover:underline" onClick={() => onChange(defaultFilters())}>
            Limpar filtros ({count})
          </button>
        )}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <FilterGroup
          title="Período"
          hint="Define quais datas entram nos cartões, nos gráficos e na tabela."
          className="xl:col-span-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Preset on={presetActive.tudo} onClick={() => onPreset("tudo")}>Tudo</Preset>
            <Preset on={presetActive["7"]} onClick={() => onPreset("7")}>7 dias</Preset>
            <Preset on={presetActive["30"]} onClick={() => onPreset("30")}>30 dias</Preset>
            <Preset on={presetActive.mes} onClick={() => onPreset("mes")}>Este mês</Preset>
            <Preset on={presetActive.anterior} onClick={() => onPreset("anterior")}>Mês passado</Preset>
            <label className="text-sm text-mute">
              De
              <input
                type="date"
                className="field ml-1 w-auto"
                value={filters.from}
                onChange={(event) => onChange({ ...filters, from: event.target.value, months: [] })}
              />
            </label>
            <label className="text-sm text-mute">
              Até
              <input
                type="date"
                className="field ml-1 w-auto"
                value={filters.to}
                onChange={(event) => onChange({ ...filters, to: event.target.value, months: [] })}
              />
            </label>
          </div>
          {months.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-mute">Meses com lançamento</p>
              <div className="flex flex-wrap gap-2">
                {months.map((month) => (
                  <button
                    key={month}
                    type="button"
                    className={`chip ${filters.months.includes(month) ? "chip-on" : ""}`}
                    aria-pressed={filters.months.includes(month)}
                    onClick={() => onChange({ ...filters, months: toggleList(filters.months, month), from: "", to: "" })}
                  >
                    {formatMonth(month)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </FilterGroup>

        <FilterGroup
          title="Dia da semana"
          hint="Mantém o período e deixa só os dias marcados. Sem marca, a semana inteira entra."
        >
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={`chip ${filters.weekdays.includes(id) ? "chip-on" : ""}`}
                aria-pressed={filters.weekdays.includes(id)}
                onClick={() => onChange({ ...filters, weekdays: toggleList(filters.weekdays, id) })}
              >
                {WEEKDAYS[id].label}
              </button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup
          title="Situação do dia"
          hint="Conferido é o dia fechado. Pendente é o dia com lead ainda em análise. Divergente é a soma que não bate com o número anotado."
        >
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["todos", "Todos os dias"],
                ["ok", "Conferidos"],
                ["pendente", "Pendentes"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`chip ${filters.review === value ? "chip-on" : ""}`}
                aria-pressed={filters.review === value}
                onClick={() => onChange({ ...filters, review: value })}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={`chip ${filters.divergence === "somente" ? "chip-on" : ""}`}
              aria-pressed={filters.divergence === "somente"}
              onClick={() =>
                onChange({
                  ...filters,
                  divergence: filters.divergence === "somente" ? "todos" : "somente",
                })
              }
            >
              Quantidade divergente
            </button>
          </div>
        </FilterGroup>

        <FilterGroup
          title="O que entra na conta"
          hint="Sem seleção, os cartões usam todos os motivos. Um grupo ou um motivo isola essa parte da conta."
          className="xl:col-span-2"
        >
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-mute">Grupos</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(GROUP_META) as GroupId[]).map((group) => (
              <button
                key={group}
                type="button"
                className={`chip ${filters.groups.includes(group) ? "chip-on" : ""}`}
                aria-pressed={filters.groups.includes(group)}
                onClick={() => onChange({ ...filters, groups: toggleList(filters.groups, group) })}
              >
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: GROUP_META[group].bar }} />
                {GROUP_META[group].label}
              </button>
            ))}
          </div>
          <p className="mb-1.5 mt-3 text-xs font-medium uppercase tracking-wide text-mute">Motivos</p>
          <div className="flex flex-wrap gap-2">
            {motiveFilterCategories(categories).map((category) => (
              <button
                key={category.id}
                type="button"
                title={category.label}
                className={`chip ${filters.motives.includes(category.id) ? "chip-on" : ""}`}
                aria-pressed={filters.motives.includes(category.id)}
                onClick={() => onChange({ ...filters, motives: toggleList(filters.motives, category.id) })}
              >
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: GROUP_META[category.group].bar }} />
                {shortLabel(category)}
              </button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup
          title="Busca"
          hint={
            canSeePhones
              ? "Encontra uma data, uma descrição ou um telefone da lista em análise."
              : "Encontra uma data ou uma descrição. O telefone da lista em análise só entra na busca depois do login."
          }
          className="xl:col-span-2"
        >
          <label className="block text-sm text-mute">
            Texto
            <input
              className="field mt-1"
              placeholder={canSeePhones ? "Telefone, descrição ou data" : "Descrição ou data"}
              value={filters.query}
              onChange={(event) => onChange({ ...filters, query: event.target.value })}
            />
          </label>
        </FilterGroup>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line/80 bg-white/80 px-4 py-3 ${className}`}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs leading-relaxed text-mute">{hint}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Preset({ children, on, onClick }: { children: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`chip ${on ? "chip-on" : ""}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}
