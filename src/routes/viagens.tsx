import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Copy, MapPin, Plus } from "lucide-react";
import { findingsQuery, membersQuery, tripsQuery, type Trip } from "@/lib/data";
import { dataBRCurta, diasAte } from "@/lib/format";
import { AvatarGrupo } from "@/components/AvatarGrupo";
import { ConvitesRecebidos } from "@/components/ConvitesRecebidos";
import { ChipClaude } from "@/components/CaixaClaude";
import { TelaHoje, viagemDeHoje } from "@/components/TelaHoje";
import { AvisosMeus, PedidosRecebidos } from "@/components/AvisosPedidos";

export const Route = createFileRoute("/viagens")({
  head: () => ({
    meta: [
      { title: "Viagens — Viagens Organizadas" },
      { name: "description", content: "Suas viagens atuais, próximas e passadas." },
      { property: "og:title", content: "Viagens — Viagens Organizadas" },
      { property: "og:description", content: "Suas viagens atuais, próximas e passadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { todas?: boolean } =>
    s.todas === true || s.todas === "true" ? { todas: true } : {},
  component: Viagens,
});

function Viagens() {
  const { data: viagens } = useSuspenseQuery(tripsQuery());
  const { todas } = Route.useSearch();
  const deHoje = todas ? null : viagemDeHoje(viagens);
  if (deHoje) return <TelaHoje trip={deHoje} />;
  return <ListaViagens viagens={viagens} />;
}

function ListaViagens({ viagens }: { viagens: Trip[] }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const ordenadas = [...viagens].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  const futuras = ordenadas.filter((v) => !v.arquivada_em && v.data_fim >= hoje);
  const atual = futuras.find((v) => v.data_inicio <= hoje) ?? futuras[0];
  const proximas = futuras.filter((v) => v.id !== atual?.id);
  const passadas = ordenadas.filter((v) => v.arquivada_em || v.data_fim < hoje).reverse();
  const { data: membrosData } = useQuery({
    ...membersQuery(atual?.id ?? ""),
    enabled: Boolean(atual),
  });
  const { data: achadosData } = useQuery({
    ...findingsQuery(atual?.id ?? ""),
    enabled: Boolean(atual),
  });
  const membros = membrosData ?? [];
  const achados = achadosData ?? [];
  const resolver = achados.filter((x) => x.severidade === "resolver" && !x.dispensado_em).length;
  const dono = membros.find((m) => m.papel === "owner");
  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="flex items-center gap-3 px-4 py-4">
        <h1 className="flex-1 text-3xl">Viagens</h1>
        <Link
          to="/nova-viagem"
          className="tap flex items-center gap-2 rounded-lg bg-primary px-4 text-lg font-bold text-primary-foreground"
        >
          <Plus size={24} /> Nova viagem
        </Link>
      </header>
      <main className="mx-auto max-w-3xl space-y-7 px-4">
        <AvisosMeus />
        <PedidosRecebidos />
        <ConvitesRecebidos />
        <ChipClaude />
        {atual ? (
          <Link
            to="/trip/$id"
            params={{ id: atual.id }}
            className="gradient-hero shadow-medium block rounded-[18px] p-5"
          >
            <p className="text-base font-extrabold uppercase">
              {diasAte(atual.data_inicio) > 0
                ? `Em ${diasAte(atual.data_inicio)} dias`
                : "Em andamento"}
            </p>
            <h2 className="mt-3 text-3xl">{atual.nome}</h2>
            <p className="mt-2 flex items-center gap-2 text-lg">
              <MapPin size={23} />
              {atual.cidades?.join(" · ") || atual.destino || "Cidades a definir"}
            </p>
            <p className="mt-1 text-lg">
              {dataBRCurta(atual.data_inicio)} a {dataBRCurta(atual.data_fim)}
            </p>
            <p className="mt-3 text-lg font-bold">
              {dono?.meu ? "Você organiza" : `${dono?.nome ?? "Outra pessoa"} organiza`}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <AvatarGrupo nomes={membros.map((m) => m.nome)} />
              {resolver > 0 && (
                <span className="rounded-full bg-danger px-3 py-2 text-base font-bold text-danger-foreground">
                  {resolver} {resolver === 1 ? "ponto" : "pontos"} para resolver
                </span>
              )}
            </div>
          </Link>
        ) : (
          <div className="rounded-[18px] border-2 border-dashed border-border p-8 text-center text-lg">
            Nenhuma viagem ainda.
          </div>
        )}
        <Lista titulo="Próximas" viagens={proximas} />
        {passadas.length > 0 && (
          <section>
            <h2 className="mb-3 text-2xl">Passadas</h2>
            <div className="divide-y divide-border rounded-[18px] border border-border bg-card">
              {passadas.map((v) => (
                <div key={v.id} className="flex items-center gap-2 px-4 py-3">
                  <Link to="/trip/$id" params={{ id: v.id }} className="tap min-w-0 flex-1">
                    <strong className="block truncate text-lg">{v.nome}</strong>
                    <span className="text-base text-muted-foreground">
                      {dataBRCurta(v.data_inicio)} a {dataBRCurta(v.data_fim)}
                    </span>
                  </Link>
                  <Link
                    to="/nova-viagem"
                    search={{ duplicar: v.id }}
                    className="tap flex items-center gap-2 text-lg font-bold text-accent"
                  >
                    <Copy size={22} /> Duplicar
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Lista({ titulo, viagens }: { titulo: string; viagens: Trip[] }) {
  if (!viagens.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-2xl">{titulo}</h2>
      <div className="divide-y divide-border rounded-[18px] border border-border bg-card">
        {viagens.map((v) => (
          <Link
            key={v.id}
            to="/trip/$id"
            params={{ id: v.id }}
            className="tap flex items-center gap-3 px-4"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pess-soft text-pess">
              <MapPin size={24} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-lg">{v.nome}</strong>
              <span className="text-base text-muted-foreground">
                {dataBRCurta(v.data_inicio)} · {v.destino}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
