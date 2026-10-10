import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  BedDouble,
  Camera,
  Car,
  ClipboardPaste,
  FileUp,
  Loader2,
  Plane,
  Sparkles,
  Ticket,
  TrainFront,
  Utensils,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { lerTudo, type Leitura } from "@/lib/reserva-ai.functions";
import { textoDoEml } from "@/lib/emailAgencia";
import { dataUrlParaIA } from "@/lib/imagem";
import { membersQuery } from "@/lib/data";
import { casarPessoa } from "@/components/PreencherArquivo";
import { aviso, enviar, montarOpsHotel, montarOpsReserva, montarOpsVoo, novoId } from "@/lib/itens";
import { localParaUtc } from "@/lib/fuso";
import { dataLocal } from "@/lib/importAnexo";
import { carregarAeroportos, porIata } from "@/lib/aeroportos";
import { pegarBagagem } from "@/lib/bagagem";
import { fusoLocal } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { mutar, type Op } from "@/lib/outbox";

export const Route = createFileRoute("/trip/$id/adicionar")({
  head: () => ({
    meta: [
      { title: "Adicionar — Viagens Organizadas" },
      {
        name: "description",
        content: "Cole ou fotografe a reserva: lemos voos, hotel, trem e carro de uma vez.",
      },
      { property: "og:title", content: "Adicionar à viagem" },
      {
        property: "og:description",
        content: "Cole ou fotografe a reserva e salve tudo de uma vez.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Adicionar,
});

const TIPOS = [
  { rotulo: "Voo", Icone: Plane, path: "bilhetes/novo", cor: "voos" },
  { rotulo: "Hotel", Icone: BedDouble, path: "hospedagem/nova", cor: "hosp" },
  { rotulo: "Trem", Icone: TrainFront, path: "bilhetes/novo", cor: "voos" },
  { rotulo: "Carro", Icone: Car, path: "reservas/nova", cor: "reserva" },
  { rotulo: "Passeio", Icone: Ticket, path: "reservas/nova", cor: "reserva" },
  { rotulo: "Restaurante", Icone: Utensils, path: "reservas/nova", cor: "desp" },
] as const;
const COR: Record<string, string> = {
  voos: "bg-voos-soft border-voos-border text-voos",
  hosp: "bg-hosp-soft border-hosp-border text-hosp",
  reserva: "bg-reserva-soft border-reserva-border text-reserva",
  desp: "bg-desp-soft border-desp-border text-desp",
};

const MIDIA = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
type Mime = (typeof MIDIA)[number];
type Original = { nome: string; mime: string; data: string };
const TRANSPORTE = ["voo", "trem", "onibus"];
const NOME_TIPO: Record<string, string> = {
  voo: "Voo",
  trem: "Trem",
  onibus: "Ônibus",
  hotel: "Hotel",
  carro: "Carro",
  passeio: "Passeio",
  restaurante: "Restaurante",
  outro: "Reserva",
};
const ICONE_TIPO: Record<string, typeof Plane> = {
  voo: Plane,
  trem: TrainFront,
  onibus: TrainFront,
  hotel: BedDouble,
  carro: Car,
  passeio: Ticket,
  restaurante: Utensils,
  outro: Ticket,
};

function lerDataUrl(f: Blob) {
  return new Promise<string>((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => erro(new Error("Não consegui abrir o arquivo."));
    r.readAsDataURL(f);
  });
}
const dm = (v: string | null) => {
  const d = dataLocal(v);
  return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}${d.length > 10 ? ` ${d.slice(11, 16)}` : ""}` : "";
};
function resumo(i: Leitura) {
  if (TRANSPORTE.includes(i.tipo))
    return [
      `${i.origem_iata ?? i.origem_cidade ?? "?"} → ${i.destino_iata ?? i.destino_cidade ?? "?"}`,
      [i.companhia, i.numero].filter(Boolean).join(" "),
      dm(i.inicio),
    ]
      .filter(Boolean)
      .join(" · ");
  return [i.titulo ?? NOME_TIPO[i.tipo], dm(i.inicio)].filter(Boolean).join(" · ");
}

function Adicionar() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ler = useServerFn(lerTudo);
  const { data: membros = [] } = useQuery(membersQuery(id));
  const foto = useRef<HTMLInputElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [caixa, setCaixa] = useState(false);
  const [texto, setTexto] = useState("");
  const [itens, setItens] = useState<Leitura[] | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [original, setOriginal] = useState<Original | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function analisar(entrada: { texto?: string; arq?: File }) {
    if (lendo) return;
    setLendo(true);
    try {
      let t: string | null = entrada.texto?.trim() || null,
        dado: string | null = null,
        mime: Mime | null = null,
        nome: string | null = null;
      let o: Original | null = null;
      const arq = entrada.arq;
      if (arq) {
        nome = arq.name;
        if (/\.eml$/i.test(arq.name) || arq.type === "message/rfc822") {
          t = textoDoEml(await arq.text());
          o = { nome: arq.name, mime: "message/rfc822", data: await lerDataUrl(arq) };
        } else if ((MIDIA as readonly string[]).includes(arq.type)) {
          dado = await lerDataUrl(arq);
          mime = arq.type as Mime;
          o = { nome: arq.name, mime: arq.type, data: dado };
          // Foto vai reduzida para a leitura (≤ 1568 px); o original fica como anexo.
          const menor = mime !== "application/pdf" ? await dataUrlParaIA(arq) : null;
          if (menor) [dado, mime] = [menor, "image/jpeg"];
        } else if (arq.type.startsWith("text/")) {
          t = await arq.text();
        } else throw new Error("Use uma foto, um PDF ou um e-mail (.eml).");
      }
      if (!t && !dado) throw new Error("Nada para ler.");
      const r = await ler({ data: { texto: t, arquivo: dado, nome, mime } });
      if (!r.itens.length) throw new Error("Não achei reservas. Escolha o tipo abaixo.");
      setItens(r.itens);
      setMarcados(new Set(r.itens.map((_, i) => i)));
      setOriginal(o);
      setCaixa(false);
      setTexto("");
    } catch (e) {
      toast.error((e as Error).message || "Não consegui ler.");
    } finally {
      setLendo(false);
    }
  }

  async function colar() {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) return void analisar({ texto: t });
    } catch {
      /* iOS pode negar */
    }
    setCaixa(true);
  }

  async function salvar() {
    if (!itens) return;
    const escolhidos = itens.filter((_, i) => marcados.has(i));
    if (!escolhidos.length) return;
    setSalvando(true);
    const aero = await carregarAeroportos().catch(() => []);
    const ops: Op[] = [];
    const salvos: { tipo: "ticket" | "lodging" | "reservation"; id: string }[] = [];
    const chegadas: { quando: string; tz: string }[] = [];
    const pid = (nome: string, usados: Set<string>) => casarPessoa(nome, membros, usados);
    for (const it of escolhidos.filter((x) => TRANSPORTE.includes(x.tipo))) {
      const oi = (it.origem_iata ?? "").toUpperCase().slice(0, 3),
        di = (it.destino_iata ?? "").toUpperCase().slice(0, 3);
      const a = oi ? porIata(aero, oi) : undefined,
        b = di ? porIata(aero, di) : undefined;
      const partida = dataLocal(it.inicio),
        chegada = dataLocal(it.fim) || partida;
      if (!partida) continue;
      const ptz = a?.tz ?? fusoLocal(),
        ctz = b?.tz ?? ptz;
      const bag = pegarBagagem(it.bagagem);
      const usados = new Set<string>();
      const pax = it.passageiros.flatMap((p) => {
        const x = pid(p.nome, usados);
        if (!x) return [];
        usados.add(x);
        return [
          {
            id: novoId(),
            person_id: x,
            nome_no_bilhete: p.nome.toUpperCase(),
            assento: p.assento,
            eticket: p.eticket,
            ...bag,
          },
        ];
      });
      const tid = novoId();
      ops.push(
        ...montarOpsVoo({
          tripId: id,
          id: tid,
          passageiros: pax,
          valores: {
            tipo: it.tipo,
            companhia: it.companhia,
            numero: it.numero,
            localizador: it.localizador,
            grupo_reserva: null,
            origem_iata: oi || null,
            destino_iata: di || null,
            origem_cidade: it.origem_cidade ?? a?.cidade ?? null,
            destino_cidade: it.destino_cidade ?? b?.cidade ?? null,
            partida_utc: localParaUtc(partida, ptz),
            partida_tz: ptz,
            chegada_utc: localParaUtc(chegada, ctz),
            chegada_tz: ctz,
            ...bag,
          },
        }),
      );
      salvos.push({ tipo: "ticket", id: tid });
      chegadas.push({ quando: chegada, tz: ctz });
    }
    chegadas.sort((x, y) => x.quando.localeCompare(y.quando));
    const tzPara = (ini: string) =>
      [...chegadas].reverse().find((c) => c.quando <= ini)?.tz ?? fusoLocal();
    for (const it of escolhidos.filter((x) => !TRANSPORTE.includes(x.tipo))) {
      const ini = dataLocal(it.inicio);
      if (!ini) continue;
      const tz = tzPara(ini);
      const fim = dataLocal(it.fim);
      const nid = novoId();
      if (it.tipo === "hotel") {
        const usados = new Set<string>();
        ops.push(
          ...montarOpsHotel({
            tripId: id,
            id: nid,
            valores: {
              nome: it.titulo ?? "Hotel",
              endereco: it.local,
              cidade: it.cidade,
              checkin: localParaUtc(ini.length > 10 ? ini : `${ini}T15:00`, tz),
              checkout: localParaUtc(
                fim ? (fim.length > 10 ? fim : `${fim}T11:00`) : `${ini.slice(0, 10)}T23:00`,
                tz,
              ),
              localizador: it.localizador,
              telefone: null,
              valor: it.valor,
              moeda: it.moeda,
              politica_cancelamento: it.politica_cancelamento,
              cancelamento_gratis_ate: it.cancelamento_gratis_ate?.slice(0, 10) ?? null,
              lat: null,
              lng: null,
              place_id: null,
              site: null,
              tz,
            },
            quartos: it.quartos.map((q) => ({
              id: novoId(),
              nome: q.nome,
              tipo: q.tipo,
              hospedes: q.hospedes.flatMap((h) => {
                const x = pid(h, usados);
                if (!x) return [];
                usados.add(x);
                return [{ id: novoId(), person_id: x }];
              }),
            })),
          }),
        );
        salvos.push({ tipo: "lodging", id: nid });
      } else {
        const usados = new Set<string>();
        ops.push(
          ...montarOpsReserva({
            tripId: id,
            id: nid,
            valores: {
              tipo: ["carro", "passeio", "restaurante"].includes(it.tipo) ? it.tipo : "outro",
              titulo: it.titulo ?? NOME_TIPO[it.tipo] ?? "Reserva",
              inicio_utc: localParaUtc(ini.length > 10 ? ini : `${ini}T09:00`, tz),
              inicio_tz: tz,
              fim_utc: fim ? localParaUtc(fim.length > 10 ? fim : `${fim}T18:00`, tz) : null,
              fim_tz: fim ? tz : null,
              local: it.local,
              telefone: null,
              cidade: it.cidade,
              localizador: it.localizador,
              valor: it.valor,
              moeda: it.moeda,
              lat: null,
              lng: null,
              place_id: null,
              site: null,
            },
            pessoas: it.pessoas.flatMap((n) => {
              const x = pid(n, usados);
              if (!x) return [];
              usados.add(x);
              return [{ id: novoId(), person_id: x, papel: null }];
            }),
          }),
        );
        salvos.push({ tipo: "reservation", id: nid });
      }
    }
    if (!salvos.length) {
      setSalvando(false);
      return toast.error("Faltam datas nos itens lidos. Escolha o tipo e preencha.");
    }
    try {
      const r = await enviar(ops);
      if (original && navigator.onLine) {
        try {
          const blob = await (await fetch(original.data)).blob();
          const path = `trip/${id}/${salvos[0]!.id}/${novoId()}-privado-${original.nome.replace(/[^\w.-]+/g, "_").slice(-80)}`;
          const up = await supabase.storage
            .from("documentos")
            .upload(path, blob, { contentType: original.mime || blob.type });
          if (up.error) throw new Error(up.error.message);
          for (const s of salvos)
            await mutar({
              tipo: "insert",
              tabela: "item_attachment",
              valores: {
                id: novoId(),
                item_tipo: s.tipo,
                item_id: s.id,
                storage_path: path,
                nome: `🔒 Reserva original (só organizador) · ${original.nome}`,
                content_type: original.mime || blob.type,
                size_bytes: blob.size,
                privado: true,
              },
            });
        } catch (e) {
          toast.error(`Itens salvos, mas o arquivo original não subiu: ${(e as Error).message}`);
        }
      }
      toast.success(
        aviso(r, `${salvos.length} ${salvos.length === 1 ? "item salvo" : "itens salvos"}`),
      );
      for (const k of ["tickets", "lodgings", "reservas", "roteiro", "pontos", "anexos"])
        void qc.invalidateQueries({ queryKey: [k, id] });
      navigate({ to: "/trip/$id", params: { id } });
    } catch (e) {
      toast.error((e as Error).message || "Não deu para salvar.");
      setSalvando(false);
    }
  }

  const n = marcados.size;
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-background pb-8">
      <header className="flex items-center gap-3 p-4">
        <h1 className="flex-1 text-3xl">Adicionar</h1>
        <Link
          to="/trip/$id"
          params={{ id }}
          aria-label="Fechar"
          className="tap flex items-center justify-center"
        >
          <X size={34} />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4">
        {!itens ? (
          <section className="gradient-hero shadow-medium rounded-3xl p-5">
            <h2 className="text-2xl leading-tight">
              {lendo ? "Lendo a reserva…" : "Colar ou fotografar a reserva"}
            </h2>
            <p className="mt-1 text-lg opacity-90">
              Voos, hotel, trem, carro: lemos tudo de uma vez
            </p>
            {lendo ? (
              <p className="mt-4 flex items-center gap-2 text-lg font-bold">
                <Loader2 className="animate-spin" size={26} /> Isso leva alguns segundos
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void colar()}
                  className="tap flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-2xl bg-white/15 text-base font-bold"
                >
                  <ClipboardPaste size={30} /> Colar
                </button>
                <button
                  type="button"
                  onClick={() => foto.current?.click()}
                  className="tap flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-2xl bg-white/15 text-base font-bold"
                >
                  <Camera size={30} /> Foto
                </button>
                <button
                  type="button"
                  onClick={() => arquivo.current?.click()}
                  className="tap flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-2xl bg-white/15 text-sm font-bold"
                >
                  <FileUp size={30} /> PDF/arquivo
                </button>
              </div>
            )}
            <input
              ref={foto}
              hidden
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void analisar({ arq: f });
              }}
            />
            <input
              ref={arquivo}
              hidden
              type="file"
              accept=".pdf,.eml,application/pdf,message/rfc822,image/*,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void analisar({ arq: f });
              }}
            />
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="text-2xl">
              Achamos {itens.length} {itens.length === 1 ? "item" : "itens"}
            </h2>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {itens.map((it, i) => {
                const Icone = ICONE_TIPO[it.tipo] ?? Ticket;
                const on = marcados.has(i);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setMarcados((s) => {
                          const x = new Set(s);
                          if (x.has(i)) x.delete(i);
                          else x.add(i);
                          return x;
                        })
                      }
                      className="tap flex w-full items-center gap-3 px-4 py-2 text-left"
                    >
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
                      >
                        {on && <Check size={20} strokeWidth={3} />}
                      </span>
                      <Icone size={26} className="shrink-0 text-accent" />
                      <span className="min-w-0 flex-1">
                        <strong className="block text-lg">{NOME_TIPO[it.tipo] ?? "Reserva"}</strong>
                        <span className="block truncate text-base text-muted-foreground">
                          {resumo(it)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              disabled={!n || salvando}
              onClick={() => void salvar()}
              className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
            >
              {salvando ? <Loader2 className="animate-spin" /> : <Check size={24} />} Salvar{" "}
              {n === itens.length ? `os ${n}` : n}
            </button>
            <button
              type="button"
              onClick={() => setItens(null)}
              className="tap w-full text-lg font-bold text-accent"
            >
              Ler outra reserva
            </button>
          </section>
        )}

        {caixa && !itens && (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={6}
              placeholder="Cole aqui o e-mail ou a mensagem"
              className="w-full rounded-2xl border-2 border-input bg-card p-4 text-lg"
            />
            <button
              type="button"
              disabled={!texto.trim() || lendo}
              onClick={() => void analisar({ texto })}
              className="tap w-full rounded-2xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
            >
              Ler
            </button>
          </div>
        )}

        <section>
          <h2 className="mb-3 text-lg font-bold text-muted-foreground">Ou escolha o tipo</h2>
          <div className="grid grid-cols-3 gap-3">
            {TIPOS.map(({ rotulo, Icone, path, cor }) => (
              <Link
                key={rotulo}
                to={`/trip/$id/${path}` as never}
                params={{ id } as never}
                className={`novo-cor tap flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border ${COR[cor]}`}
              >
                <Icone size={30} strokeWidth={2.2} className="novo-cor-icone" />
                <strong className="text-base text-foreground">{rotulo}</strong>
              </Link>
            ))}
          </div>
        </section>

        <Link
          to="/trip/$id/claude"
          params={{ id }}
          className="tap flex items-center justify-center gap-2 text-base font-bold text-muted-foreground"
        >
          <Sparkles size={20} /> Pelo Claude
        </Link>
      </main>
    </div>
  );
}
