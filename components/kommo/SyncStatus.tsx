import Link from "next/link";
import type { PublicSync } from "@/lib/kommo/types";
import { formatWhen, phaseLabel } from "./labels";

export function SyncStatus({
  sync,
  provisional,
  error,
}: {
  sync: PublicSync | null;
  provisional: boolean;
  error: string;
}) {
  return (
    <section className="space-y-3">
      {provisional ? (
        <p className="rounded-2xl border border-brass/40 bg-brassSoft px-4 py-3 text-sm text-ink">
          A importação ainda está em andamento. Os totais podem mudar quando ela terminar.
        </p>
      ) : null}
      {sync?.lastError ? (
        <p className="rounded-2xl border border-wine/30 bg-wineSoft px-4 py-3 text-sm text-ink">
          A última sincronização encontrou um erro: {sync.lastError} Os totais ficam incompletos até uma nova
          importação concluir.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-wine/30 bg-wineSoft px-4 py-3 text-sm text-ink">{error}</p>
      ) : null}
      <p className="text-sm text-mute">
        Última sincronização concluída: {formatWhen(sync?.lastSuccessAt || null)}
        {sync ? ` · ${phaseLabel(sync.phase)} · ${sync.upserted} registros neste ciclo` : ""}.{" "}
        <Link href="/kommo/configuracoes" className="underline">
          Abrir configurações
        </Link>
      </p>
    </section>
  );
}
