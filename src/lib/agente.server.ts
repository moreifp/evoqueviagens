/**
 * Lógica das ferramentas do agente. Sempre com o cliente da sessão de quem chamou:
 * as permissões do banco valem igual à tela. Nada é gravado em ticket/lodging/reservation aqui —
 * só na caixa agent_inbox, como pendente.
 */
import type { z } from "zod";
import { rodarAuditor, ordenar, type Achado } from "./audit";
import { montarEntrada } from "./auditoriaEntrada";
import type { ItemRoteiro, Membro, Ticket } from "./data";
import type { HotelValores, PaxLinha, QuartoLinha, ReservaValores, VooValores, PessoaReservaLinha } from "./itens";
import type { esquemaHospedagem, esquemaReserva, esquemaVoo } from "./agente.tools";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any; rpc: (f: string, a: unknown) => any };
export type Ctx = { supabase: unknown; userId: string; origemUrl: string };

const db = (c: Ctx) => c.supabase as Db;
const uuid = () => crypto.randomUUID();
const dia = (iso: string) => iso.slice(0, 10);
const utc = (iso: string) => new Date(iso).toISOString();

export type PayloadVoo = { id: string; valores: VooValores; passageiros: PaxLinha[] };
export type PayloadHotel = { id: string; valores: HotelValores; quartos: QuartoLinha[] };
export type PayloadReserva = { id: string; valores: ReservaValores; pessoas: PessoaReservaLinha[] };
export type Resumo = { titulo: string; origem: string | null; linhas: string[]; avisos: string[] };
export type AchadoCurto = { regra_id: string; severidade: string; mensagem: string };

