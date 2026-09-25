import { createFileRoute, Link } from "@tanstack/react-router";
import { EditarItem } from "@/components/EditarItem";
import { abrirAnexo } from "@/lib/anexosOffline";
import { toast } from "sonner";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BedDouble, FileText, Plus } from "lucide-react";
import { Topo } from "@/components/Chrome";
import { lodgingsQuery } from "@/lib/data";
import { chaveDia, dataBRCurta, fmtMoney, horaNoFuso, fusoLocal } from "@/lib/format";

export const Route = createFileRoute("/trip/$id/hospedagem/")({
  head: () => ({
    meta: [
      { title: "Hospedagem — Evoque Viagens" },
      { name: "description", content: "Estadias da viagem com entrada, saída e localizador." },
      { property: "og:title", content: "Hospedagem" },
      { property: "og:description", content: "Estadias da viagem com entrada, saída e localizador." },
    ],
  }),
  component: Hospedagem,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Sem hospedagem.</div>,
});

function Hospedagem() {
  const { id } = Route.useParams();
  const { data: estadias } = useSuspenseQuery(lodgingsQuery(id));

  return (
    <>
      <Topo titulo="Hospedagem" voltarPara="/trip/$id" voltarParams={{ id }} />
      <main className="space-y-4 px-4 pt-4">
        {estadias.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-lg font-semibold">
            Nenhuma estadia ainda
          </p>
        )}
        {estadias.map((h) => (
          <article key={h.id} className="shadow-soft overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex gap-4 p-4">
              <BedDouble size={28} strokeWidth={2.2} className="mt-1 text-accent" />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl leading-tight text-foreground">{h.nome}</h2>
                <p className="text-base font-semibold text-muted-foreground">{h.cidade ?? h.endereco}</p>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase text-muted-foreground">Entrada</p>
                    <p className="num text-2xl text-foreground">{horaNoFuso(h.checkin, fusoLocal())}</p>
                    <p className="text-base font-semibold text-foreground">{dataBRCurta(chaveDia(h.checkin))}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase text-muted-foreground">Saída</p>
                    <p className="num text-2xl text-foreground">{horaNoFuso(h.checkout, fusoLocal())}</p>
                    <p className="text-base font-semibold text-foreground">{dataBRCurta(chaveDia(h.checkout))}</p>
                  </div>
                </div>

                {h.localizador && (
                  <p className="mono-code mt-3 text-2xl font-bold text-accent">{h.localizador}</p>
                )}
                {h.valor != null && (
                  <p className="num mt-2 text-[36px] leading-none text-foreground">
                    {fmtMoney(Number(h.valor), h.moeda ?? "BRL")}
                  </p>
                )}
              </div>
            </div>
            {h.anexo_url && (
              <button
                onClick={() => void abrirAnexo(h.anexo_url!).then((ok) => !ok && toast.error("Sem internet e sem cópia guardada deste arquivo."))}
                className="tap flex w-full items-center justify-center gap-3 border-t border-border bg-muted text-lg font-bold text-foreground"
              >
                <FileText size={28} strokeWidth={2.2} />
                Ver voucher
              </button>
            )}
            <EditarItem
              tabela="lodging"
              item={h as unknown as { id: string } & Record<string, unknown>}
              queryKey={lodgingsQuery(id).queryKey}
              campos={[{ chave: "nome", rotulo: "Nome" }, { chave: "localizador", rotulo: "Localizador" }, { chave: "endereco", rotulo: "Endereço" }]}
            />
          </article>
        ))}

        <Link
          to="/trip/$id/hospedagem/nova"
          params={{ id }}
          className="tap flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-accent text-xl font-bold text-accent"
        >
          <Plus size={28} strokeWidth={2.2} />
          Nova estadia
        </Link>
      </main>
    </>
  );
}
