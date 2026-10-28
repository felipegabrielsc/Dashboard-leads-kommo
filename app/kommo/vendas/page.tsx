import { Suspense } from "react";
import { SalesAudit } from "@/components/kommo/SalesAudit";

export default function VendasPage() {
  return (
    <Suspense fallback={<main className="px-4 py-10 text-sm text-mute">Carregando as vendas…</main>}>
      <SalesAudit />
    </Suspense>
  );
}
