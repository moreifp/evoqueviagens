import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Trip = {
  id: string;
  owner_id: string;
  nome: string;
  destino: string | null;
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
  anexo_url: string | null;
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

export type Person = {
  id: string;
  nome: string;
  nome_como_no_documento: string | null;
  nacionalidades: string[];
  data_nascimento: string | null;
};

export type Membro = { id: string; papel: string; person: Person };

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
          .select("*")
          .eq("trip_id", tripId)
          .is("deleted_at", null)
          .order("partida_utc", { ascending: true }),
      ),
  });

export const lodgingsQuery = (tripId: string) =>
  queryOptions({
    queryKey: ["lodgings", tripId],
    queryFn: () =>
      unwrap<Lodging[]>(
        db
          .from("lodging")
          .select("*")
          .eq("trip_id", tripId)
          .is("deleted_at", null)
          .order("checkin", { ascending: true }),
      ),
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
    queryFn: () =>
      unwrap<Membro[]>(
        db
          .from("trip_member")
          .select("id, papel, person:person_id(id, nome, nome_como_no_documento, nacionalidades, data_nascimento)")
          .eq("trip_id", tripId)
          .is("deleted_at", null),
      ),
  });

export const peopleQuery = () =>
  queryOptions({
    queryKey: ["people"],
    queryFn: () =>
      unwrap<Person[]>(
        db
          .from("person")
          .select("id, nome, nome_como_no_documento, nacionalidades, data_nascimento")
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
export async function buscarCotacao(de: string, para: string): Promise<number | null> {
  if (de === para) return 1;
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${de}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { rates?: Record<string, number> };
    return j.rates?.[para] ?? null;
  } catch {
    return null;
  }
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
