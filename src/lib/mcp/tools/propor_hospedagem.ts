import { defineTool } from "@lovable.dev/mcp-js";
import { FERRAMENTAS_AGENTE, esquemaHospedagem } from "../../agente.tools";
import { proporHospedagem } from "../../agente.server";
import { ctxAgente, responder } from "./_base";

export default defineTool({
  name: "propor_hospedagem",
  title: "Propor hospedagem",
  description: FERRAMENTAS_AGENTE.propor_hospedagem,
  inputSchema: esquemaHospedagem.shape,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (a, ctx) => responder(() => proporHospedagem(ctxAgente(ctx), esquemaHospedagem.parse(a))),
});
