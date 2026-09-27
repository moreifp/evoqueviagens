import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Plane } from "lucide-react";
import { Button } from "./ui/button";
import { mesAno, resumirValidades, type ItemValidade, type TomValidade } from "@/lib/validades";
import type { EuDocumento, EuPessoa } from "@/lib/eu";
import { NaoMostrar, useEscondidos } from "@/lib/escondidos";

const chaveDoc = (item: ItemValidade) => `doc:${item.doc.id}`;
const impressaoDoc = (item: ItemValidade) => `${item.doc.validade ?? ""}|${item.tom}`;

type ViagemResumo = { id: string; destino: string; data: string; atencao: number };
type DependenteResumo = { pessoa: EuPessoa; documentos: EuDocumento[] };
type Props = { personId: string; documentos: EuDocumento[]; owner: boolean; viagem?: ViagemResumo | null; dependentes?: DependenteResumo[] };

const tons: Record<TomValidade, { ponto: string; barra: string; texto: string }> = {
  danger: { ponto: "bg-danger", barra: "bg-danger", texto: "Atenção urgente" },
  warn: { ponto: "bg-warn", barra: "bg-warn", texto: "Pede atenção" },
  ok: { ponto: "bg-ok", barra: "bg-ok", texto: "Em ordem" },
  muted: { ponto: "bg-muted-foreground", barra: "bg-muted-foreground", texto: "Sem data" },
};

function dataCurta(iso: string) {
  const [ano = 0, mes = 1, dia = 1] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(ano, mes - 1, dia)));
}

