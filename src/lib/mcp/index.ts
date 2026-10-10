import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarViagens from "./tools/listar_viagens";
import detalharViagem from "./tools/detalhar_viagem";
import listarParticipantes from "./tools/listar_participantes";
import proporVoo from "./tools/propor_voo";
import proporHospedagem from "./tools/propor_hospedagem";
import proporReserva from "./tools/propor_reserva";
import rodarRevisao from "./tools/rodar_revisao";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "evoque-viagens",
  title: "Viagens Organizadas",
  version: "0.1.0",
  instructions:
    "Ferramentas do Viagens Organizadas. Use listar_viagens para achar o trip_id e listar_participantes para os person_id. As propor_* NÃO gravam direto: criam itens pendentes que o usuário confirma no app em 'Chegou pelo Claude'. Datas em ISO 8601 com offset, moeda ISO 4217, aeroportos IATA. Avise o usuário dos achados devolvidos.",
  auth: auth.oauth.issuer({ issuer: `https://${projectRef}.supabase.co/auth/v1`, acceptedAudiences: "authenticated" }),
  tools: [listarViagens, detalharViagem, listarParticipantes, proporVoo, proporHospedagem, proporReserva, rodarRevisao],
});
