import { defineTool } from "@lovable.dev/mcp-js";
import { FERRAMENTAS_AGENTE, esquemaTrip } from "../../agente.tools";
import { detalharViagem } from "../../agente.server";
import { ctxAgente, responder } from "./_base";

export default defineTool({
  name: "detalhar_viagem",
  title: "Detalhar viagem",
  description: FERRAMENTAS_AGENTE.detalhar_viagem,
  inputSchema: esquemaTrip.shape,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (a, ctx) => responder(() => detalharViagem(ctxAgente(ctx), a.trip_id)),
});
