import { defineTool } from "@lovable.dev/mcp-js";
import { FERRAMENTAS_AGENTE, esquemaTrip } from "../../agente.tools";
import { rodarRevisao } from "../../agente.server";
import { ctxAgente, responder } from "./_base";

export default defineTool({
  name: "rodar_revisao",
  title: "Rodar revisão",
  description: FERRAMENTAS_AGENTE.rodar_revisao,
  inputSchema: esquemaTrip.shape,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (a, ctx) => responder(() => rodarRevisao(ctxAgente(ctx), a.trip_id)),
});
