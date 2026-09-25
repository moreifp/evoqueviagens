import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, Delete, ChevronLeft } from "lucide-react";
import { buscarCotacao, expensesQuery, tripQuery } from "@/lib/data";
import { fmtMoney, MOEDAS } from "@/lib/format";
import { CATEGORIAS } from "@/lib/categorias";
import { supabase } from "@/integrations/supabase/client";
import { mutar } from "@/lib/outbox";
import { novoId } from "@/lib/itens";
import { PreencherArquivo } from "@/components/PreencherArquivo";
import { soData } from "@/lib/importAnexo";

export const Route = createFileRoute("/trip/$id/despesas/nova")({
  validateSearch: (s: Record<string, unknown>) => ({ itemTipo: textoBusca(s.itemTipo), itemId: textoBusca(s.itemId), descricao: textoBusca(s.descricao), valor: textoBusca(s.valor), moeda: textoBusca(s.moeda), data: textoBusca(s.data) }),
  head: () => ({
    meta: [
      { title: "Novo gasto — Evoque Viagens" },
      { name: "description", content: "Lance um gasto em três toques, com câmbio do dia." },
      { property: "og:title", content: "Novo gasto" },
      { property: "og:description", content: "Lance um gasto em três toques, com câmbio do dia." },
    ],
  }),
  component: NovaDespesa,
  errorComponent: ({ error }) => <div role="alert" className="p-6 text-lg">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-lg">Viagem não encontrada.</div>,
});

function textoBusca(v: unknown) {
  if (typeof v !== "string") return "";
  try { const x = JSON.parse(v); return typeof x === "string" ? x : v; } catch { return v; }
}

