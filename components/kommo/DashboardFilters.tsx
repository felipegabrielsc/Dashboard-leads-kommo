"use client";

import { periodPresets } from "./query";

export function DashboardFilters({
  from,
  to,
  pipeline,
  user,
  pipelines,
  users,
  disabled,
  onChange,
}: {
  from: string;
  to: string;
  pipeline: string;
  user: string;
  pipelines: { id: number; name: string }[];
  users: { id: number; name: string }[];
  disabled?: boolean;
  onChange: (next: { from?: string; to?: string; pipeline?: string; user?: string }) => void;
}) {
  const presets = periodPresets();
  return (
    <section className="panel flex flex-wrap items-end gap-3 p-4">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const on = from === preset.from && to === preset.to;
          return (
            <button
              key={preset.id}
              type="button"
              className={`chip ${on ? "chip-on" : ""}`}
              disabled={disabled}
              onClick={() => onChange({ from: preset.from, to: preset.to })}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <label className="text-sm text-mute">
        De
        <input
          className="field mt-1"
          type="date"
          value={from}
          disabled={disabled}
          onChange={(event) => onChange({ from: event.target.value })}
        />
      </label>
      <label className="text-sm text-mute">
        Até
        <input
          className="field mt-1"
          type="date"
          value={to}
          disabled={disabled}
          onChange={(event) => onChange({ to: event.target.value })}
        />
      </label>
      <label className="min-w-40 text-sm text-mute">
        Funil
        <select
          className="field mt-1"
          value={pipeline}
          disabled={disabled}
          onChange={(event) => onChange({ pipeline: event.target.value })}
        >
          <option value="">Todos</option>
          {pipelines.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-40 text-sm text-mute">
        Responsável
        <select
          className="field mt-1"
          value={user}
          disabled={disabled}
          onChange={(event) => onChange({ user: event.target.value })}
        >
          <option value="">Todos</option>
          {users.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
