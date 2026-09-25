import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Trip = {
  id: string;
  owner_id: string;
  nome: string;
  destino: string | null;
  cidades: string[];
  data_inicio: string;
  data_fim: string;
  moeda_base: string;
  status: string;
  capa_url: string | null;
  arquivada_em: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type Ticket = {
  id: string;
  trip_id: string;
  tipo: string;
  companhia: string | null;
  numero: string | null;
  localizador: string | null;
  origem_iata: string | null;
  destino_iata: string | null;
  origem_cidade: string | null;
  destino_cidade: string | null;
  partida_utc: string;
  partida_tz: string;
  chegada_utc: string;
  chegada_tz: string;
  assento: string | null;
  nome_no_bilhete: string | null;
  anexo_url: string | null;
  criado_por: string | null;
  grupo_reserva: string | null;
  expense_id: string | null;
  bag_mao_qtd?: number | null; bag_mao_kg?: number | null; item_pessoal?: boolean | null; bag_desp_qtd?: number | null; bag_desp_kg?: number | null;
  passageiros: Passageiro[];
};

export type Passageiro = {
  id: string;
  ticket_id: string;
  person_id: string;
  nome_no_bilhete: string | null;
  assento: string | null;
  eticket: string | null;
  loyalty_account_id: string | null;
  bag_mao_qtd?: number | null; bag_mao_kg?: number | null; item_pessoal?: boolean | null; bag_desp_qtd?: number | null; bag_desp_kg?: number | null;
  deleted_at?: string | null;
};

export type Hospede = { id: string; room_id: string; person_id: string; deleted_at?: string | null };
export type Quarto = { id: string; lodging_id: string; nome: string; tipo: string | null; deleted_at?: string | null; hospedes: Hospede[] };

export type Reserva = {
  id: string;
  trip_id: string;
  tipo: "carro" | "passeio" | "restaurante" | "outro";
  titulo: string;
  inicio_utc: string;
  inicio_tz: string;
  fim_utc: string | null;
  fim_tz: string | null;
  local: string | null;
  cidade: string | null;
  localizador: string | null;
  valor: number | null;
  moeda: string | null;
  criado_por: string | null;
  expense_id: string | null;
  lat?: number | null;
  lng?: number | null;
  place_id?: string | null;
  site?: string | null;
  pessoas: { id: string; reservation_id: string; person_id: string; papel: string | null; deleted_at?: string | null }[];
};

export type ItemRoteiro = {
  item_tipo: "ticket" | "lodging" | "reservation";
  item_id: string;
  subtipo: string;
  titulo: string;
  inicio_utc: string;
  inicio_tz: string;
  fim_utc: string | null;
  fim_tz: string | null;
  cidade: string | null;
  origem_iata: string | null;
  destino_iata: string | null;
  companhia: string | null;
  numero: string | null;
  pessoas: { id: string; nome: string; papel?: string | null }[];
  detalhe: boolean;
  editar: boolean;
};

export type Anexo = {
  id: string;
  item_tipo: "ticket" | "lodging" | "reservation";
  item_id: string;
  storage_path: string;
  nome: string;
  content_type: string;
  size_bytes: number;
};

export type Lodging = {
  id: string;
  trip_id: string;
  nome: string;
  endereco: string | null;
  cidade: string | null;
  checkin: string;
  checkout: string;
  localizador: string | null;
  valor: number | null;
  moeda: string | null;
  politica_cancelamento: string | null;
  cancelamento_gratis_ate: string | null;
  anexo_url: string | null;
  criado_por: string | null;
  expense_id: string | null;
  lat?: number | null;
  lng?: number | null;
  place_id?: string | null;
  site?: string | null;
  tz?: string | null;
  quartos: Quarto[];
};

export type Expense = {
  id: string;
  trip_id: string;
  descricao: string;
  categoria: string;
  data: string;
  valor_original: number;
  moeda_original: string;
  taxa_cambio: number;
  valor_moeda_base: number;
  pago_por: string | null;
  comprovante_url: string | null;
};

export type ConferenciaNome = { person_id: string; estado: "confere" | "sem_passaporte" | "sem_acesso" | "conferir" };

export type Person = {
  id: string;
  account_id?: string | null;
  kind?: string;
  apelido?: string | null;
  nome: string;
  nome_como_no_documento: string | null;
  nacionalidades: string[];
  data_nascimento: string | null;
};

export type Membro = { id: string; person_id: string; papel: string; status: string; nome: string; apelido: string | null; nome_como_no_documento: string | null; kind: string; meu: boolean };

export type Finding = {
  id: string;
  trip_id: string;
  regra_id: string;
  severidade: string;
  mensagem: string;
  hash_dos_dados: string;
  dispensado_em: string | null;
};

const db = supabase as unknown as {
  from: (t: string) => any;
};

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as T;
}

