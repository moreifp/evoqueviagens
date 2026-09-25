import { CODIGOS_MOEDA } from "./moedas";
/**
 * Contrato das ferramentas do agente (Claude via MCP). Texto e esquemas puros,
 * usados pelas funções de servidor agora e pelo servidor MCP quando o dono ligar.
 * Nenhuma ferramenta grava item direto: tudo vira "pendente" na caixa "Chegou pelo Claude".
 */
import { z } from "zod";

const isoComOffset = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/, "Use ISO 8601 COM offset, ex.: 2026-11-10T22:35:00-03:00");
const iata = z.string().trim().regex(/^[A-Za-z]{3}$/, "Código IATA de 3 letras, ex.: GRU").transform((s) => s.toUpperCase());
const moeda = z.string().trim().regex(/^[A-Za-z]{3}$/, "Moeda ISO 4217, ex.: EUR").transform((s) => s.toUpperCase()).refine((c) => CODIGOS_MOEDA.has(c), "Moeda ISO 4217 desconhecida");
const fuso = z.string().trim().min(3).max(64).optional().describe("Fuso IANA do local, ex.: Europe/Lisbon (opcional)");

const pessoa = z.object({
  person_id: z.string().uuid().optional().describe("id vindo de listar_participantes (preferido)"),
  nome: z.string().trim().max(120).optional().describe("nome como aparece na reserva, usado se não houver person_id"),
});

const comum = {
  trip_id: z.string().uuid().describe("id vindo de listar_viagens"),
  idempotency_key: z.string().trim().min(3).max(200).optional().describe("Chave para não duplicar. Se omitida: tipo + localizador + data."),
  lote_id: z.string().uuid().optional().describe("Mesmo valor para todos os itens de um mesmo pedido do usuário"),
  origem: z
    .object({
      remetente: z.string().trim().max(120).optional().describe("ex.: TAP Air Portugal"),
      assunto: z.string().trim().max(200).optional(),
      anexo_nome: z.string().trim().max(200).optional().describe("ex.: bilhete.pdf"),
      canal: z.enum(["email", "whatsapp", "print", "outro"]).optional(),
    })
    .optional(),
  origem_cliente: z.string().trim().max(60).optional().describe("ex.: claude"),
};

export const esquemaVoo = z.object({
  ...comum,
  localizador: z.string().trim().max(20).optional(),
  trechos: z
    .array(
      z.object({
        tipo: z.enum(["voo", "trem", "onibus", "carro", "transfer"]).default("voo"),
        companhia: z.string().trim().max(40).optional().describe("Código IATA da companhia, ex.: TP"),
        numero: z.string().trim().max(10).optional().describe("Só o número, ex.: 88"),
        origem_iata: iata.optional(),
        destino_iata: iata.optional(),
        origem_cidade: z.string().trim().max(80).optional(),
        destino_cidade: z.string().trim().max(80).optional(),
        partida: isoComOffset,
        chegada: isoComOffset,
      }),
    )
    .min(1)
    .max(8),
  passageiros: z
    .array(pessoa.extend({ nome_no_bilhete: z.string().trim().max(120).optional(), assento: z.string().trim().max(8).optional(), eticket: z.string().trim().max(20).optional() }))
    .max(20)
    .default([]),
});

export const esquemaHospedagem = z.object({
  ...comum,
  hotel: z.object({
    nome: z.string().trim().min(1).max(160),
    endereco: z.string().trim().max(300).optional(),
    cidade: z.string().trim().max(80).optional(),
    checkin: isoComOffset,
    checkout: isoComOffset,
    fuso,
    localizador: z.string().trim().max(40).optional(),
    valor: z.number().nonnegative().optional(),
    moeda: moeda.optional(),
    politica_cancelamento: z.string().trim().max(500).optional(),
    cancelamento_gratis_ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data AAAA-MM-DD"),
    site: z.string().trim().url().max(300).optional(),
  }),
  quartos: z.array(z.object({ nome: z.string().trim().max(60).optional(), tipo: z.string().trim().max(60).optional(), hospedes: z.array(pessoa).max(10).default([]) })).max(10).default([]),
  hospedes: z.array(pessoa).max(20).default([]).describe("Hóspedes sem quarto definido (vão para um quarto único)"),
});

export const esquemaReserva = z.object({
  ...comum,
  tipo: z.enum(["carro", "passeio", "restaurante", "outro"]),
  titulo: z.string().trim().min(1).max(160),
  inicio: isoComOffset,
  fim: isoComOffset.optional(),
  fuso,
  local: z.string().trim().max(300).optional(),
  cidade: z.string().trim().max(80).optional(),
  localizador: z.string().trim().max(40).optional(),
  valor: z.number().nonnegative().optional(),
  moeda: moeda.optional(),
  pessoas: z.array(pessoa.extend({ papel: z.string().trim().max(40).optional() })).max(20).default([]),
});

export const esquemaTrip = z.object({ trip_id: z.string().uuid() });

/** Nome → descrição para o agente. Estas são as ferramentas que viram tools do MCP. */
export const FERRAMENTAS_AGENTE = {
  listar_viagens: "Lista as viagens que o usuário pode ver: id, nome, datas (AAAA-MM-DD), cidades e se ele é o organizador. Use para achar o trip_id certo antes de propor itens.",
  detalhar_viagem: "Mostra o roteiro resumido de uma viagem (voos, hotéis e reservas, com horários em UTC e fuso IANA). Não inclui documentos nem valores de outras pessoas.",
  listar_participantes: "Lista quem está na viagem: person_id, nome, apelido, se é dependente e se aceitou. Use o person_id ao propor passageiros, hóspedes ou pessoas.",
  propor_voo:
    "Propõe um ou mais trechos (voo, trem, ônibus) de uma mesma reserva. NÃO grava direto: cria itens PENDENTES que o usuário confirma no app. Datas em ISO 8601 COM offset do local (ex.: 2026-11-10T22:35:00-03:00), aeroportos em IATA (GRU), companhia em código IATA (TP). Devolve os achados do auditor se o item entrasse, para você avisar o usuário. Repetir a mesma chamada não duplica.",
  propor_hospedagem:
    "Propõe uma hospedagem com quartos e hóspedes. NÃO grava direto: cria item PENDENTE. checkin/checkout em ISO 8601 COM offset, moeda ISO 4217 (EUR, BRL). Devolve os achados do auditor (ex.: noite sem cama entre hotel e voo). Repetir a mesma chamada não duplica.",
  propor_reserva:
    "Propõe uma reserva (carro, passeio, restaurante, outro). NÃO grava direto: cria item PENDENTE. inicio/fim em ISO 8601 COM offset, moeda ISO 4217. Repetir a mesma chamada não duplica.",
  rodar_revisao: "Roda o auditor da viagem agora e devolve os achados (severidade resolver/conferir/sugestão e mensagem em português).",
} as const;
