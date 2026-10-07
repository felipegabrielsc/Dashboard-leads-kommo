"use client";

import { formatDateTime } from "@/lib/format";
import type { ChangeEntry } from "@/lib/types";

export function HistoryPanel({
  changes,
  error,
  day,
  onDay,
}: {
  changes: ChangeEntry[];
  error: string;
  day: string;
  onDay: (day: string) => void;
}) {
  const visible = day ? changes.filter((change) => change.day === day) : changes;
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="font-serif text-2xl">Histórico</h2>
          <p className="mt-1 max-w-xl text-sm text-mute">
            Quem alterou uma célula, um dia, um motivo ou a lista em análise. O telefone não entra neste registro.
          </p>
        </div>
        <label className="text-sm text-mute">
          Dia
          <input className="field ml-1 w-auto" type="date" value={day} onChange={(event) => onDay(event.target.value)} />
        </label>
      </div>
      {error && <p className="mx-5 mb-4 rounded-2xl bg-brassSoft px-4 py-3 text-sm text-brass">{error}</p>}
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-mute">
            <tr>
              <th className="px-5 py-3 font-medium">Quando</th>
              <th className="px-3 py-3 font-medium">Quem</th>
              <th className="px-3 py-3 font-medium">O que mudou</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((change) => (
              <tr key={change.id} className="border-t border-line">
                <td className="whitespace-nowrap px-5 py-3">{formatDateTime(change.createdAt)}</td>
                <td className="px-3 py-3">{change.actor}</td>
                <td className="px-3 py-3">{change.summary}</td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-mute">
                  {day
                    ? "Nenhuma alteração registrada nesse dia."
                    : "Nenhuma alteração registrada ainda. Cada lançamento novo passa a aparecer aqui."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