export const tripsQuery = () =>
  queryOptions({
    queryKey: ["trips"],
    queryFn: () =>
      unwrap<Trip[]>(
        db.from("trip").select("*").is("deleted_at", null).order("data_inicio", { ascending: true }),
      ),
  });

export const tripQuery = (id: string) =>
  queryOptions({
    queryKey: ["trip", id],
    queryFn: async () => {
      const rows = await unwrap<Trip[]>(db.from("trip").select("*").eq("id", id).limit(1));
      if (!rows[0]) throw new Error("Viagem não encontrada");
      return rows[0];
    },
  });

export const ticketsQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["tickets", tripId],
    queryFn: () =>
      unwrap<Ticket[]>(
        db
          .from("ticket")
          .select("*, passageiros:ticket_passenger(*)")
          .eq("trip_id", tripId)
          .is("deleted_at", null)
          .order("partida_utc", { ascending: true }),
      ).then((l) => l.map((t) => ({ ...t, passageiros: (t.passageiros ?? []).filter((p) => !p.deleted_at) }))),
  });

export const lodgingsQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["lodgings", tripId],
    queryFn: () =>
      unwrap<Lodging[]>(
        db
          .from("lodging")
          .select("*, quartos:lodging_room(*, hospedes:lodging_guest(*))")
          .eq("trip_id", tripId)
          .is("deleted_at", null)
          .order("checkin", { ascending: true }),
      ).then((l) =>
        l.map((h) => ({
          ...h,
          quartos: (h.quartos ?? []).filter((q) => !q.deleted_at).map((q) => ({ ...q, hospedes: (q.hospedes ?? []).filter((g) => !g.deleted_at) })),
        })),
      ),
  });

export const reservasQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["reservas", tripId],
    queryFn: () =>
      unwrap<Reserva[]>(
        db.from("reservation").select("*, pessoas:reservation_person(*)").eq("trip_id", tripId).is("deleted_at", null).order("inicio_utc", { ascending: true }),
      ).then((l) => l.map((r) => ({ ...r, pessoas: (r.pessoas ?? []).filter((p) => !p.deleted_at) }))),
  });

/** Roteiro para todos os membros: resumo sem localizador, assento, valor nem anexo. */
export type PontoViagem = { item_tipo: "lodging" | "reservation"; item_id: string; titulo: string; inicio_utc: string; tz: string; lat: number | null; lng: number | null; place_id: string | null };

export const pontosQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["pontos", tripId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { rpc: (f: string, a: unknown) => Promise<{ data: PontoViagem[] | null; error: { message: string } | null }> }).rpc("pontos_viagem", { _tid: tripId });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const roteiroQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["roteiro", tripId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { rpc: (f: string, a: unknown) => Promise<{ data: ItemRoteiro[] | null; error: { message: string } | null }> }).rpc("roteiro_viagem", { _tid: tripId });
      if (error) throw new Error(error.message);
      return (data ?? []).sort((a, b) => a.inicio_utc.localeCompare(b.inicio_utc));
    },
  });

/** Anexos dos itens que a pessoa pode ver (a regra de acesso fica no banco). */
export const anexosQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["anexos", tripId],
    queryFn: async () => {
      const [t, l, r] = await Promise.all([
        unwrap<{ id: string }[]>(db.from("ticket").select("id").eq("trip_id", tripId)),
        unwrap<{ id: string }[]>(db.from("lodging").select("id").eq("trip_id", tripId)),
        unwrap<{ id: string }[]>(db.from("reservation").select("id").eq("trip_id", tripId)),
      ]);
      const ids = [...t, ...l, ...r].map((x) => x.id);
      if (!ids.length) return [] as Anexo[];
      return unwrap<Anexo[]>(db.from("item_attachment").select("*").in("item_id", ids).is("deleted_at", null).order("created_at"));
    },
  });

export const expensesQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["expenses", tripId],
    queryFn: () =>
      unwrap<Expense[]>(
        db
          .from("expense")
          .select("*")
          .eq("trip_id", tripId)
          .is("deleted_at", null)
          .order("data", { ascending: false }),
      ),
  });