function NovaDespesa() {
  const { id } = Route.useParams();
  const origem = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: trip } = useSuspenseQuery(tripQuery(id));
  useSuspenseQuery(expensesQuery(id));

  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [digitos, setDigitos] = useState(() => origem.valor ? String(Math.round(Number(origem.valor) * 100)) : "");
  const [moeda, setMoeda] = useState(origem.moeda || trip.moeda_base);
  const [categoria, setCategoria] = useState("alimentacao");
  const [descricao, setDescricao] = useState(origem.descricao);
  const [taxa, setTaxa] = useState("1");
  const [buscandoTaxa, setBuscandoTaxa] = useState(false);
  const [comprovante, setComprovante] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [dataGasto, setDataGasto] = useState(origem.data || "");

  const valor = Number(digitos || "0") / 100;
  const diferente = moeda !== trip.moeda_base;

  useEffect(() => {
    if (passo !== 3) return;
    if (!diferente) {
      setTaxa("1");
      return;
    }
    setBuscandoTaxa(true);
    buscarCotacao(moeda, trip.moeda_base).then((c) => {
      setBuscandoTaxa(false);
      if (c) setTaxa(String(c));
    });
  }, [passo, moeda, trip.moeda_base, diferente]);

  const valorBase = valor * Number(taxa || "0");

  function tecla(t: string) {
    if (t === "del") setDigitos((d) => d.slice(0, -1));
    else if (digitos.length < 10) setDigitos((d) => (d === "0" ? t : d + t));
  }

  async function salvar() {
    setSalvando(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const expenseId = novoId();
      const resultado = await mutar({ tipo: "insert", tabela: "expense", valores: {
        id: expenseId,
        trip_id: id,
        descricao: descricao || CATEGORIAS.find((c) => c.id === categoria)?.rotulo || "Gasto",
        categoria,
        data: dataGasto || new Date().toISOString().slice(0, 10),
        valor_original: valor,
        moeda_original: moeda,
        taxa_cambio: Number(taxa || "1"),
        valor_moeda_base: Number(valorBase.toFixed(2)),
        comprovante_url: comprovante,
        criado_por: auth.user?.id,
      } });
      if (origem.itemId && ["ticket", "lodging", "reservation"].includes(origem.itemTipo)) await mutar({ tipo: "update", tabela: origem.itemTipo, id: origem.itemId, valores: { expense_id: expenseId } });
      await qc.invalidateQueries({ queryKey: ["expenses", id] });
      toast.success(resultado === "fila" ? "Sem internet · gasto salvo no aparelho" : "Gasto lançado");
      navigate({ to: "/trip/$id/despesas", params: { id } });
    } catch (e) {
      toast.error((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => (passo === 1 ? navigate({ to: "/trip/$id", params: { id } }) : setPasso((p) => (p - 1) as 1 | 2))}
          className="tap flex flex-col items-center justify-center rounded-xl text-foreground"
          aria-label="Voltar"
        >
          <ChevronLeft size={28} strokeWidth={2.2} />
          <span className="text-xs font-semibold">Voltar</span>
        </button>
        <h1 className="flex-1 text-2xl">Novo gasto</h1>
      </header>

      {passo === 1 && (
        <main className="px-4">
          <PreencherArquivo
            tripId={id}
            esperado="despesa"
            onArquivo={(d) => setComprovante(d)}
            onLido={(r) => {
              if (r.valor != null) setDigitos(String(Math.round(r.valor * 100)));
              if (r.moeda && (MOEDAS as readonly string[]).includes(r.moeda)) setMoeda(r.moeda);
              if (r.titulo) setDescricao(r.titulo);
              if (r.categoria && CATEGORIAS.some((c) => c.id === r.categoria)) setCategoria(r.categoria);
              if (soData(r.inicio)) setDataGasto(soData(r.inicio));
              if (r.valor != null) setPasso(3);
            }}
          />
          <p className="num mt-2 text-center text-[42px] leading-none text-foreground">
            {fmtMoney(valor, moeda)}
          </p>
          <select
            aria-label="Moeda"
            value={moeda}
            onChange={(e) => setMoeda(e.target.value)}
            className="tap mx-auto mt-3 block rounded-xl border-2 border-input bg-card px-4 text-lg font-bold text-foreground"
          >
            {MOEDAS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"].map((t) => (
              <button
                key={t}
                onClick={() => tecla(t)}
                className="flex h-[72px] items-center justify-center rounded-2xl border border-border bg-card text-3xl font-bold text-foreground active:bg-muted"
              >
                {t === "del" ? <Delete size={28} strokeWidth={2.2} /> : t}
              </button>
            ))}
          </div>

          <button
            disabled={valor <= 0}
            onClick={() => setPasso(2)}
            className="gradient-hero shadow-medium tap mt-4 flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold disabled:opacity-40"
          >
            Categoria
          </button>
        </main>
      )}

      {passo === 2 && (
        <main className="px-4">
          <div className="grid grid-cols-3 gap-3">
            {CATEGORIAS.map(({ id: cid, rotulo, Icone }) => (
              <button
                key={cid}
                onClick={() => {
                  setCategoria(cid);
                  setPasso(3);
                }}
                className={`flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-2 ${
                  categoria === cid ? "border-accent bg-muted" : "border-border bg-card"
                }`}
              >
                <Icone size={28} strokeWidth={2.2} className="text-accent" />
                <span className="text-sm font-bold text-foreground">{rotulo}</span>
              </button>
            ))}
          </div>
        </main>
      )}

      {passo === 3 && (
        <main className="space-y-4 px-4">
          <p className="num text-center text-[42px] leading-none text-foreground">
            {fmtMoney(valor, moeda)}
          </p>

          {diferente && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-base font-bold text-foreground">
                Câmbio {moeda} → {trip.moeda_base}
              </p>
              <input
                inputMode="decimal"
                value={taxa}
                onChange={(e) => setTaxa(e.target.value.replace(",", "."))}
                className="tap mt-2 w-full rounded-xl border-2 border-input bg-background px-4 text-2xl font-bold text-foreground"
              />
              <p className="num mt-2 text-2xl text-foreground">
                {buscandoTaxa ? "Buscando…" : fmtMoney(valorBase, trip.moeda_base)}
              </p>
            </div>
          )}

          <input
            placeholder="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="tap w-full rounded-xl border-2 border-input bg-card px-4 text-lg text-foreground"
          />

          <label className="tap flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-border text-lg font-bold text-foreground">
            <Camera size={28} strokeWidth={2.2} />
            {comprovante ? "Comprovante anexado" : "Foto do comprovante"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => setComprovante(String(r.result));
                r.readAsDataURL(f);
              }}
            />
          </label>

          <button
            onClick={salvar}
            disabled={salvando}
            className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold"
          >
            <Check size={28} strokeWidth={2.2} />
            Confirmar
          </button>
        </main>
      )}
    </div>
  );
}
