"use client";

import { useMemo, useRef, useState } from "react";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { CategoryManager } from "@/components/CategoryManager";
import { DayEditor } from "@/components/DayEditor";
import { DaysTable } from "@/components/DaysTable";
import { Summary } from "@/components/Summary";
import { TrendCharts } from "@/components/TrendCharts";
import { GROUP_META, WEEKDAY_ORDER, WEEKDAYS, shortLabel, sumCategories } from "@/lib/categories";
import { exportCsv, exportJson, exportWorkbook } from "@/lib/exportData";
import {
  activeFilterCount,
  defaultFilters,
  filterAnalysis,
  filterDays,
  isSlice,
  toggleList,
  visibleCategories,
} from "@/lib/filters";
import { addDays, formatDate, formatInt, formatMonth, monthBounds, monthKey, todayISO } from "@/lib/format";
import { buildBuckets, buildMonthRows, computeTotals, topMotives, weekdayLoads } from "@/lib/metrics";
import { mergeStates, parseWorkbook } from "@/lib/parseSheet";
import { normalizeState, useLeads } from "@/lib/store";
import type { DayRecord, Filters, GroupId, LeadState } from "@/lib/types";

type Tab = "painel" | "lancamentos" | "analise";

export function DashboardApp() {
  const leads = useLeads();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [tab, setTab] = useState<Tab>("painel");
  const [editor, setEditor] = useState<DayRecord | null | undefined>(undefined);
  const [motivesOpen, setMotivesOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<LeadState | null>(null);
  const [notice, setNotice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { state } = leads;
  const sliced = isSlice(filters);
  const columns = visibleCategories(state.categories, filters);
  const baseDays = useMemo(
    () => filterDays(state.days, state.analysis, filters),
    [filters, state.analysis, state.days],
  );
  const analysisRows = useMemo(
    () => filterAnalysis(state.analysis, state.days, filters),
    [filters, state.analysis, state.days],
  );
  const totals = useMemo(
    () => computeTotals(baseDays, sliced ? 0 : analysisRows.length, columns),
    [analysisRows.length, baseDays, columns, sliced],
  );
  const months = useMemo(
    () => buildMonthRows(baseDays, sliced ? [] : analysisRows, columns),
    [analysisRows, baseDays, columns, sliced],
  );
  const buckets = useMemo(() => buildBuckets(baseDays, columns), [baseDays, columns]);
  const reasons = useMemo(() => topMotives(totals, columns, "perdidos"), [columns, totals]);
  const loads = useMemo(() => weekdayLoads(baseDays, columns), [baseDays, columns]);
  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const day of state.days) keys.add(monthKey(day.date));
    for (const lead of state.analysis) if (lead.date) keys.add(monthKey(lead.date));
    return [...keys].sort();
  }, [state.analysis, state.days]);

  if (!leads.ready) {
    return (
      <main className="mx-auto max-w-[1440px] px-4 py-10">
        <div className="h-8 w-40 animate-pulse rounded-full bg-line" />
        <div className="mt-3 h-12 w-80 animate-pulse rounded-full bg-line/80" />
        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl bg-white/80" />
          ))}
        </div>
      </main>
    );
  }

  function setPreset(preset: "tudo" | "7" | "30" | "mes" | "anterior") {
    const today = todayISO();
    if (preset === "tudo") {
      setFilters((current) => ({ ...current, from: "", to: "", months: [] }));
      return;
    }
    if (preset === "7" || preset === "30") {
      const span = preset === "7" ? 6 : 29;
      setFilters((current) => ({ ...current, from: addDays(today, -span), to: today, months: [] }));
      return;
    }
    const [year, month] = today.split("-").map(Number);
    const key =
      preset === "mes"
        ? today.slice(0, 7)
        : `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, "0")}`;
    const bounds = monthBounds(key);
    setFilters((current) => ({ ...current, from: bounds.from, to: bounds.to, months: [] }));
  }

  async function onFile(file: File) {
    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = normalizeState(JSON.parse(await file.text()));
        if (!parsed) throw new Error("O JSON não está no formato desta dashboard.");
        setPendingImport(parsed);
        return;
      }
      const buffer = await file.arrayBuffer();
      setPendingImport(parseWorkbook(buffer));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não consegui ler esse arquivo.");
    }
  }

  function saveDay(day: DayRecord, extraPhones: string[]) {
    const original = editor && "date" in editor ? editor.date : "";
    if (!day.date) return "Informe a data.";
    const taken = state.days.some((item) => item.date === day.date && item.date !== original);
    if (taken) return "Já existe lançamento nessa data. Abra esse dia para editar.";
    if (original && original !== day.date) leads.deleteDay(original);
    leads.saveDay(day);
    for (const phone of [...new Set(extraPhones)]) {
      const exists = state.analysis.some((lead) => lead.phone === phone && lead.date === day.date);
      if (exists) continue;
      leads.saveAnalysis({
        id: crypto.randomUUID(),
        phone,
        date: day.date,
        description: "",
      });
    }
    setEditor(undefined);
    setTab("lancamentos");
    setNotice(`Dia ${formatDate(day.date)} salvo neste navegador.`);
    return null;
  }

  function toggleReview(day: DayRecord) {
    const count = state.analysis.filter((lead) => lead.date === day.date).length;
    leads.saveDay({
      ...day,
      review: day.review === "ok" ? "pendente" : "ok",
      pendingCount: day.review === "ok" ? Math.max(1, day.pendingCount || count || 1) : 0,
    });
  }

  const presetActive = {
    tudo: !filters.from && !filters.to && filters.months.length === 0,
    "7": filters.from === addDays(todayISO(), -6) && filters.to === todayISO(),
    "30": filters.from === addDays(todayISO(), -29) && filters.to === todayISO(),
    mes: filters.from === monthBounds(todayISO().slice(0, 7)).from && filters.to === monthBounds(todayISO().slice(0, 7)).to,
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">Kommo</p>
            <h1 className="font-serif text-4xl leading-none">Leads do dia a dia</h1>
            <p className="mt-2 max-w-xl text-sm text-mute">
              {formatInt(baseDays.length)} dias no recorte · {formatInt(totals.classified)} classificados
              {filters.from || filters.to
                ? ` · ${filters.from ? formatDate(filters.from) : "início"} a ${filters.to ? formatDate(filters.to) : "hoje"}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => setEditor(null)}>
              Adicionar dia
            </button>
            <button type="button" className="btn" onClick={() => setMotivesOpen(true)}>
              Novo motivo
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              Importar
            </button>
            <details className="relative">
              <summary className="btn cursor-pointer list-none">Exportar</summary>
              <div className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-line bg-card p-1 shadow-card">
                <MenuButton onClick={() => exportWorkbook(state)}>Planilha Excel</MenuButton>
                <MenuButton onClick={() => exportJson(state)}>Backup JSON</MenuButton>
                <MenuButton onClick={() => exportCsv(state, new Set(baseDays.map((day) => day.date)))}>
                  CSV deste recorte
                </MenuButton>
              </div>
            </details>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (
                  window.confirm(
                    "Isso substitui os lançamentos deste navegador pela planilha original. Um backup exportado não é apagado.",
                  )
                ) {
                  leads.reset();
                  setNotice("Planilha original restaurada neste navegador.");
                }
              }}
            >
              Restaurar
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.json,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void onFile(file);
              }}
            />
          </div>
        </div>
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 pb-3 lg:hidden">
          <button type="button" className="btn" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
            {filtersOpen ? "Ocultar filtros" : "Filtros"}
            {activeFilterCount(filters) > 0 ? ` (${activeFilterCount(filters)})` : ""}
          </button>
          {activeFilterCount(filters) > 0 && (
            <button type="button" className="text-sm text-mute" onClick={() => setFilters(defaultFilters())}>
              Limpar
            </button>
          )}
        </div>
        <div className={filtersOpen ? "block" : "hidden lg:block"}>
          <FilterBar
            filters={filters}
            months={monthOptions}
            categories={state.categories}
            onChange={setFilters}
            onPreset={setPreset}
            presetActive={presetActive}
          />
        </div>
        <nav className="mx-auto flex max-w-[1440px] gap-2 px-4 pb-3" aria-label="Seções">
          {(
            [
              ["painel", "Painel"],
              ["lancamentos", "Lançamentos"],
              ["analise", `Em análise (${analysisRows.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`chip ${tab === id ? "chip-on" : ""}`}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {notice && (
        <div className="mx-auto mt-4 flex max-w-[1440px] items-center justify-between gap-3 px-4">
          <p className="rounded-2xl bg-pineSoft px-4 py-2 text-sm text-pine" role="status">
            {notice}
          </p>
          <button type="button" className="text-sm text-mute" onClick={() => setNotice("")}>
            Fechar
          </button>
        </div>
      )}

      <main className="mx-auto max-w-[1440px] space-y-4 px-4 py-4">
        {tab === "painel" && (
          <>
            <Summary
              totals={totals}
              sliced={sliced}
              months={months}
              weekdayLoads={loads}
              categories={columns}
              onPending={() => {
                setFilters((current) => ({ ...current, review: "pendente" }));
                setTab("lancamentos");
              }}
              onDivergent={() => {
                setFilters((current) => ({ ...current, divergence: "somente" }));
                setTab("lancamentos");
              }}
              onMotive={(id) => setFilters((current) => ({ ...current, motives: [id], groups: [] }))}
              onMonth={(month) => {
                const bounds = monthBounds(month);
                setFilters((current) => ({ ...current, from: bounds.from, to: bounds.to, months: [] }));
              }}
            />
            <TrendCharts buckets={buckets} reasons={reasons} categories={columns} />
          </>
        )}
        {tab === "lancamentos" && (
          <DaysTable
            days={baseDays}
            categories={columns}
            analysis={state.analysis}
            onCell={leads.patchCell}
            onToggleReview={toggleReview}
            onEdit={(day) => setEditor(day)}
            onDelete={(date) => {
              if (window.confirm(`Excluir o lançamento de ${formatDate(date)}?`)) leads.deleteDay(date);
            }}
            onReconcile={leads.reconcile}
          />
        )}
        {tab === "analise" && (
          <AnalysisPanel leads={analysisRows} onSave={leads.saveAnalysis} onDelete={leads.deleteAnalysis} />
        )}
      </main>

      <footer className="mx-auto max-w-[1440px] px-4 py-8 text-sm text-mute">
        Os lançamentos ficam salvos neste navegador. Exporte um backup para abrir em outro computador ou para não perder o que você adicionou.
        A conferência ✅ significa que o dia está completo; ❌ significa que ainda há lead em análise.
      </footer>

      {editor !== undefined && (
        <DayEditor
          day={editor}
          categories={state.categories}
          onClose={() => setEditor(undefined)}
          onSave={saveDay}
        />
      )}
      {motivesOpen && (
        <CategoryManager
          categories={state.categories}
          onClose={() => setMotivesOpen(false)}
          onAdd={leads.addCategory}
          onRename={leads.renameCategory}
          onDelete={leads.deleteCategory}
        />
      )}
      {pendingImport && (
        <ImportDialog
          incoming={pendingImport}
          onClose={() => setPendingImport(null)}
          onReplace={() => {
            leads.replace(pendingImport);
            setPendingImport(null);
            setNotice("Dados substituídos pelos do arquivo.");
          }}
          onMerge={() => {
            leads.replace(mergeStates(state, pendingImport));
            setPendingImport(null);
            setNotice("Arquivo mesclado. Datas repetidas ficaram com a versão importada.");
          }}
        />
      )}
    </div>
  );
}

function MenuButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-paper" onClick={onClick}>
      {children}
    </button>
  );
}

