import { createFileRoute } from "@tanstack/react-router";
import { Utensils } from "lucide-react";
import { Avatar } from "@/components/Chrome";

export const Route = createFileRoute("/restaurantes")({
  head: () => ({
    meta: [
      { title: "Restaurantes — Evoque Viagens" },
      { name: "description", content: "Restaurantes das viagens. Chega em breve." },
      { property: "og:title", content: "Restaurantes — Evoque Viagens" },
      { property: "og:description", content: "Restaurantes das viagens. Chega em breve." },
    ],
  }),
  component: () => <EmBreve titulo="Restaurantes" Icone={Utensils} />,
});

export function EmBreve({ titulo, Icone }: { titulo: string; Icone: typeof Utensils }) {
  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="flex items-center gap-2 px-4 py-3">
        <h1 className="flex-1 text-3xl">{titulo}</h1>
        <Avatar />
      </header>
      <div className="mx-4 mt-10 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border p-10 text-center">
        <Icone size={48} strokeWidth={2.2} className="text-accent" />
        <p className="text-2xl font-bold text-foreground">Chega em breve</p>
      </div>
    </div>
  );
}
