/**
 * Tokens de acesso do Google, só no servidor (funciona no Cloudflare Workers: só fetch + WebCrypto).
 * - Drive: refresh token OAuth da conta dona das fotos (GOOGLE_DRIVE_CLIENT_ID / _SECRET / _REFRESH_TOKEN).
 * - Firebase Cloud Messaging: conta de serviço (FIREBASE_SERVICE_ACCOUNT_JSON), sem firebase-admin.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";

type Cache = { token: string; expira: number };
let cacheDrive: Cache | null = null;
let cacheFcm: (Cache & { projeto: string }) | null = null;

/** Access token do Google Drive (renova sozinho ~1 min antes de vencer). */
export async function tokenDrive(): Promise<string> {
  if (cacheDrive && cacheDrive.expira > Date.now() + 60_000) return cacheDrive.token;
  const id = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const segredo = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!id || !segredo || !refresh) throw new Error("Google Drive não está ligado.");
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: segredo, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  if (!r.ok) {
    console.error(`Drive token [${r.status}]: ${(await r.text()).slice(0, 300)}`);
    throw new Error("Google Drive recusou o acesso. O token pode ter vencido: gere um novo refresh token.");
  }
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cacheDrive = { token: j.access_token, expira: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

type ContaServico = { client_email: string; private_key: string; project_id: string; token_uri?: string };

function contaServico(): ContaServico {
  const bruto = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!bruto) throw new Error("Firebase não configurado.");
  const c = JSON.parse(bruto) as ContaServico;
  if (!c.client_email || !c.private_key || !c.project_id) throw new Error("Conta de serviço do Firebase incompleta.");
  return c;
}

function b64url(dados: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof dados === "string" ? new TextEncoder().encode(dados) : dados instanceof Uint8Array ? dados : new Uint8Array(dados);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function chavePrivada(pem: string): Promise<CryptoKey> {
  const corpo = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\n|\s/g, "");
  const der = Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

/** Access token do FCM HTTP v1 e o ID do projeto Firebase. */
export async function tokenFcm(): Promise<{ token: string; projeto: string }> {
  if (cacheFcm && cacheFcm.expira > Date.now() + 60_000) return { token: cacheFcm.token, projeto: cacheFcm.projeto };
  const c = contaServico();
  const agora = Math.floor(Date.now() / 1000);
  const cab = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = b64url(
    JSON.stringify({
      iss: c.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: c.token_uri || TOKEN_URL,
      iat: agora,
      exp: agora + 3600,
    }),
  );
  const assinatura = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await chavePrivada(c.private_key), new TextEncoder().encode(`${cab}.${corpo}`));
  const jwt = `${cab}.${corpo}.${b64url(assinatura)}`;
  const r = await fetch(c.token_uri || TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!r.ok) {
    console.error(`FCM token [${r.status}]: ${(await r.text()).slice(0, 300)}`);
    throw new Error("Firebase recusou a conta de serviço.");
  }
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cacheFcm = { token: j.access_token, expira: Date.now() + j.expires_in * 1000, projeto: c.project_id };
  return { token: j.access_token, projeto: c.project_id };
}