export const membersQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["members", tripId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { rpc: (f: string, a: unknown) => Promise<{ data: Membro[] | null; error: { message: string } | null }> }).rpc("membros_viagem", { _tid: tripId });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const conferenciaNomesQuery = (ticketId: string) =>
  queryOptions({
    queryKey: ["conferencia_nomes", ticketId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { rpc: (f: string, a: unknown) => Promise<{ data: ConferenciaNome[] | null; error: { message: string } | null }> }).rpc("conferencia_nomes_voo", { _ticket_id: ticketId });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const peopleQuery = () =>
  queryOptions({
    queryKey: ["people"],
    queryFn: () =>
      unwrap<Person[]>(
        db
          .from("person")
          .select("id, nome, apelido, account_id, kind, nome_como_no_documento, nacionalidades, data_nascimento")
          .is("deleted_at", null)
          .order("nome"),
      ),
  });

export const findingsQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["findings", tripId],
    queryFn: () => unwrap<Finding[]>(db.from("consistency_finding").select("*").eq("trip_id", tripId)),
  });

export async function insertRow(tabela: string, valores: Record<string, unknown>) {
  const { data, error } = await db.from(tabela).insert(valores).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateRow(tabela: string, id: string, valores: Record<string, unknown>) {
  const { error } = await db.from(tabela).update(valores).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function softDelete(tabela: string, id: string) {
  await updateRow(tabela, id, { deleted_at: new Date().toISOString() });
}

/** Cotação do dia. Falha em silêncio: o campo continua editável. */
export type Cotacao = { taxa: number; fonte: string; data: string };

/** Cotação para qualquer código ISO: Frankfurter (BCE) e depois open.er-api. Null = taxa manual. */
export async function buscarCotacaoDetalhe(de: string, para: string): Promise<Cotacao | null> {
  const hoje = new Date().toISOString().slice(0, 10);
  if (de === para) return { taxa: 1, fonte: "mesma moeda", data: hoje };
  try {
    const r = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(de)}&to=${encodeURIComponent(para)}`);
    if (r.ok) {
      const j = (await r.json()) as { date?: string; rates?: Record<string, number> };
      const t = j.rates?.[para];
      if (t) return { taxa: t, fonte: "Frankfurter", data: j.date ?? hoje };
    }
  } catch { /* tenta a próxima */ }
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(de)}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { rates?: Record<string, number>; time_last_update_unix?: number };
    const t = j.rates?.[para];
    if (!t) return null;
    const data = j.time_last_update_unix ? new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10) : hoje;
    return { taxa: t, fonte: "ExchangeRate-API", data };
  } catch {
    return null;
  }
}

export async function buscarCotacao(de: string, para: string): Promise<number | null> {
  return (await buscarCotacaoDetalhe(de, para))?.taxa ?? null;
}

/** Último status de cada voo da viagem (guardado no aparelho para funcionar offline). */
export const flightStatusQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["flight_status", tripId],
    queryFn: async () => {
      const rows = await unwrap<(import("./voo").StatusVoo & { ticket: { trip_id: string } })[]>(
        db.from("flight_status").select("id,ticket_id,consultado_em,status,partida_prevista_utc,partida_revista_utc,partida_real_utc,chegada_prevista_utc,chegada_revista_utc,chegada_real_utc,terminal_partida,portao_partida,terminal_chegada,portao_chegada,esteira,atraso_partida_min,atraso_chegada_min,origem,ticket:ticket!inner(trip_id)").eq("ticket.trip_id", tripId).order("consultado_em", { ascending: false }).limit(500),
      );
      const porTicket: Record<string, import("./voo").StatusVoo> = {};
      for (const r of rows) if (!porTicket[r.ticket_id]) porTicket[r.ticket_id] = r;
      return porTicket;
    },
  });

export const apiAlertaQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["api_alerta", tripId],
    queryFn: () => unwrap<{ id: string; mensagem: string; created_at: string }[]>(db.from("api_alerta").select("id,mensagem,created_at").eq("trip_id", tripId).order("created_at", { ascending: false }).limit(1)),
  });

type Rpc = { rpc: (f: string, a?: unknown) => Promise<{ data: unknown; error: { message: string } | null }> };
async function rpc<T>(f: string, a?: unknown): Promise<T> {
  const { data, error } = await (supabase as unknown as Rpc).rpc(f, a);
  if (error) throw new Error(error.message);
  return data as T;
}

export type ConviteRecebido = {
  member_id: string; trip_id: string; person_id: string; pessoa: string; dependente: boolean; viagem: string;
  data_inicio: string; data_fim: string; organizador_id: string; organizador: string;
  voos: number; assentos: string[]; hoteis: number; quartos: string[]; trens: number; reservas: { tipo: string; papel: string | null }[];
};

/** Convites esperando resposta (antes, liga ao participante quem entrou com o e-mail do convite). */
export const convitesQuery = () =>
  queryOptions({
    queryKey: ["convites"],
    queryFn: async () => {
      if (typeof navigator !== "undefined" && navigator.onLine) await rpc<number>("receber_convites_por_email").catch(() => 0);
      return (await rpc<ConviteRecebido[] | null>("convites_recebidos")) ?? [];
    },
  });

export type Autoria = { autor: string; sou_eu: boolean; editar: boolean };
export const autoriaQuery = (tipo: string, id: string) =>
  queryOptions({
    queryKey: ["autoria", tipo, id],
    queryFn: async () => ((await rpc<Autoria[] | null>("autoria_item", { _tipo: tipo, _id: id })) ?? [])[0] ?? null,
  });

export type Confianca = { account_id: string; organizer_id: string; revogado_em: string | null };
export const confiancaQuery = () =>
  queryOptions({
    queryKey: ["trip_trust"],
    queryFn: () => unwrap<Confianca[]>(db.from("trip_trust").select("account_id, organizer_id, revogado_em")),
  });

export type ConviteMembro = { id: string; convite_email: string | null; convite_telefone: string | null; convite_idioma: string; lembrado_em: string | null };
export const convitesMembrosQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["convites_membros", tripId],
    queryFn: () => unwrap<ConviteMembro[]>(db.from("trip_member").select("id, convite_email, convite_telefone, convite_idioma, lembrado_em").eq("trip_id", tripId).is("deleted_at", null)),
  });

export type Pedido = { id: string; trip_id: string; person_id: string | null; mensagem: string; enviado_em: string; resolvido_em: string | null };
export const pedidosQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["pedidos", tripId],
    queryFn: () => unwrap<Pedido[]>(db.from("trip_notice").select("id, trip_id, person_id, mensagem, enviado_em, resolvido_em").eq("trip_id", tripId).eq("tipo", "pedido_correcao").order("enviado_em", { ascending: false })),
  });

export const conferirQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["conferir", tripId],
    queryFn: async () => (await rpc<import("./conferencia").Conferencia[] | null>("conferir_viagem", { _tid: tripId })) ?? [],
  });

export const entryRulesQuery = () =>
  queryOptions({
    queryKey: ["entry_rule"],
    queryFn: () => unwrap<import("./conferencia").EntryRule[]>(db.from("entry_rule").select("nacionalidade, pais_destino, exigencia, detalhe, validade_passaporte_min_meses, fonte_url, verificado_em")),
  });

export type AvisoMeu = { id: string; trip_id: string; person_id: string | null; mensagem: string; campo: string | null; enviado_em: string; trip: { nome: string } | null };
/** Avisos abertos para mim ou meus dependentes (o banco filtra). */
export const avisosMeusQuery = () =>
  queryOptions({
    queryKey: ["avisos_meus"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const l = await unwrap<(AvisoMeu & { enviado_por: string | null })[]>(db.from("trip_notice").select("id, trip_id, person_id, mensagem, campo, enviado_em, enviado_por, trip:trip(nome)").eq("tipo", "aviso").is("resolvido_em", null).order("enviado_em", { ascending: false }));
      return l.filter((a) => a.enviado_por !== u.user?.id);
    },
  });

export type PedidoRecebido = { id: string; from_id: string; from_nome: string | null; blocos: string[]; trip_id: string | null; viagem: string | null; ate: string | null; pessoa: string | null };
export const pedidosRecebidosQuery = () =>
  queryOptions({
    queryKey: ["pedidos_recebidos"],
    queryFn: async () => (await rpc<PedidoRecebido[] | null>("pedidos_recebidos")) ?? [],
  });

/** Caixa "Chegou pelo Claude": itens pendentes propostos pelo agente (só o dono lê). */
export type ItemCaixa = {
  id: string;
  trip_id: string | null;
  tipo_alvo: "voo" | "hotel" | "reserva" | "despesa";
  payload_json: { id: string; resumo?: { titulo: string; origem: string | null; avisos: string[] } } & Record<string, unknown>;
  achados_json: { regra_id: string; severidade: string; mensagem: string }[];
  lote_id: string | null;
  criado_em: string;
};
export const caixaClaudeQuery = () =>
  queryOptions({
    queryKey: ["caixa-claude"],
    queryFn: () =>
      unwrap<ItemCaixa[]>(
        db.from("agent_inbox").select("id,trip_id,tipo_alvo,payload_json,achados_json,lote_id,criado_em").eq("status", "pendente").order("criado_em", { ascending: true }),
      ),
  });
