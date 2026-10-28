import type { StatusKind } from "./types";

export type StatusInput = {
  id: number;
  name: string;
  sort: number;
  type: number;
  isEditable: boolean;
};

const WON_NAME = /\b(won|ganh[oa]s?|sucesso|realizad[oa]s?)\b/i;
const LOST_NAME = /\b(lost|perdid[oa]s?|insucesso)\b/i;

function hasKind(result: Map<number, StatusKind>, kind: StatusKind) {
  for (const value of result.values()) if (value === kind) return true;
  return false;
}

export function classifyStatuses(statuses: StatusInput[]): Map<number, StatusKind> {
  const result = new Map<number, StatusKind>();
  for (const status of statuses) {
    if (status.type === 1) result.set(status.id, "unsorted");
    else if (status.id === 142 || (!status.isEditable && WON_NAME.test(status.name))) result.set(status.id, "won");
    else if (status.id === 143 || (!status.isEditable && LOST_NAME.test(status.name))) result.set(status.id, "lost");
  }

  const pending = statuses
    .filter((status) => !result.has(status.id))
    .sort((a, b) => a.sort - b.sort || a.id - b.id);
  if (pending.length >= 2 && (!hasKind(result, "won") || !hasKind(result, "lost"))) {
    const won = pending[pending.length - 2];
    const lost = pending[pending.length - 1];
    if (!hasKind(result, "lost")) result.set(lost.id, "lost");
    if (!hasKind(result, "won") && !result.has(won.id)) result.set(won.id, "won");
  }

  for (const status of statuses) {
    if (!result.has(status.id)) result.set(status.id, "open");
  }
  return result;
}