function LinhaDocumento({ item, personId, escondivel }: { item: ItemValidade; personId: string; escondivel: boolean }) {
  const t = tons[item.tom];
  return <div className="border-b border-border last:border-0"><Link to="/pessoas/$pid/documentos/$did" params={{ pid: personId, did: item.doc.id }} className="tap grid grid-cols-[12px_1fr_auto] items-center gap-x-3 py-3">
    <span className={`h-3 w-3 rounded-full ${t.ponto}`} aria-hidden />
    <span className="min-w-0">
      <strong className="block truncate text-lg text-foreground">{item.nome}</strong>
      <span className="block text-base text-muted-foreground">{item.dataTexto}</span>
      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${item.nome}: ${t.texto}, ${item.prazo}`}>
        <span className={`block h-full rounded-full ${t.barra}`} style={{ width: `${item.progresso}%` }} />
      </span>
    </span>
    <span className="max-w-24 text-right text-base font-bold text-foreground">{item.prazo}</span>
  </Link>{escondivel && <NaoMostrar className="-mt-2 mb-1 ml-6" chave={chaveDoc(item)} impressao={impressaoDoc(item)} rotulo={`${item.nome}: ${item.dataTexto}`} contexto={personId} critico={item.tom === "danger" && item.doc.tipo === "passaporte"} />}</div>;
}

export function EmOrdem({ personId, documentos, owner, viagem, dependentes = [] }: Props) {
  const bruto = resumirValidades(documentos);
  const { oculto } = useEscondidos();
  const escondido = (i: ItemValidade) => oculto(chaveDoc(i), impressaoDoc(i));
  const alertasVis = bruto.alertas.filter((i) => !escondido(i));
  const resumo = { ...bruto, alertas: alertasVis, tom: (alertasVis.some((i) => i.tom === "danger") ? "danger" : alertasVis.length ? "warn" : "ok") as TomValidade };
  const chave = `evoque-em-ordem-aberto-${personId}`;
  const temAlerta = resumo.alertas.length > 0;
  const [aberto, setAberto] = useState(temAlerta);
  useEffect(() => {
    const salvo = localStorage.getItem(chave);
    setAberto(salvo === null ? temAlerta : salvo === "1");
  }, [chave, temAlerta]);
  if (!resumo.itens.length) return null;

  const principal = resumo.alertas[0];
  const titulo = resumo.alertas.length > 1 ? `${resumo.alertas.length} coisas para olhar` : principal ? `${principal.nome} ${principal.tom === "danger" && principal.venceEmDias != null && principal.venceEmDias < 0 ? "está vencido" : `vence em ${principal.prazo}`}` : "Tudo em ordem";
  const subtitulo = principal?.doc.validade
    ? `${principal.doc.validade.split("-").reverse().join("/")} · ${principal.tom === "danger" && (principal.venceEmDias ?? 0) < 0 ? "atualize antes de viajar" : "renove com antecedência"}`
    : resumo.proximo ? `Próximo vencimento: ${resumo.proximo.nome} em ${mesAno(resumo.proximo.doc.validade ?? "")}` : "Documentos cadastrados sem vencimento próximo";
  const selo = resumo.tom === "danger" ? "border-danger/50 bg-validity-danger" : resumo.tom === "warn" ? "border-validity-warn-border bg-validity-warn" : "border-validity-ok-border bg-validity-ok";
  const icon = resumo.tom === "danger" ? "bg-danger text-danger-foreground" : resumo.tom === "warn" ? "bg-warn text-warn-foreground" : "bg-ok text-ok-foreground";

  function alternar() {
    const proximo = !aberto;
    setAberto(proximo);
    localStorage.setItem(chave, proximo ? "1" : "0");
  }

  return <section aria-label="Resumo das validades" className="space-y-3">
    <button type="button" onClick={alternar} aria-expanded={aberto} className={`tap flex w-full items-center gap-3 rounded-[20px] border p-4 text-left ${selo}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${icon}`}>{temAlerta ? <AlertTriangle size={24} aria-hidden /> : <Check size={25} aria-hidden />}</span>
      <span className="min-w-0 flex-1"><strong className="font-display block text-[19px] text-foreground">{titulo}</strong><span className="mt-0.5 block text-base text-muted-foreground">{subtitulo}</span></span>
      <ChevronDown size={26} className={`shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
    </button>

    {aberto && <div className="shadow-soft overflow-hidden rounded-[20px] border border-border bg-card px-4">
      {temAlerta && <div className="flex gap-2 overflow-x-auto border-b border-border py-3">{resumo.itens.filter((i) => i.tom === "ok").map((i) => <span key={i.doc.id} className="shrink-0 rounded-full bg-muted px-3 py-1 text-base font-bold text-foreground"><span className="text-ok">●</span> {i.nome} {i.doc.validade ? i.doc.validade.slice(0, 4) : "ok"}</span>)}</div>}
      {resumo.itens.map((item) => <LinhaDocumento key={item.doc.id} item={item} personId={personId} escondivel={owner && (item.tom === "danger" || item.tom === "warn") && !escondido(item)} />)}
      {owner && principal && <Button asChild className="my-4 min-h-14 w-full text-lg"><Link to="/pessoas/$pid/documentos/$did" params={{ pid: personId, did: principal.doc.id }}>Atualizar {principal.nome}</Link></Button>}
      {viagem && <Link to="/trip/$id/revisao" params={{ id: viagem.id }} className="tap flex items-center gap-3 border-t border-border py-3"><Plane size={25} className="shrink-0 text-accent" /><span className="min-w-0 flex-1 text-base text-foreground"><strong>{viagem.destino} · {dataCurta(viagem.data)}</strong> — {viagem.atencao ? `${viagem.atencao} ${viagem.atencao === 1 ? "documento pede" : "documentos pedem"} atenção` : "seus documentos servem para essa viagem"}</span><ChevronDown size={24} className="-rotate-90" /></Link>}
      {dependentes.map(({ pessoa, documentos: docs }) => {
        const r = resumirValidades(docs);
        const faltaPassaporte = !docs.some((d) => d.tipo === "passaporte");
        const pior = r.alertas[0];
        const texto = faltaPassaporte ? "falta o passaporte" : pior ? `${pior.nome.toLowerCase()} ${pior.tom === "danger" ? "pede atenção agora" : "vence em breve"}` : "tudo certo";
        return <Link key={pessoa.id} to="/pessoas/$pid" params={{ pid: pessoa.id }} className="tap flex items-center gap-3 border-t border-border py-3"><span className={`h-3 w-3 shrink-0 rounded-full ${faltaPassaporte || pior ? "bg-warn" : "bg-ok"}`} aria-hidden /><span className="flex-1 text-lg font-bold text-foreground">{pessoa.apelido || pessoa.nome} · <span className="font-normal">{texto}</span></span><ChevronDown size={24} className="-rotate-90" /></Link>;
      })}
    </div>}
  </section>;
}