import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comercial Kommo",
  description: "Vendas, receita e funis dos negócios do Kommo, separados dos lançamentos diários.",
};

export default function KommoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