async function unwrap<T>(p: Promise<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

/* ── Leituras ────────────────────────────────────────────────────────────── */

export async function listarViagens(c: Ctx) {
  const rows = await unwrap<{ id: string; nome: string; destino: string | null; data_inicio: string; data_fim: string; cidades: string[]; owner_id: string; status: string }[]>(
    db(c).from("trip").select("id,nome,destino,data_inicio,data_fim,cidades,owner_id,status").is("deleted_at", null).is("arquivada_em", null).order("data_inicio"),
  );
  return rows.map((t) => ({ trip_id: t.id, nome: t.nome, destino: t.destino, data_inicio: t.data_inicio, data_fim: t.data_fim, cidades: t.cidades, organizador: t.owner_id === c.userId, status: t.status }));
}

async function membros(c: Ctx, tripId: string) {
  return unwrap<Membro[]>(db(c).rpc("membros_viagem", { _tid: tripId }));
}

export async function listarParticipantes(c: Ctx, tripId: string) {
  const l = await membros(c, tripId);
  return l.filter((m) => m.status !== "saiu").map((m) => ({ person_id: m.person_id, nome: m.nome, apelido: m.apelido, dependente: m.kind === "dependent", status: m.status, organizador: m.papel === "owner" }));
}

async function carregarViagem(c: Ctx, tripId: string) {
  const [trips, roteiro, tickets, mems] = await Promise.all([
    unwrap<{ id: string; nome: string; data_inicio: string; data_fim: string; owner_id: string }[]>(db(c).from("trip").select("id,nome,data_inicio,data_fim,owner_id").eq("id", tripId).is("deleted_at", null).limit(1)),
    unwrap<ItemRoteiro[]>(db(c).rpc("roteiro_viagem", { _tid: tripId })),
    unwrap<Ticket[]>(db(c).from("ticket").select("*, passageiros:ticket_passenger(*)").eq("trip_id", tripId).is("deleted_at", null)),
    membros(c, tripId),
  ]);
  const trip = trips[0];
  if (!trip) throw new Error("Viagem não encontrada ou sem acesso.");
  const det = tickets.map((t) => ({ ...t, passageiros: (t.passageiros ?? []).filter((p) => !p.deleted_at) }));
  return { trip, roteiro: roteiro ?? [], tickets: det, membros: mems };
}

export async function detalharViagem(c: Ctx, tripId: string) {
  const v = await carregarViagem(c, tripId);
  return {
    trip_id: v.trip.id,
    nome: v.trip.nome,
    data_inicio: v.trip.data_inicio,
    data_fim: v.trip.data_fim,
    itens: v.roteiro.map((r) => ({ tipo: r.item_tipo === "ticket" ? r.subtipo : r.item_tipo === "lodging" ? "hotel" : r.subtipo, titulo: r.titulo, inicio_utc: r.inicio_utc, inicio_tz: r.inicio_tz, fim_utc: r.fim_utc, fim_tz: r.fim_tz, cidade: r.cidade, pessoas: r.pessoas.map((p) => p.nome) })),
  };
}

const curto = (a: Achado): AchadoCurto => ({ regra_id: a.regra_id, severidade: a.severidade, mensagem: a.mensagem });

export async function rodarRevisao(c: Ctx, tripId: string) {
  const v = await carregarViagem(c, tripId);
  const { bilhetes, hospedagens, ctx } = montarEntrada(v.roteiro, v.tickets, v.membros);
  return ordenar(rodarAuditor(v.trip, bilhetes, hospedagens, ctx)).map(curto);
}

/** Auditor com os itens simulados: só devolve os achados que envolvem os itens novos. */
function simular(v: Awaited<ReturnType<typeof carregarViagem>>, novos: ItemRoteiro[], novosTickets: Ticket[]) {
  const roteiro = [...v.roteiro, ...novos].sort((a, b) => a.inicio_utc.localeCompare(b.inicio_utc));
  const { bilhetes, hospedagens, ctx } = montarEntrada(roteiro, [...v.tickets, ...novosTickets], v.membros);
  const ids = new Set(novos.map((n) => n.item_id));
  const e0 = montarEntrada(v.roteiro, v.tickets, v.membros);
  const antes = new Set(rodarAuditor(v.trip, e0.bilhetes, e0.hospedagens, e0.ctx).map((a) => a.hash_dos_dados));
  return ordenar(rodarAuditor(v.trip, bilhetes, hospedagens, ctx))
    .filter((a) => a.itens_envolvidos.some((i) => ids.has(i)) || !antes.has(a.hash_dos_dados))
    .map(curto);
}

/* ── Pessoas: casar por person_id ou nome ───────────────────────────────── */

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();

function casar(mems: Membro[], p: { person_id?: string; nome?: string }, avisos: string[]) {
  const ativos = mems.filter((m) => m.status !== "recusado" && m.status !== "saiu");
  if (p.person_id) {
    const m = ativos.find((x) => x.person_id === p.person_id);
    if (m) return m;
    avisos.push(`Pessoa ${p.person_id} não está nesta viagem · ficou de fora`);
    return null;
  }
  if (!p.nome) return null;
  const n = norm(p.nome);
  const partes = n.split(" ").filter((x) => x.length > 1);
  const acha = ativos.filter((m) => {
    const cands = [m.nome, m.apelido ?? "", m.nome_como_no_documento ?? ""].map(norm).filter(Boolean);
    return cands.some((cnd) => cnd === n || (partes.length > 1 && partes.every((pt) => cnd.split(/[ /]/).includes(pt))));
  });
  if (acha.length === 1) return acha[0]!;
  avisos.push(acha.length > 1 ? `"${p.nome}" bate com mais de uma pessoa · escolha ao confirmar` : `"${p.nome}" não está na viagem · ficou de fora`);
  return null;
}

/* ── Fuso ────────────────────────────────────────────────────────────────── */

let aeroportos: Map<string, { tz: string; cidade: string }> | null = null;
async function aeroporto(c: Ctx, iata: string | undefined) {
  if (!iata) return null;
  if (!aeroportos) {
    try {
      const r = await fetch(new URL("/data/aeroportos.json", c.origemUrl));
      const linhas = (await r.json()) as [string, string, string, string, number, number, string][];
      aeroportos = new Map(linhas.map(([i, , cidade, , , , tz]) => [i, { tz, cidade }]));
    } catch {
      return null;
    }
  }
  return aeroportos.get(iata) ?? null;
}

function offsetMin(iso: string) {
  const m = iso.match(/(Z|([+-])(\d{2}):(\d{2}))$/);
  if (!m || m[1] === "Z") return 0;
  return (m[2] === "-" ? -1 : 1) * (Number(m[3]) * 60 + Number(m[4]));
}
function offsetDoFuso(tz: string, iso: string) {
  try {
    const d = new Date(iso);
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
    return Math.round((Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - Math.floor(d.getTime() / 60000) * 60000) / 60000);
  } catch {
    return null;
  }
}
/** Fuso IANA: o enviado (se bater com o offset), senão um fuso da viagem com o mesmo offset, senão Etc/GMT±N. */
function escolherFuso(iso: string, enviado: string | undefined, daViagem: string[]) {
  const off = offsetMin(iso);
  if (enviado && offsetDoFuso(enviado, iso) === off) return enviado;
  const igual = daViagem.find((tz) => offsetDoFuso(tz, iso) === off);
  if (igual) return igual;
  if (off === 0) return "UTC";
  if (off % 60 === 0) return `Etc/GMT${off > 0 ? "-" : "+"}${Math.abs(off / 60)}`;
  return "UTC";
}

/* ── Gravação na caixa ───────────────────────────────────────────────────── */

type Entrada = { trip_id: string; idempotency_key?: string; lote_id?: string; origem_cliente?: string; origem?: { remetente?: string; assunto?: string; anexo_nome?: string; canal?: string } };

function textoOrigem(o: Entrada["origem"]) {
  if (!o) return null;
  const canal = o.canal === "whatsapp" ? "Do WhatsApp" : o.canal === "print" ? "De um print" : "De um e-mail";
  return [o.remetente ? `${canal} da ${o.remetente}` : canal, o.anexo_nome ? (/\.pdf$/i.test(o.anexo_nome) ? "PDF anexo" : "anexo") : null].filter(Boolean).join(" · ");
}

async function gravar(c: Ctx, e: Entrada, tipo: "voo" | "hotel" | "reserva", chave: string, payload: unknown, resumo: Resumo, achados: AchadoCurto[]) {
  const linha = { account_id: c.userId, trip_id: e.trip_id, tipo_alvo: tipo, payload_json: { ...(payload as object), resumo }, idempotency_key: chave, origem_cliente: e.origem_cliente ?? "claude", lote_id: e.lote_id ?? null, achados_json: achados };
  const r = await db(c).from("agent_inbox").insert(linha).select("id,status").single();
  if (!r.error) return { id: r.data.id as string, status: "pendente", repetido: false };
  if (r.error.code !== "23505") throw new Error(r.error.message);
  const ja = await unwrap<{ id: string; status: string; achados_json: AchadoCurto[] }>(db(c).from("agent_inbox").select("id,status,achados_json").eq("account_id", c.userId).eq("idempotency_key", chave).single());
  return { id: ja.id, status: ja.status, repetido: true, achados_existentes: ja.achados_json };
}

const chaveDe = (e: Entrada, auto: string, i?: number) => (e.idempotency_key ? e.idempotency_key + (i != null ? `#${i}` : "") : auto).slice(0, 240);

function frase(achados: AchadoCurto[]) {
  return achados.length ? achados.map((a) => a.mensagem) : [];
}

export async function proporVoo(c: Ctx, e: z.infer<typeof esquemaVoo>) {
  const v = await carregarViagem(c, e.trip_id);
  const avisos: string[] = [];
  const pax = e.passageiros.map((p) => ({ p, m: casar(v.membros, p, avisos) })).filter((x) => x.m);
  const grupo = e.trechos.length > 1 ? (e.localizador ?? uuid().slice(0, 8)) : null;
  const itens: { chave: string; payload: PayloadVoo; resumo: Resumo; rot: ItemRoteiro; tk: Ticket }[] = [];
  for (const [i, t] of e.trechos.entries()) {
    const ao = await aeroporto(c, t.origem_iata);
    const ad = await aeroporto(c, t.destino_iata);
    const id = uuid();
    const valores: VooValores = {
      tipo: t.tipo,
      companhia: t.companhia?.toUpperCase() || null,
      numero: t.numero || null,
      localizador: e.localizador?.toUpperCase() || null,
      grupo_reserva: grupo,
      origem_iata: t.origem_iata ?? null,
      destino_iata: t.destino_iata ?? null,
      origem_cidade: t.origem_cidade || ao?.cidade || null,
      destino_cidade: t.destino_cidade || ad?.cidade || null,
      partida_utc: utc(t.partida),
      partida_tz: ao?.tz ?? escolherFuso(t.partida, undefined, []),
      chegada_utc: utc(t.chegada),
      chegada_tz: ad?.tz ?? escolherFuso(t.chegada, undefined, []),
    };
    if (valores.chegada_utc <= valores.partida_utc) avisos.push(`Trecho ${i + 1}: a chegada está antes da partida`);
    const passageiros: PaxLinha[] = pax.map(({ p, m }) => ({ id: uuid(), person_id: m!.person_id, nome_no_bilhete: p.nome_no_bilhete || m!.nome_como_no_documento || m!.nome, assento: p.assento || null, eticket: p.eticket || null }));
    const titulo = `${valores.origem_iata ?? valores.origem_cidade ?? "?"} → ${valores.destino_iata ?? valores.destino_cidade ?? "?"}`;
    const via = [valores.companhia, valores.numero].filter(Boolean).join(" ");
    const rot: ItemRoteiro = { item_tipo: "ticket", item_id: id, subtipo: valores.tipo, titulo, inicio_utc: valores.partida_utc, inicio_tz: valores.partida_tz, fim_utc: valores.chegada_utc, fim_tz: valores.chegada_tz, cidade: valores.destino_cidade, origem_iata: valores.origem_iata, destino_iata: valores.destino_iata, companhia: valores.companhia, numero: valores.numero, pessoas: passageiros.map((p) => ({ id: p.person_id, nome: v.membros.find((m) => m.person_id === p.person_id)?.apelido || p.nome_no_bilhete || "" })), detalhe: true, editar: true };
    const tk = { ...valores, id, trip_id: e.trip_id, passageiros } as unknown as Ticket;
    itens.push({
      chave: chaveDe(e, `voo|${valores.localizador ?? ""}|${via}|${dia(t.partida)}|${valores.origem_iata ?? ""}`, e.trechos.length > 1 ? i : undefined),
      payload: { id, valores, passageiros },
      resumo: { titulo: via ? `${titulo} · ${via}` : titulo, origem: textoOrigem(e.origem), linhas: [], avisos },
      rot,
      tk,
    });
  }
  const achados = simular(v, itens.map((x) => x.rot), itens.map((x) => x.tk));
  const out = [];
  for (const x of itens) {
    out.push({ ...(await gravar(c, e, "voo", x.chave, x.payload, x.resumo, achados)), titulo: x.resumo.titulo });
  }
  return { itens: out, achados, avisos, mensagens: frase(achados) };
}

export async function proporHospedagem(c: Ctx, e: z.infer<typeof esquemaHospedagem>) {
  const v = await carregarViagem(c, e.trip_id);
  const avisos: string[] = [];
  const h = e.hotel;
  const fusos = [...new Set(v.roteiro.flatMap((r) => [r.inicio_tz, r.fim_tz]).filter((x): x is string => !!x && x !== "UTC"))];
  const tz = escolherFuso(h.checkin, h.fuso, fusos);
  const quartosIn = e.quartos.length ? e.quartos : e.hospedes.length ? [{ nome: undefined, tipo: undefined, hospedes: e.hospedes }] : [];
  const usados = new Set<string>();
  const quartos: QuartoLinha[] = quartosIn.map((q, i) => ({
    id: uuid(),
    nome: q.nome || `Quarto ${i + 1}`,
    tipo: q.tipo || null,
    hospedes: q.hospedes
      .map((p) => casar(v.membros, p, avisos))
      .filter((m): m is Membro => !!m && !usados.has(m.person_id) && !!usados.add(m.person_id))
      .map((m) => ({ id: uuid(), person_id: m.person_id })),
  }));
  const id = uuid();
  const valores: HotelValores = {
    nome: h.nome,
    endereco: h.endereco || null,
    cidade: h.cidade || null,
    telefone: h.telefone || null,
    checkin: utc(h.checkin),
    checkout: utc(h.checkout),
    localizador: h.localizador?.toUpperCase() || null,
    valor: h.valor ?? null,
    moeda: h.valor != null ? (h.moeda ?? "BRL") : null,
    politica_cancelamento: h.politica_cancelamento || null,
    cancelamento_gratis_ate: h.cancelamento_gratis_ate || null,
    lat: null,
    lng: null,
    place_id: null,
    site: h.site || null,
    tz,
  };
  if (valores.checkout <= valores.checkin) throw new Error("checkout precisa ser depois do checkin.");
  const pessoas = quartos.flatMap((q) => q.hospedes.map((g) => g.person_id));
  const rot: ItemRoteiro = { item_tipo: "lodging", item_id: id, subtipo: "hotel", titulo: valores.nome, inicio_utc: valores.checkin, inicio_tz: "UTC", fim_utc: valores.checkout, fim_tz: "UTC", cidade: valores.cidade, origem_iata: null, destino_iata: null, companhia: null, numero: null, pessoas: pessoas.map((p) => ({ id: p, nome: v.membros.find((m) => m.person_id === p)?.apelido || "" })), detalhe: true, editar: true };
  const achados = simular(v, [rot], []);
  const resumo: Resumo = { titulo: valores.nome, origem: textoOrigem(e.origem), linhas: [], avisos };
  const g = await gravar(c, e, "hotel", chaveDe(e, `hotel|${valores.localizador ?? norm(valores.nome)}|${dia(h.checkin)}`), { id, valores, quartos }, resumo, achados);
  return { ...g, titulo: valores.nome, achados, avisos, mensagens: frase(achados) };
}

export async function proporReserva(c: Ctx, e: z.infer<typeof esquemaReserva>) {
  const v = await carregarViagem(c, e.trip_id);
  const avisos: string[] = [];
  const fusos = [...new Set(v.roteiro.flatMap((r) => [r.inicio_tz, r.fim_tz]).filter((x): x is string => !!x && x !== "UTC"))];
  const tz = escolherFuso(e.inicio, e.fuso, fusos);
  const vistos = new Set<string>();
  const pessoas: PessoaReservaLinha[] = e.pessoas
    .map((p) => ({ p, m: casar(v.membros, p, avisos) }))
    .filter((x) => x.m && !vistos.has(x.m.person_id) && !!vistos.add(x.m.person_id))
    .map(({ p, m }) => ({ id: uuid(), person_id: m!.person_id, papel: p.papel || null }));
  const id = uuid();
  const valores: ReservaValores = {
    tipo: e.tipo,
    titulo: e.titulo,
    inicio_utc: utc(e.inicio),
    inicio_tz: tz,
    fim_utc: e.fim ? utc(e.fim) : null,
    fim_tz: e.fim ? tz : null,
    local: e.local || null,
    telefone: null,
    cidade: e.cidade || null,
    localizador: e.localizador || null,
    valor: e.valor ?? null,
    moeda: e.valor != null ? (e.moeda ?? "BRL") : null,
    lat: null,
    lng: null,
    place_id: null,
    site: null,
  };
  const rot: ItemRoteiro = { item_tipo: "reservation", item_id: id, subtipo: e.tipo, titulo: e.titulo, inicio_utc: valores.inicio_utc, inicio_tz: tz, fim_utc: valores.fim_utc, fim_tz: valores.fim_tz, cidade: valores.cidade, origem_iata: null, destino_iata: null, companhia: null, numero: null, pessoas: [], detalhe: true, editar: true };
  const achados = simular(v, [rot], []);
  const resumo: Resumo = { titulo: e.titulo, origem: textoOrigem(e.origem), linhas: [], avisos };
  const g = await gravar(c, e, "reserva", chaveDe(e, `reserva|${e.tipo}|${valores.localizador ?? norm(e.titulo)}|${dia(e.inicio)}`), { id, valores, pessoas }, resumo, achados);
  return { ...g, titulo: e.titulo, achados, avisos, mensagens: frase(achados) };
}
