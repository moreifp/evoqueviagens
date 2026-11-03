import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const COPIA = "evoque-sessao-copia";

/**
 * Cópia da sessão que só o app apaga (no botão Sair). O SDK do Supabase apaga a
 * sessão dele sozinho quando a renovação do token volta com resposta estranha —
 * Wi-Fi de avião com portal, resposta cortada — e o app caía na tela de login
 * sem internet, sem jeito de entrar. Com a cópia, o modo leitura continua.
 */
export function guardarCopiaSessao(s: Session | null) {
  if (!s?.user) return;
  try {
    localStorage.setItem(COPIA, JSON.stringify(s));
  } catch {
    /* sem storage */
  }
}

export function apagarCopiaSessao() {
  try {
    localStorage.removeItem(COPIA);
  } catch {
    /* sem storage */
  }
}

function copiaSessao(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(COPIA) ?? "null") as Session | null;
    return s?.user ? s : null;
  } catch {
    return null;
  }
}

/** Sessão salva pelo login no aparelho (mesmo vencida), para o modo leitura sem internet. */
export function sessaoGuardada(): Session | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      if (!/^sb-.+-auth-token$/.test(k)) continue;
      const v = JSON.parse(localStorage.getItem(k) ?? "null") as
        | Session
        | { currentSession?: Session }
        | null;
      const s =
        (v && "access_token" in v ? v : (v as { currentSession?: Session } | null)?.currentSession) ??
        null;
      if (s?.user) return s as Session;
    }
  } catch {
    /* sem storage */
  }
  return copiaSessao();
}

/**
 * Internet de verdade, não o que o navegador acha: no iPhone, navigator.onLine fica
 * "true" no Wi-Fi do avião ou sem sinal. Vai ao servidor do app (caminho que o
 * service worker nunca responde do cache) e espera no máximo 3 s.
 */
export async function realmenteOnline(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch(`/sw-precache.js?p=${Date.now()}`, { cache: "no-store", signal: ctl.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

/** Usuário da sessão guardada no aparelho (não vai à rede; funciona no avião). Mesmo formato de auth.getUser(). */
export async function usuarioLocal() {
  const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const user = data.session?.user ?? sessaoGuardada()?.user ?? null;
  return { data: { user } };
}
