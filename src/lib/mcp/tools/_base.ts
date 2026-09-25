import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import type { Ctx } from "../../agente.server";

import { APP_URL } from "../../site";

const ORIGEM = APP_URL;

export function ctxAgente(ctx: ToolContext): Ctx {
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) throw new ToolError("Entre com sua conta do Evoque Viagens.");
  return { supabase: supabaseForUser(ctx), userId, origemUrl: ORIGEM };
}

export async function responder(fn: () => Promise<unknown>) {
  try {
    const r = await fn();
    return { content: [{ type: "text" as const, text: JSON.stringify(r) }] };
  } catch (e) {
    if (e instanceof ToolError) throw e;
    throw new ToolError(e instanceof Error ? e.message : "Falha ao executar.");
  }
}
