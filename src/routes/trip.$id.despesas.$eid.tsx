import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, Eye, Pencil, Trash2, User } from "lucide-react";
import { expensesQuery, membersQuery, tripQuery } from "@/lib/data";
import { categoria } from "@/lib/categorias";
import { dataBRCurta, fmtMoney } from "@/lib/format";
import { apagarDespesa, nomeCurto, useUid } from "@/lib/despesas";
import { AvatarPessoa } from "@/components/Pessoa";

export const Route = createFileRoute("/trip/$id/despesas/$eid")({
  head: () => ({
    meta: [
      { title: "Despesa — Evoque Viagens" },
      { name: "description", content: "Quem pagou, a parte de cada um e o comprovante." },
      { property: "og:title", content: "Despesa — Evoque Viagens" },
      { property: "og:description", content: "Quem pagou, a parte de cada um e o comprovante." },
    ],
  }),
  component: Detalhe,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Despesa não encontrada.</div>,
});

function Detalhe() {
  const { id, eid } = Route.useParams();
  const uid = useUid();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: trip } = useSuspenseQuery(tripQuery(id));
  const { data: despesas } = useSuspenseQuery(expensesQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const d = despesas.find((x) => x.id === eid);
  const voltar = <Link to="/trip/$id/despesas" params={{ id }} aria-label="Voltar" className="tap flex flex-col items-center justify-center rounded-xl text-foreground"><ChevronLeft size={28} strokeWidth={2.2} /><span className="text-xs font-semibold">Voltar</span></Link>;
  if (!d) return <div className="p-4">{voltar}<p className="p-4 text-lg">Despesa não encontrada.</p></div>;
  const org = uid === trip.owner_id;
  const moeda = trip.moeda_base;
  const c = categoria(d.categoria);
  const Icone = c.Icone;
  const dono = membros.find((m) => m.papel === "owner");

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="flex items-center gap-2 px-3 py-2">{voltar}<h1 className="flex-1 truncate text-2xl">{d.descricao}</h1></header>
      <main className="space-y-4 px-4">
        {!org && uid !== undefined && <p className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-bold"><Eye size={18} strokeWidth={2.2} /> Só leitura</p>}

        <section className={`rounded-3xl p-5 ${d.pessoal ? "border-2 border-pessoal-border bg-pessoal" : "bg-navy text-primary-foreground"}`}>
          <p className={`flex items-center gap-2 text-base font-bold ${d.pessoal ? "text-pessoal-foreground" : "opacity-90"}`}>
            {d.pessoal ? <User size={24} strokeWidth={2.2} /> : <Icone size={24} strokeWidth={2.2} />} {d.pessoal ? `PESSOAL · ${nomeCurto(membros, d.pessoal_de)}` : c.rotulo} · {dataBRCurta(d.data)}
          </p>
          <p className={`num mt-2 text-[42px] leading-none ${d.pessoal ? "text-pessoal-foreground" : ""}`}>{fmtMoney(Number(d.valor_moeda_base), moeda)}</p>
          {d.moeda_original !== moeda && (
            <p className="mt-2 text-base opacity-90">{fmtMoney(Number(d.valor_original), d.moeda_original)} · taxa {String(d.taxa_cambio).replace(".", ",")}{d.taxa_fonte ? ` · ${d.taxa_fonte}` : ""}{d.taxa_data ? ` · ${dataBRCurta(d.taxa_data)}` : ""}{d.taxa_provisoria ? " · provisória" : ""}</p>
          )}
          {d.pessoal && <p className="mt-2 text-base text-foreground">Não entra na divisão nem no saldo</p>}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">Quem pagou</h2>
          <ul className="mt-2 space-y-2">
            {d.pagadores.map((p) => (
              <li key={p.id} className="flex items-center gap-3"><AvatarPessoa nome={nomeCurto(membros, p.person_id)} foto={null} tamanho={44} /><span className="flex-1 text-lg">{nomeCurto(membros, p.person_id)}</span><span className="num text-lg">{fmtMoney(Number(p.valor_moeda_base), moeda)}</span></li>
            ))}
          </ul>
        </section>

        {!d.pessoal && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg font-bold">Parte de cada um · {d.divisao === "valor" ? "por valor" : d.divisao === "pct" ? "por %" : d.divisao === "cotas" ? "por cotas" : "igual"}</h2>
            <ul className="mt-2 space-y-2">
              {d.partes.map((p) => (
                <li key={p.id} className="flex items-center gap-3"><AvatarPessoa nome={nomeCurto(membros, p.person_id)} foto={null} tamanho={44} /><span className="flex-1 text-lg">{nomeCurto(membros, p.person_id)}</span><span className="num text-lg">{fmtMoney(Number(p.valor_moeda_base), moeda)}</span></li>
              ))}
            </ul>
          </section>
        )}

        {d.comprovante_url && (
          <a href={d.comprovante_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-border bg-card">
            <img src={d.comprovante_url} alt="Comprovante" className="max-h-80 w-full object-contain" />
          </a>
        )}

        <p className="text-sm text-muted-foreground">
          Adicionado por {dono ? nomeCurto(membros, dono.person_id) : "organizador"}{d.created_at ? ` · ${dataBRCurta(d.created_at.slice(0, 10))}` : ""}{d.editado_em ? ` · editado em ${dataBRCurta(d.editado_em.slice(0, 10))}` : ""}
        </p>

        {org && (
          <div className="grid grid-cols-2 gap-3">
            <Link to="/trip/$id/despesas/nova" params={{ id }} search={{ editar: d.id, itemTipo: "", itemId: "", descricao: "", valor: "", moeda: "", data: "", categoria: "", pessoas: "", origemNome: "" }} className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-lg font-bold"><Pencil size={24} strokeWidth={2.2} /> Editar</Link>
            <button onClick={async () => { await apagarDespesa(qc, id, d.id); navigate({ to: "/trip/$id/despesas", params: { id } }); }} className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-lg font-bold text-danger"><Trash2 size={24} strokeWidth={2.2} /> Apagar</button>
          </div>
        )}
      </main>
    </div>
  );
}
