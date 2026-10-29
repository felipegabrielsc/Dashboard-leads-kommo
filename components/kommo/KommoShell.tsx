import Link from "next/link";

type Active = "painel" | "vendas" | "config" | "importacoes";

export function KommoShell({
  title,
  description,
  active,
  painelHref,
  vendasHref,
  importHref = "/kommo/importacoes",
  children,
}: {
  title: string;
  description: string;
  active: Active;
  painelHref: string;
  vendasHref: string;
  importHref?: string;
  children: React.ReactNode;
}) {
  const item = (href: string, label: string, on: boolean) =>
    on ? (
      <span className="chip chip-on">{label}</span>
    ) : (
      <Link href={href} className="chip">
        {label}
      </Link>
    );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-[1440px] px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="chip">
              Leads diários
            </Link>
            {item(painelHref, "Comercial Kommo", active === "painel")}
            {item(vendasHref, "Vendas", active === "vendas")}
            {item(importHref, "Importações", active === "importacoes")}
            {item("/kommo/configuracoes", "Configurações", active === "config")}
          </div>
          <h1 className="mt-4 font-serif text-4xl leading-none">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-mute">{description}</p>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] space-y-4 overflow-x-hidden px-4 py-5">{children}</main>
    </div>
  );
}
