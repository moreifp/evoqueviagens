import { defineTool } from "@lovable.dev/mcp-js";
import { FERRAMENTAS_AGENTE, esquemaReserva } from "../../agente.tools";
import { proporReserva } from "../../agente.server";
import { ctxAgente, responder } from "./_base";

export default defineTool({
  name: "propor_reserva",
  title: "Propor reserva",
  description: FERRAMENTAS_AGENTE.propor_reserva,
  inputSchema: esquemaReserva.shape,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (a, ctx) => responder(() => proporReserva(ctxAgente(ctx), esquemaReserva.parse(a))),
});
