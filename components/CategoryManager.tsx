"use client";

import { useEffect, useState } from "react";
import { GROUP_META } from "@/lib/categories";
import type { Category, GroupId } from "@/lib/types";

export function CategoryManager({
  categories,
  onClose,
  onAdd,
  onRename,
  onDelete,
}: {
  categories: Category[];
  onClose: () => void;
  onAdd: (label: string, group: GroupId) => void;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [group, setGroup] = useState<GroupId>("perdidos");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const custom = categories.filter((category) => !category.builtin);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="motivos-title"
        className="panel max-h-[85vh] w-full max-w-lg overflow-y-auto p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="motivos-title" className="font-serif text-3xl">
            Motivos
          </h2>
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
        </div>
        <p className="mt-2 text-sm text-mute">
          Os motivos da planilha continuam fixos para a conta bater. Motivos novos entram no grupo que você escolher e já podem ser filtrados.
        </p>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!label.trim()) return;
            onAdd(label, group);
            setLabel("");
          }}
        >
          <input className="field" placeholder="Nome do motivo" value={label} onChange={(event) => setLabel(event.target.value)} />
          <select className="field sm:w-40" value={group} onChange={(event) => setGroup(event.target.value as GroupId)}>
            {(Object.keys(GROUP_META) as GroupId[]).map((id) => (
              <option key={id} value={id}>
                {GROUP_META[id].label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit">
            Criar
          </button>
        </form>
        <ul className="mt-5 space-y-2">
          {custom.map((category) => (
            <li key={category.id} className="flex items-center gap-2">
              <input
                className="field"
                defaultValue={category.label}
                aria-label={`Nome de ${category.label}`}
                onBlur={(event) => onRename(category.id, event.target.value)}
              />
              <span className="shrink-0 text-xs text-mute">{GROUP_META[category.group].short}</span>
              <button type="button" className="btn btn-danger" onClick={() => onDelete(category.id)}>
                Excluir
              </button>
            </li>
          ))}
          {!custom.length && <li className="text-sm text-mute">Nenhum motivo extra ainda.</li>}
        </ul>
      </div>
    </div>
  );
}
