import { defineTool } from "@lovable.dev/mcp-js";
import { FERRAMENTAS_AGENTE, esquemaTrip } from "../../agente.tools";
import { listarParticipantes } from "../../agente.server";
import { ctxAgente, responder } from "./_base";

export default defineTool({
  name: "listar_participantes",
  title: "Listar participantes",
  description: FERRAMENTAS_AGENTE.listar_participantes,
  inputSchema: esquemaTrip.shape,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (a, ctx) => responder(() => listarParticipantes(ctxAgente(ctx), a.trip_id)),
});
