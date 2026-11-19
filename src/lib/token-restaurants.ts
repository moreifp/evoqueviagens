import { supabase } from "@/integrations/supabase/client";
import { sessaoGuardada } from "@/lib/sessao";

export type RespostaToken =
  | { token: string; clientId: string; url: string }
  | { erro: "nao_configurado" | "email_nao_confirmado" | "sessao_vencida" | "sem_login" };

/** Erro com a etapa onde falhou, para a tela e para o log. */
export class FalhaToken extends Error {
  constructor(
    public etapa: string,
    msg: string,
  ) {
    super(msg);
  }
}

function expira(jwt: string): number {
  try {
    const p = JSON.parse(atob(jwt.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    return (p.exp ?? 0) * 1000;
  } catch {
    return 0;
  }
}

function comPrazo<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((ok) => setTimeout(() => ok(null), ms)),
  ]);
}

/** Token de login do aparelho, lido direto do armazenamento (sem a trava do SDK, que no iPhone às vezes prende). */
async function tokenLogin(forcarRenovar: boolean): Promise<string | null> {
  const guardado = sessaoGuardada()?.access_token ?? null;
  if (!forcarRenovar && guardado && expira(guardado) - Date.now() > 60_000) return guardado;
  // Vencido ou quase: deixa o SDK renovar, mas sem esperar mais que 8 s.
  const r = forcarRenovar
    ? await comPrazo(supabase.auth.refreshSession(), 8000)
    : await comPrazo(supabase.auth.getSession(), 8000);
  return r?.data.session?.access_token ?? sessaoGuardada()?.access_token ?? null;
}

async function chamar(jwt: string): Promise<{ status: number; corpo: RespostaToken | null }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12_000);
  try {
    const r = await fetch("/api/public/hooks/token-restaurants", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
      signal: ctl.signal,
    });
    const corpo = (await r.json().catch(() => null)) as RespostaToken | null;
    return { status: r.status, corpo };
  } finally {
    clearTimeout(t);
  }
}

/** Pede o token SSO do Restaurants. Tenta duas vezes a rede e renova o login se ele venceu. */
export async function pedirTokenRestaurants(): Promise<RespostaToken> {
  let jwt = await tokenLogin(false);
  if (!jwt) throw new FalhaToken("login", "sem sessão no aparelho");
  let ultimo = "";
  for (let i = 0; i < 3; i++) {
    let r;
    try {
      r = await chamar(jwt);
    } catch (e) {
      ultimo =
        e instanceof Error ? (e.name === "AbortError" ? "demorou 12 s" : e.message) : String(e);
      continue;
    }
    if (r.status === 401) {
      const novo = await tokenLogin(true);
      if (!novo || novo === jwt) return { erro: "sessao_vencida" };
      jwt = novo;
      continue;
    }
    if (r.corpo) return r.corpo;
    ultimo = `resposta ${r.status}`;
  }
  throw new FalhaToken("rede", ultimo || "sem resposta");
}

/** Manda ao log do servidor onde e por que falhou (sem dados da pessoa). */
export function registrarFalha(onde: string, erro: string, detalhe = "") {
  try {
    void fetch("/api/public/hooks/log-cliente", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ onde, erro, detalhe }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* sem rede */
  }
}
