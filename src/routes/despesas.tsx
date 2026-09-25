import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/despesas")({
  head: () => ({
    meta: [
      { title: "Despesas — Evoque Viagens" },
      { name: "description", content: "Despesas de todas as viagens. Chega em breve." },
      { property: "og:title", content: "Despesas — Evoque Viagens" },
      { property: "og:description", content: "Despesas de todas as viagens. Chega em breve." },
    ],
  }),
  component: Despesas,
});

function Despesas() {
  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="flex items-center gap-2 px-4 py-3">
        <h1 className="flex-1 text-3xl">Despesas</h1>
      </header>
      <div className="mx-4 mt-10 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border p-10 text-center">
        <Wallet size={48} strokeWidth={2.2} className="text-accent" />
        <p className="text-2xl font-bold text-foreground">Chega em breve</p>
        <p className="text-base text-muted-foreground">Os gastos de cada viagem continuam dentro da viagem.</p>
      </div>
    </div>
  );
}
