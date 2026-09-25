import { defineTool } from "@lovable.dev/mcp-js";
import { FERRAMENTAS_AGENTE, esquemaVoo } from "../../agente.tools";
import { proporVoo } from "../../agente.server";
import { ctxAgente, responder } from "./_base";

export default defineTool({
  name: "propor_voo",
  title: "Propor voo",
  description: FERRAMENTAS_AGENTE.propor_voo,
  inputSchema: esquemaVoo.shape,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (a, ctx) => responder(() => proporVoo(ctxAgente(ctx), esquemaVoo.parse(a))),
});