function ImportDialog({
  incoming,
  onClose,
  onReplace,
  onMerge,
}: {
  incoming: LeadState;
  onClose: () => void;
  onReplace: () => void;
  onMerge: () => void;
}) {
  const total = incoming.days.reduce((sum, day) => sum + sumCategories(day.counts, incoming.categories), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-4 sm:items-center" onMouseDown={onClose}>
      <div className="panel w-full max-w-md p-5" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="import-title" className="font-serif text-3xl">
          Importar dados
        </h2>
        <p className="mt-2 text-sm text-mute">
          O arquivo tem {formatInt(incoming.days.length)} dias, {formatInt(total)} leads classificados e{" "}
          {formatInt(incoming.analysis.length)} em análise.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={onReplace}>
            Substituir tudo
          </button>
          <button type="button" className="btn" onClick={onMerge}>
            Mesclar por data
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterBar({
  filters,
  months,
  categories,
  onChange,
  onPreset,
  presetActive,
}: {
  filters: Filters;
  months: string[];
  categories: LeadState["categories"];
  onChange: (filters: Filters) => void;
  onPreset: (preset: "tudo" | "7" | "30" | "mes" | "anterior") => void;
  presetActive: { tudo: boolean; "7": boolean; "30": boolean; mes: boolean };
}) {
  const count = activeFilterCount(filters);
  return (
    <div className="mx-auto max-w-[1440px] space-y-3 px-4 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <Preset on={presetActive.tudo} onClick={() => onPreset("tudo")}>Tudo</Preset>
        <Preset on={presetActive["7"]} onClick={() => onPreset("7")}>7 dias</Preset>
        <Preset on={presetActive["30"]} onClick={() => onPreset("30")}>30 dias</Preset>
        <Preset on={presetActive.mes} onClick={() => onPreset("mes")}>Este mês</Preset>
        <Preset on={false} onClick={() => onPreset("anterior")}>Mês passado</Preset>
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
        <label className="min-w-48 flex-1 text-sm text-mute">
          Busca
          <input
            className="field ml-1"
            placeholder="Telefone, descrição, data"
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
          />
        </label>
        {count > 0 && (
          <button type="button" className="text-sm text-mute underline-offset-2 hover:underline" onClick={() => onChange(defaultFilters())}>
            Limpar filtros ({count})
          </button>
        )}
      </div>

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

      <div className="flex flex-wrap gap-2">
        {WEEKDAY_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={`chip ${filters.weekdays.includes(id) ? "chip-on" : ""}`}
            aria-pressed={filters.weekdays.includes(id)}
            onClick={() => onChange({ ...filters, weekdays: toggleList(filters.weekdays, id) })}
          >
            {WEEKDAYS[id].short}
          </button>
        ))}
        <span className="mx-1 hidden h-6 w-px self-center bg-line sm:block" />
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

      <div className="flex flex-wrap gap-2">
        {(Object.keys(GROUP_META) as GroupId[]).map((group) => (
          <button
            key={group}
            type="button"
            className={`chip ${filters.groups.includes(group) ? "chip-on" : ""}`}
            aria-pressed={filters.groups.includes(group)}
            onClick={() => onChange({ ...filters, groups: toggleList(filters.groups, group) })}
          >
            {GROUP_META[group].label}
          </button>
        ))}
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            title={category.label}
            className={`chip ${filters.motives.includes(category.id) ? "chip-on" : ""}`}
            aria-pressed={filters.motives.includes(category.id)}
            onClick={() => onChange({ ...filters, motives: toggleList(filters.motives, category.id) })}
          >
            {shortLabel(category)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Preset({ children, on, onClick }: { children: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`chip ${on ? "chip-on" : ""}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}
