import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, ChevronLeft, ChevronRight, User, CalendarDays, Link2 } from "lucide-react";
import { buscarCotacaoDetalhe, expensesQuery, membersQuery, tripMembrosQuery, tripQuery, type Cotacao, type Expense } from "@/lib/data";
import { CampoMoeda } from "@/components/CampoMoeda";
import { AvatarPessoa } from "@/components/Pessoa";
import { FolhaDivisao, calcularDivisao, fraseCentavos, type Divisao, type PessoaDiv } from "@/components/FolhaDivisao";
import { fmtMoney } from "@/lib/format";
import { CATEGORIAS, normalizarCategoria } from "@/lib/categorias";
import { mutar } from "@/lib/outbox";
import { novoId } from "@/lib/itens";
import { participantesPadrao, centavos } from "@/lib/divisao";
import { guardarTaxa, nomeCurto, ultimaTaxa, useUid } from "@/lib/despesas";
import { moedaValida } from "@/lib/moedas";

const s = (v: unknown) => {
  if (typeof v !== "string") return "";
  try { const x = JSON.parse(v); return typeof x === "string" ? x : v; } catch { return v; }
};

export const Route = createFileRoute("/trip/$id/despesas/nova")({
  validateSearch: (q: Record<string, unknown>) => ({
    editar: s(q.editar), itemTipo: s(q.itemTipo), itemId: s(q.itemId), descricao: s(q.descricao), valor: s(q.valor), moeda: s(q.moeda),
    data: s(q.data), categoria: s(q.categoria), pessoas: s(q.pessoas), origemNome: s(q.origemNome),
  }),
  head: () => ({
    meta: [
      { title: "Lançar despesa — Evoque Viagens" },
      { name: "description", content: "Valor, categoria e salvar. A despesa já nasce dividida igual." },
      { property: "og:title", content: "Lançar despesa — Evoque Viagens" },
      { property: "og:description", content: "Valor, categoria e salvar. A despesa já nasce dividida igual." },
    ],
  }),
  component: NovaDespesa,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Viagem não encontrada.</div>,
});

const hoje = () => new Date().toISOString().slice(0, 10);

