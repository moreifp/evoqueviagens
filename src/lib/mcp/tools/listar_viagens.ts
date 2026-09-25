import { defineTool } from "@lovable.dev/mcp-js";
import { FERRAMENTAS_AGENTE } from "../../agente.tools";
import { listarViagens } from "../../agente.server";
import { ctxAgente, responder } from "./_base";

export default defineTool({
  name: "listar_viagens",
  title: "Listar viagens",
  description: FERRAMENTAS_AGENTE.listar_viagens,
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_a, ctx) => responder(() => listarViagens(ctxAgente(ctx))),
});
