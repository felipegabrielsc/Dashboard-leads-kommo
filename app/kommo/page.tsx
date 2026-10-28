import { Suspense } from "react";
import { CommercialDashboard } from "@/components/kommo/CommercialDashboard";

export default function KommoPage() {
  return (
    <Suspense fallback={<main className="px-4 py-10 text-sm text-mute">Carregando o comercial…</main>}>
      <CommercialDashboard />
    </Suspense>
  );
}