function NovaDespesa() {
  const { id } = Route.useParams();
  const q = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const uid = useUid();
  const { data: trip } = useSuspenseQuery(tripQuery(id));
  const { data: despesas } = useSuspenseQuery(expensesQuery(id));
  const { data: membros } = useSuspenseQuery(membersQuery(id));
  const { data: tripMembros } = useSuspenseQuery(tripMembrosQuery(id));
  const editando: Expense | undefined = q.editar ? despesas.find((d) => d.id === q.editar) : undefined;
  const eu = membros.find((m) => m.meu)?.person_id ?? membros.find((m) => m.papel === "owner")?.person_id ?? null;

  const [valorTxt, setValorTxt] = useState(() => editando ? String(editando.valor_original) : q.valor || "");
  const [moeda, setMoeda] = useState(() => editando?.moeda_original ?? (moedaValida(q.moeda) ? q.moeda.toUpperCase() : trip.moeda_base));
  const [cat, setCat] = useState<string>(() => editando?.categoria ?? normalizarCategoria(q.categoria) ?? "comida");
  const [data, setData] = useState(() => editando?.data ?? (q.data || hoje()));
  const [descricao, setDescricao] = useState(() => editando?.descricao ?? q.descricao);
  const [comprovante, setComprovante] = useState<string | null>(editando?.comprovante_url ?? null);
  const [pagadores, setPagadores] = useState<Record<string, string>>(() =>
    editando ? Object.fromEntries(editando.pagadores.map((p) => [p.person_id, String(p.valor_original)])) : eu ? { [eu]: "" } : {});
  const [pessoal, setPessoal] = useState(editando?.pessoal ?? false);
  const [pessoalDe, setPessoalDe] = useState<string | null>(editando?.pessoal_de ?? null);
  const [taxaTxt, setTaxaTxt] = useState(editando ? String(editando.taxa_cambio) : "1");
  const [fonte, setFonte] = useState<Cotacao | null>(editando?.taxa_fonte ? { taxa: Number(editando.taxa_cambio), fonte: editando.taxa_fonte, data: editando.taxa_data ?? "" } : null);
  const [provisoria, setProvisoria] = useState(editando?.taxa_provisoria ?? false);
  const [folha, setFolha] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const padrao = useMemo(() => participantesPadrao(tripMembros, data), [tripMembros, data]);
  const doItem = q.pessoas ? q.pessoas.split(",").filter((p) => padrao.some((m) => m.person_id === p)) : [];
  const [divisao, setDivisao] = useState<Divisao | null>(() => editando && !editando.pessoal
    ? { modo: editando.divisao ?? "igual", incluidos: editando.partes.map((p) => p.person_id), pesos: Object.fromEntries(editando.partes.map((p) => [p.person_id, String(editando.divisao === "valor" ? p.valor_moeda_base : p.peso)])) }
    : null);
  // Sem escolha manual, a divisão segue a data: igual entre quem já estava na viagem.
  const div: Divisao = divisao ?? { modo: "igual", incluidos: doItem.length ? doItem : padrao.map((m) => m.person_id), pesos: {} };

  const valor = Number(valorTxt.replace(",", ".")) || 0;
  const diferente = moeda !== trip.moeda_base;
  const taxa = diferente ? Number(taxaTxt.replace(",", ".")) || 0 : 1;
  const totalC = Math.round(valor * taxa * 100);
  const nomes = (pid: string) => nomeCurto(membros, pid);
  const pessoasDiv: PessoaDiv[] = tripMembros.filter((m) => m.status !== "recusado" && m.status !== "saiu").map((m) => ({ id: m.person_id, nome: nomes(m.person_id), fora: !padrao.some((p) => p.person_id === m.person_id) }));
  const r = calcularDivisao(totalC, pessoasDiv, div);

  // Câmbio: busca com internet; sem internet usa a última taxa guardada e marca provisória.
  useEffect(() => {
    if (!diferente || (editando && editando.moeda_original === moeda && editando.data === data)) return;
    let vivo = true;
    (async () => {
      const c = navigator.onLine ? await buscarCotacaoDetalhe(moeda, trip.moeda_base, data) : null;
      if (!vivo) return;
      if (c) { setTaxaTxt(String(c.taxa)); setFonte(c); setProvisoria(false); guardarTaxa(moeda, trip.moeda_base, c.taxa, c.data); return; }
      const u = ultimaTaxa(moeda, trip.moeda_base);
      setFonte(null);
      if (u) { setTaxaTxt(String(u.taxa)); setProvisoria(true); } else setTaxaTxt("");
    })();
    return () => { vivo = false; };
  }, [moeda, trip.moeda_base, diferente, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const idsPag = Object.keys(pagadores);
  const variosPag = idsPag.length > 1;
  const somaPag = variosPag ? idsPag.reduce((a, p) => a + (Number((pagadores[p] ?? "").replace(",", ".")) || 0), 0) : valor;
  const pagFecha = idsPag.length > 0 && Math.round(somaPag * 100) === Math.round(valor * 100);

  function tocarPagador(pid: string) {
    setPagadores((p) => {
      const n = { ...p };
      if (pid in n) { if (Object.keys(n).length > 1) delete n[pid]; } else n[pid] = "";
      return n;
    });
  }

  const podeSalvar = valor > 0 && taxa > 0 && pagFecha && (pessoal ? !!pessoalDe : r.fecha && r.lista.length > 0) && uid === trip.owner_id;

  async function salvar() {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      const expenseId = editando?.id ?? novoId();
      // Pagadores em moeda base: arredonda cada um e acerta o último para fechar no total.
      const pags = idsPag.map((pid) => {
        const orig = variosPag ? Number((pagadores[pid] ?? "").replace(",", ".")) || 0 : valor;
        return { person_id: pid, valor_original: orig, c: Math.round(orig * taxa * 100) };
      });
      const dif = totalC - pags.reduce((a, p) => a + p.c, 0);
      pags[pags.length - 1]!.c += dif;
      const pagadoresJ = pags.map((p) => ({ person_id: p.person_id, valor_original: p.valor_original, valor_moeda_base: p.c / 100 }));
      const partesJ = pessoal ? [] : r.lista.map((p) => ({ person_id: p.id, peso: div.modo === "valor" ? centavos(p.peso) / 100 : p.peso, valor_moeda_base: (r.partes.get(p.id) ?? 0) / 100 }));
      const autoTaxa = fonte && String(fonte.taxa) === taxaTxt;
      const d = {
        id: expenseId, trip_id: id,
        descricao: descricao.trim() || CATEGORIAS.find((c) => c.id === cat)!.rotulo,
        categoria: cat, data, valor_original: valor, moeda_original: moeda, taxa_cambio: taxa, valor_moeda_base: totalC / 100,
        taxa_fonte: diferente ? (autoTaxa ? fonte!.fonte : provisoria ? "última guardada" : "manual") : null,
        taxa_data: diferente ? (autoTaxa ? fonte!.data : data) : null,
        taxa_provisoria: diferente && provisoria && !autoTaxa,
        comprovante_url: comprovante, pessoal, pessoal_de: pessoal ? pessoalDe : null, divisao: pessoal ? "igual" : div.modo,
        item_tipo: editando?.item_tipo ?? (["ticket", "lodging", "reservation"].includes(q.itemTipo) ? q.itemTipo : null),
        item_id: editando?.item_id ?? (q.itemId || null),
      };
      const res = await mutar({ tipo: "rpc", funcao: "salvar_despesa", args: { _d: d, _pagadores: pagadoresJ, _partes: partesJ } });
      const local: Expense = { ...(editando ?? {}), ...d, pago_por: pagadoresJ[0]!.person_id, criado_por: editando?.criado_por ?? uid ?? null, editado_em: editando ? new Date().toISOString() : null,
        pagadores: pagadoresJ.map((p, i) => ({ id: `l${i}`, deleted_at: null, ...p })), partes: partesJ.map((p, i) => ({ id: `p${i}`, deleted_at: null, ...p })) } as Expense;
      qc.setQueryData<Expense[]>(expensesQuery(id).queryKey, (l) => [local, ...(l ?? []).filter((e) => e.id !== expenseId)].sort((a, b) => b.data.localeCompare(a.data)));
      if (res === "salvo") void qc.invalidateQueries({ queryKey: expensesQuery(id).queryKey });
      toast.success(res === "fila" ? "Sem internet · salva no aparelho" : editando ? "Despesa atualizada" : "Despesa lançada");
      navigate({ to: "/trip/$id/despesas", params: { id } });
    } catch (e) {
      toast.error((e as Error).message);
      setSalvando(false);
    }
  }

  const resumoDiv = div.modo === "igual"
    ? `Dividido igual entre ${r.lista.length}${r.lista.length ? ` · ${fmtMoney((r.partes.get(r.lista[r.lista.length - 1]!.id) ?? 0) / 100, trip.moeda_base)} cada` : ""}`
    : `Dividido por ${div.modo === "valor" ? "valor" : div.modo === "pct" ? "%" : "cotas"} entre ${r.lista.length}`;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => navigate({ to: "/trip/$id/despesas", params: { id } })} className="tap flex flex-col items-center justify-center rounded-xl text-foreground" aria-label="Voltar">
          <ChevronLeft size={28} strokeWidth={2.2} /><span className="text-xs font-semibold">Voltar</span>
        </button>
        <h1 className="flex-1 text-2xl">{editando ? "Editar despesa" : "Nova despesa"}</h1>
      </header>

      <main className="space-y-5 px-4">
        {q.origemNome && !editando && (
          <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-3 text-base font-bold text-foreground"><Link2 size={22} strokeWidth={2.2} /> Veio do {q.origemNome}</p>
        )}

        <section className="rounded-3xl border border-border bg-card p-4 text-center">
          <input
            inputMode="decimal" autoFocus={!editando} aria-label="Valor" placeholder="0,00"
            value={valorTxt} onChange={(e) => setValorTxt(e.target.value.replace(/[^\d.,]/g, ""))}
            className="num w-full bg-transparent text-center text-[48px] leading-tight text-foreground outline-none"
          />
          <div className="mx-auto mt-2 max-w-xs"><CampoMoeda value={moeda} onChange={setMoeda} rotulo="Moeda" /></div>
          {diferente && (
            <div className="mt-3 space-y-1 text-left">
              <label className="text-base font-bold text-foreground">Câmbio {moeda} → {trip.moeda_base}
                <input inputMode="decimal" value={taxaTxt} onChange={(e) => { setTaxaTxt(e.target.value.replace(",", ".")); setProvisoria(false); }} className="tap mt-1 w-full rounded-xl border-2 border-input bg-background px-3 text-xl font-bold" />
              </label>
              <p className="text-base text-muted-foreground">
                = {fmtMoney(totalC / 100, trip.moeda_base)} · {fonte && String(fonte.taxa) === taxaTxt ? `${fonte.fonte} · ${fonte.data.slice(8, 10)}/${fonte.data.slice(5, 7)}` : provisoria ? "Taxa provisória (sem internet)" : taxaTxt ? "Taxa manual" : "Digite a taxa"}
              </p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-3 gap-3">
          {CATEGORIAS.map(({ id: cid, rotulo, Icone }) => (
            <button key={cid} onClick={() => setCat(cid)} aria-pressed={cat === cid}
              className={`flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-2xl border-2 ${cat === cid ? "border-navy bg-navy text-primary-foreground" : "border-border bg-card text-foreground"}`}>
              <Icone size={30} strokeWidth={2.2} /><span className="text-base font-bold">{rotulo}</span>
            </button>
          ))}
        </div>

        <section>
          <h2 className="text-lg font-bold text-foreground">Quem pagou</h2>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
            {pessoasDiv.map((p) => {
              const on = p.id in pagadores;
              return (
                <button key={p.id} onClick={() => tocarPagador(p.id)} aria-pressed={on} className="flex w-[68px] shrink-0 flex-col items-center gap-1">
                  <span className={`rounded-full p-0.5 ${on ? "ring-4 ring-teal" : ""}`}><AvatarPessoa nome={p.nome} foto={null} tamanho={56} /></span>
                  <span className={`w-full truncate text-center text-sm ${on ? "font-bold text-foreground" : "text-muted-foreground"}`}>{p.nome}</span>
                </button>
              );
            })}
          </div>
          {variosPag && (
            <div className="mt-2 space-y-2">
              {idsPag.map((pid) => (
                <label key={pid} className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-border bg-card px-3">
                  <span className="flex-1 text-lg font-bold">{nomes(pid)} pagou</span>
                  <input inputMode="decimal" value={pagadores[pid]} onChange={(e) => setPagadores({ ...pagadores, [pid]: e.target.value })} placeholder={moeda} className="h-12 w-28 rounded-xl border-2 border-input bg-background px-2 text-right text-lg font-bold" />
                </label>
              ))}
              {!pagFecha && <p className="text-base font-bold text-danger">{somaPag < valor ? `Faltam ${fmtMoney(valor - somaPag, moeda)}` : `Sobram ${fmtMoney(somaPag - valor, moeda)}`}</p>}
            </div>
          )}
        </section>

        <button onClick={() => setPessoal(!pessoal)} role="switch" aria-checked={pessoal}
          className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 text-left ${pessoal ? "border-pessoal-border bg-pessoal" : "border-border bg-card"}`}>
          <User size={26} strokeWidth={2.2} className={pessoal ? "text-pessoal-foreground" : "text-foreground"} />
          <span className="flex-1">
            <span className={`block text-lg font-bold ${pessoal ? "text-pessoal-foreground" : "text-foreground"}`}>Só de uma pessoa</span>
            <span className="block text-sm text-muted-foreground">Não divide, não entra no saldo</span>
          </span>
          <span className={`flex h-8 w-14 items-center rounded-full p-1 ${pessoal ? "justify-end bg-pessoal-foreground" : "justify-start bg-muted-foreground/40"}`}><span className="h-6 w-6 rounded-full bg-card" /></span>
        </button>

        {pessoal ? (
          <section className="rounded-2xl border-2 border-pessoal-border bg-pessoal p-3">
            <h2 className="text-lg font-bold text-pessoal-foreground">De quem é?</h2>
            <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
              {pessoasDiv.map((p) => (
                <button key={p.id} onClick={() => setPessoalDe(p.id)} aria-pressed={pessoalDe === p.id} className="flex w-[68px] shrink-0 flex-col items-center gap-1">
                  <span className={`rounded-full p-0.5 ${pessoalDe === p.id ? "ring-4 ring-pessoal-foreground" : ""}`}><AvatarPessoa nome={p.nome} foto={null} tamanho={56} /></span>
                  <span className="w-full truncate text-center text-sm font-bold text-pessoal-foreground">{p.nome}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <button onClick={() => setFolha(true)} className="flex min-h-14 w-full items-center gap-2 rounded-2xl border-2 border-border bg-card px-4 text-left">
            <span className="flex-1">
              <span className={`block text-lg font-bold ${r.fecha ? "text-foreground" : "text-danger"}`}>{r.fecha ? resumoDiv : "A divisão não fecha · ajuste"}</span>
              {r.fecha && r.extras > 0 && <span className="block text-sm text-muted-foreground">{fraseCentavos(r.extras)}</span>}
            </span>
            <ChevronRight size={26} strokeWidth={2.2} />
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="tap flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card text-base font-bold text-foreground">
            <Camera size={24} strokeWidth={2.2} /> {comprovante ? "Recibo anexado" : "Foto do recibo"}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const fr = new FileReader(); fr.onload = () => setComprovante(String(fr.result)); fr.readAsDataURL(f);
            }} />
          </label>
          <label className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card px-2 text-base font-bold text-foreground">
            <CalendarDays size={24} strokeWidth={2.2} />
            <input type="date" aria-label="Data" value={data} max="2099-12-31" onChange={(e) => e.target.value && setData(e.target.value)} className="min-w-0 bg-transparent text-base font-bold" />
          </label>
        </div>

        <input placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="tap w-full rounded-xl border-2 border-input bg-card px-4 text-lg text-foreground" />

        <button onClick={salvar} disabled={!podeSalvar || salvando} className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold disabled:opacity-40">
          <Check size={28} strokeWidth={2.2} /> Salvar
        </button>
        <p className="text-center text-base text-muted-foreground">Sem internet? Salva no aparelho e sobe depois.</p>
      </main>

      <FolhaDivisao aberta={folha} onFechar={() => setFolha(false)} totalC={totalC} moeda={trip.moeda_base} pessoas={pessoasDiv} valor={div} onPronto={setDivisao} />
    </div>
  );
}
