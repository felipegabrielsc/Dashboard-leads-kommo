"use client";

import { useState } from "react";
import { formatDate, formatPhone, whatsappUrl } from "@/lib/format";
import type { AnalysisLead } from "@/lib/types";

const empty = { id: "", phone: "", date: "", description: "" };

export function AnalysisPanel({
  leads,
  onSave,
  onDelete,
  readOnly = false,
}: {
  leads: AnalysisLead[];
  onSave: (lead: AnalysisLead) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(empty);
  const [onlyBlank, setOnlyBlank] = useState(false);
  const [error, setError] = useState("");
  const visible = onlyBlank ? leads.filter((lead) => !lead.description.trim()) : leads;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const phone = draft.phone.trim();
    if (!phone) {
      setError("Informe o telefone.");
      return;
    }
    if (!draft.date) {
      setError("Informe a data.");
      return;
    }
    onSave({
      id: draft.id || crypto.randomUUID(),
      phone,
      date: draft.date,
      description: draft.description.trim(),
    });
    setDraft(empty);
    setError("");
  }

  return (
    <section className="space-y-3">
      {!readOnly && (
      <form onSubmit={submit} className="panel grid gap-3 p-5 md:grid-cols-[1fr_160px_1.4fr_auto]">
        <label className="block text-sm">
          Telefone
          <input
            className="field mt-1"
            inputMode="tel"
            placeholder="5511999999999"
            value={draft.phone}
            onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
          />
        </label>
        <label className="block text-sm">
          Data
          <input
            className="field mt-1"
            type="date"
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          />
        </label>
        <label className="block text-sm">
          Descrição
          <input
            className="field mt-1"
            placeholder="O que a pessoa quer, objeção, próximo passo"
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </label>
        <div className="flex items-end gap-2">
          <button className="btn btn-primary" type="submit">
            {draft.id ? "Salvar" : "Incluir"}
          </button>
          {draft.id && (
            <button className="btn" type="button" onClick={() => { setDraft(empty); setError(""); }}>
              Cancelar
            </button>
          )}
        </div>
        {error && <p className="text-sm text-wine md:col-span-4">{error}</p>}
        <p className="text-sm text-mute md:col-span-4">
          Estes são os leads do ❌: ainda não entraram na grade do dia. O total geral da planilha soma essa lista.
        </p>
      </form>
      )}

      <article className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 className="font-serif text-2xl">Em análise · {visible.length}</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyBlank} onChange={(event) => setOnlyBlank(event.target.checked)} />
            Só sem descrição
          </label>
        </div>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-mute">
              <tr>
                <th className="px-5 py-3 font-medium">Telefone</th>
                <th className="px-3 py-3 font-medium">Data</th>
                <th className="px-3 py-3 font-medium">Descrição</th>
                <th className="px-5 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((lead) => (
                <tr key={lead.id} className="border-t border-line">
                  <td className="px-5 py-3 font-medium">
                    {!readOnly && lead.phone ? (
                      formatPhone(lead.phone)
                    ) : (
                      <span className="font-normal text-mute">Visível depois do login</span>
                    )}
                  </td>
                  <td className="px-3 py-3">{lead.date ? formatDate(lead.date) : "—"}</td>
                  <td className="px-3 py-3 text-mute">{lead.description || "Sem descrição"}</td>
                  <td className="whitespace-nowrap px-5 py-3">
                    {!readOnly && lead.phone && (
                      <a className="underline-offset-2 hover:underline" href={whatsappUrl(lead.phone)} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    )}
                    {!readOnly && (
                      <>
                        <button type="button" className="ml-3 underline-offset-2 hover:underline" onClick={() => setDraft(lead)}>
                          Editar
                        </button>
                        <button type="button" className="ml-3 text-wine underline-offset-2 hover:underline" onClick={() => onDelete(lead.id)}>
                          Excluir
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-mute">
                    Nenhum lead em análise neste recorte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
