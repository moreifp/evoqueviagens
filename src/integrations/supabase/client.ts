// Cliente Supabase do navegador e do SSR (sem dependências do Lovable).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}


function createSupabaseClient() {
  // Use import.meta.env for client-side (Vite build-time replacement)
  // Fall back to process.env for SSR (server-side rendering)
  const SUPABASE_URL = import.meta.env['VITE_SUPABASE_URL'] || process.env['SUPABASE_URL'];
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || process.env['SUPABASE_PUBLISHABLE_KEY'];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Configure as variáveis do Supabase.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  limparSessoesDeOutroProjeto(SUPABASE_URL);
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

/**
 * Depois da migração do Lovable Cloud, o aparelho ainda guarda a sessão do projeto antigo
 * (sb-<ref-antigo>-auth-token). Ela é apagada para o modo sem internet não usar um login velho.
 */
function limparSessoesDeOutroProjeto(url: string) {
  if (typeof window === 'undefined') return;
  try {
    const ref = new URL(url).hostname.split('.')[0];
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i) ?? '';
      if (/^sb-.+-auth-token(-code-verifier)?$/.test(k) && !k.startsWith(`sb-${ref}-`)) window.localStorage.removeItem(k);
    }
  } catch {
    /* sem storage */
  }
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

