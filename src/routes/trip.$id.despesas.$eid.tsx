import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, ChevronLeft, Eye, Pencil, RefreshCw, Trash2, User, X } from "lucide-react";
import { buscarCotacaoDetalhe, type Expense } from "@/lib/data";
import { centavos, dividir } from "@/lib/divisao";
import { mutar } from "@/lib/outbox";
import { expensesQuery, membersQuery, tripQuery } from "@/lib/data";
import { categoria } from "@/lib/categorias";
import { dataBRCurta, fmtMoney } from "@/lib/format";
import { apagarDespesa, nomeCompleto, nomeCurto, useUid } from "@/lib/despesas";
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
  const [telaCheia, setTelaCheia] = useState(false);
  const [online, setOnline] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  useEffect(() => {
    const f = () => setOnline(navigator.onLine);
    f(); window.addEventListener("online", f); window.addEventListener("offline", f);
    return () => { window.removeEventListener("online", f); window.removeEventListener("offline", f); };
  }, []);
  const key = expensesQuery(id).queryKey;

  async function trocarRecibo(novo: string | null) {
    if (!d) return;
    const antes = d.comprovante_url;
    const aplicar = async (v: string | null) => {
      qc.setQueryData<Expense[]>(key, (l) => (l ?? []).map((e) => (e.id === d.id ? { ...e, comprovante_url: v } : e)));
      await mutar({ tipo: "update", tabela: "expense", id: d.id, valores: { comprovante_url: v } });
    };
    await aplicar(novo);
    toast(novo ? "Recibo trocado" : "Recibo tirado", { duration: 10_000, action: { label: "Desfazer", onClick: () => void aplicar(antes) } });
  }

  /** Taxa provisória → taxa histórica do dia do gasto. Só com o toque do organizador; vai para o log pelo salvar_despesa. */
  async function atualizarTaxa() {
    if (!d) return;
    setAtualizando(true);
    try {
      const c = await buscarCotacaoDetalhe(d.moeda_original, trip.moeda_base, d.data);
      if (!c) { toast.error("Não achamos a cotação agora."); return; }
      const totalC = Math.round(Number(d.valor_original) * c.taxa * 100);
      const pags = d.pagadores.map((p) => ({ person_id: p.person_id, valor_original: Number(p.valor_original ?? 0), c: Math.round(Number(p.valor_original ?? 0) * c.taxa * 100) }));
      if (pags.length) pags[pags.length - 1]!.c += totalC - pags.reduce((a, p) => a + p.c, 0);
      const { partes } = dividir(totalC, d.partes.map((p) => ({ id: p.person_id, peso: Math.max(1, centavos(p.valor_moeda_base)) })), "cotas");
      const { pagadores: _p, partes: _s, ...resto } = d;
      const nd = { ...resto, taxa_cambio: c.taxa, valor_moeda_base: totalC / 100, taxa_fonte: c.fonte, taxa_data: c.data, taxa_provisoria: false };
      const pagadoresJ = pags.map((p) => ({ person_id: p.person_id, valor_original: p.valor_original, valor_moeda_base: p.c / 100 }));
      const partesJ = d.pessoal ? [] : d.partes.map((p) => ({ person_id: p.person_id, peso: d.divisao === "valor" ? (partes.get(p.person_id) ?? 0) / 100 : Number(p.peso ?? 1), valor_moeda_base: (partes.get(p.person_id) ?? 0) / 100 }));
      await mutar({ tipo: "rpc", funcao: "salvar_despesa", args: { _d: nd, _pagadores: pagadoresJ, _partes: partesJ } });
      await qc.invalidateQueries({ queryKey: key });
      toast.success(`Taxa atualizada · ${c.fonte} · ${dataBRCurta(c.data)}`);
    } catch (e) { toast.error((e as Error).message); } finally { setAtualizando(false); }
  }
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
          {org && d.taxa_provisoria && online && (
            <button disabled={atualizando} onClick={() => void atualizarTaxa()} className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-foreground text-base font-bold text-navy disabled:opacity-60"><RefreshCw size={22} strokeWidth={2.2} className={atualizando ? "animate-spin" : ""} /> Taxa provisória · Atualizar</button>
          )}
          {d.pessoal && <p className="mt-2 text-base text-foreground">Não entra na divisão nem no saldo</p>}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">Quem pagou</h2>
          <ul className="mt-2 space-y-2">
            {d.pagadores.map((p) => (
              <li key={p.id} className="flex items-center gap-3"><AvatarPessoa nome={nomeCompleto(membros, p.person_id)} foto={null} tamanho={44} /><span className="flex-1 text-lg">{nomeCurto(membros, p.person_id)}</span><span className="num text-lg">{fmtMoney(Number(p.valor_moeda_base), moeda)}</span></li>
            ))}
          </ul>
        </section>

        {!d.pessoal && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg font-bold">Parte de cada um · {d.divisao === "valor" ? "por valor" : d.divisao === "pct" ? "por %" : d.divisao === "cotas" ? "por cotas" : "igual"}</h2>
            <ul className="mt-2 space-y-2">
              {d.partes.map((p) => (
                <li key={p.id} className="flex items-center gap-3"><AvatarPessoa nome={nomeCompleto(membros, p.person_id)} foto={null} tamanho={44} /><span className="flex-1 text-lg">{nomeCurto(membros, p.person_id)}</span><span className="num text-lg">{fmtMoney(Number(p.valor_moeda_base), moeda)}</span></li>
              ))}
            </ul>
          </section>
        )}

        {d.comprovante_url && (
          <button onClick={() => setTelaCheia(true)} aria-label="Ver recibo em tela cheia" className="block w-full overflow-hidden rounded-2xl border border-border bg-card">
            <img src={d.comprovante_url} alt="Recibo" className="max-h-80 w-full object-contain" />
          </button>
        )}
        {org && (
          <div className={`grid gap-3 ${d.comprovante_url ? "grid-cols-2" : "grid-cols-1"}`}>
            <label className="tap flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-base font-bold">
              <Camera size={24} strokeWidth={2.2} /> {d.comprovante_url ? "Trocar recibo" : "Foto do recibo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                const fr = new FileReader(); fr.onload = () => void trocarRecibo(String(fr.result)); fr.readAsDataURL(f);
                e.target.value = "";
              }} />
            </label>
            {d.comprovante_url && <button onClick={() => void trocarRecibo(null)} className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-base font-bold text-danger"><X size={24} strokeWidth={2.2} /> Tirar recibo</button>}
          </div>
        )}
        {telaCheia && d.comprovante_url && (
          <div role="dialog" aria-label="Recibo" className="fixed inset-0 z-50 flex flex-col bg-navy">
            <button onClick={() => setTelaCheia(false)} className="tap m-3 flex items-center justify-center gap-2 self-end rounded-xl bg-primary-foreground px-4 text-lg font-bold text-navy"><X size={26} strokeWidth={2.2} /> Fechar</button>
            <img src={d.comprovante_url} alt="Recibo" className="min-h-0 flex-1 object-contain p-2" />
          </div>
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
