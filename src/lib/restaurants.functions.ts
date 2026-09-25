import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Endereço do Evoque Restaurants (pode ser trocado pelo segredo RESTAURANTS_URL). */
const RESTAURANTS_URL_PADRAO = "https://food.evoque.guru";

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const json64 = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

async function hs256(data: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))));
}

/**
 * Token SSO de 5 min para abrir o Evoque Restaurants embutido.
 * Mesmo formato do Culture Compass → Timão (HS256, aud = client_id, jti único).
 * Só emite para e-mail confirmado: o Restaurants liga/cria a conta por esse e-mail.
 */
export const tokenRestaurants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const secret = process.env["RESTAURANTS_SSO_SECRET"];
    const clientId = process.env["RESTAURANTS_CLIENT_ID"];
    const url = (process.env["RESTAURANTS_URL"] || RESTAURANTS_URL_PADRAO).replace(/\/+$/, "");
    if (!secret || !clientId) return { erro: "nao_configurado" as const };

    const { data: u } = await context.supabase.auth.getUser();
    const user = u.user;
    const email = user?.email?.trim().toLowerCase();
    if (!user || !email || !user.email_confirmed_at) return { erro: "email_nao_confirmado" as const };

    const { data: eu } = await context.supabase
      .from("person")
      .select("nome, apelido")
      .eq("account_id", user.id)
      .eq("kind", "self")
      .is("deleted_at", null)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

    const now = Math.floor(Date.now() / 1000);
    const h = json64({ alg: "HS256", typ: "JWT" });
    const p = json64({
      iss: "evoque-viagens",
      sub: user.id,
      email,
      email_verified: true,
      name: eu?.apelido || eu?.nome || (meta["full_name"] as string) || (meta["name"] as string) || "",
      avatar: (meta["avatar_url"] as string) || (meta["picture"] as string) || "",
      aud: clientId,
      jti: crypto.randomUUID(),
      iat: now,
      exp: now + 300,
    });
    const token = `${h}.${p}.${await hs256(`${h}.${p}`, secret)}`;
    return { token, clientId, url };
  });
