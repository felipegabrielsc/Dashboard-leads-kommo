import { Suspense } from "react";
import { V4Import } from "@/components/kommo/V4Import";

export default function ImportacoesPage() {
  return (
    <Suspense fallback={<main className="px-4 py-10 text-sm text-mute">Carregando as importações…</main>}>
      <V4Import />
    </Suspense>
  );
}
