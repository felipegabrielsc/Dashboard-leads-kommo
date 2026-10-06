import type { Category, GroupId } from "./types";

export const PURCHASE_ID = "comprou";

/** Motivos que inflam o volume e não são demanda comercial do produto. */
export const NON_COMMERCIAL_IDS = ["curriculo", "engano", "outros"] as const;

export const GROUP_META: Record<
  GroupId,
  { label: string; short: string; ink: string; soft: string; bar: string }
> = {
  interesse: {
    label: "Interessados",
    short: "Interesse",
    ink: "#1b6b43",
    soft: "#e7f5ec",
    bar: "#1b6b43",
  },
  sem_retorno: {
    label: "Sem retorno",
    short: "Sem retorno",
    ink: "#1e4d7b",
    soft: "#e7f1f8",
    bar: "#1e4d7b",
  },
  perdidos: {
    label: "Perdidos",
    short: "Perdidos",
    ink: "#9f2d2d",
    soft: "#fdeeee",
    bar: "#9f2d2d",
  },
};

export const BUILTIN_CATEGORIES: Category[] = [
  { id: "comprou", label: "Comprou", group: "interesse", builtin: true },
  {
    id: "interessado_sem_resposta",
    label: "Interessado mas sem resposta",
    group: "interesse",
    builtin: true,
  },
  { id: "compra_futura", label: "Compra Futura", group: "interesse", builtin: true },
  { id: "sem_retorno", label: "Sem Retorno", group: "sem_retorno", builtin: true },
  {
    id: "orcamento_insuficiente",
    label: "Orçamento insuficiente",
    group: "perdidos",
    builtin: true,
  },
  {
    id: "produto_nao_encaixa",
    label: "O produto não se encaixa à necessidade",
    group: "perdidos",
    builtin: true,
  },
  {
    id: "nao_satisfeito",
    label: "Não satisfeito com as condições",
    group: "perdidos",
    builtin: true,
  },
  {
    id: "concorrente",
    label: "Comprado do concorrente",
    group: "perdidos",
    builtin: true,
  },
  {
    id: "curriculo",
    label: "Currículo (busca de emprego)",
    group: "perdidos",
    builtin: true,
  },
  { id: "fora_regiao", label: "Fora da região", group: "perdidos", builtin: true },
  { id: "engano", label: "Engano", group: "perdidos", builtin: true },
  {
    id: "outros",
    label: "Outros (Não contabilizado aos leads)",
    group: "perdidos",
    builtin: true,
  },
];

export const WEEKDAYS = [
  { id: 0, short: "Dom", label: "Domingo" },
  { id: 1, short: "Seg", label: "Segunda" },
  { id: 2, short: "Ter", label: "Terça" },
  { id: 3, short: "Qua", label: "Quarta" },
  { id: 4, short: "Qui", label: "Quinta" },
  { id: 5, short: "Sex", label: "Sexta" },
  { id: 6, short: "Sáb", label: "Sábado" },
] as const;

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const BUILTIN_BY_LABEL = new Map(
  BUILTIN_CATEGORIES.map((category) => [normalizeLabel(category.label), category]),
);

export function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(label: string): string {
  const base = normalizeLabel(label)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return base || "motivo";
}

export function builtinByLabel(label: string): Category | undefined {
  return BUILTIN_BY_LABEL.get(normalizeLabel(label));
}

export function withBuiltins(categories: Category[]): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const result = BUILTIN_CATEGORIES.map((builtin) => {
    const current = byId.get(builtin.id);
    if (!current) return builtin;
    return { ...builtin, ...current, builtin: true, group: builtin.group };
  });
  for (const category of categories) {
    if (!result.some((item) => item.id === category.id)) result.push(category);
  }
  return result;
}

const SHORT_LABELS: Record<string, string> = {
  comprou: "Comprou",
  interessado_sem_resposta: "Sem resposta",
  compra_futura: "Compra futura",
  sem_retorno: "Sem retorno",
  orcamento_insuficiente: "Orçamento",
  produto_nao_encaixa: "Não encaixa",
  nao_satisfeito: "Condições",
  concorrente: "Concorrente",
  curriculo: "Currículo",
  fora_regiao: "Fora da região",
  engano: "Engano",
  outros: "Outros",
};

export function shortLabel(category: Category): string {
  return SHORT_LABELS[category.id] || category.label;
}

export function categoryValue(counts: Record<string, number>, id: string): number {
  const value = counts[id];
  return Number.isFinite(value) ? value : 0;
}

export function sumCategories(counts: Record<string, number>, categories: Category[]): number {
  return categories.reduce((total, category) => total + categoryValue(counts, category.id), 0);
}
