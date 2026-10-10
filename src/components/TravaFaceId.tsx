import { useEffect, useState, useSyncExternalStore } from "react";
import { ScanFace, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Trava por Face ID/biometria (WebAuthn, só neste aparelho). O login continua
 * sendo por e-mail/senha; a trava apenas pede o rosto antes de mostrar o app.
 */
const CHAVE = "evoque-faceid";
const FORA_MS = 5 * 60 * 1000;
const ouvintes = new Set<() => void>();

function lerId(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}
function avisar() {
  ouvintes.forEach((f) => f());
}
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const aleatorio = () => crypto.getRandomValues(new Uint8Array(32));

/** Rótulo da biometria conforme o aparelho: Touch ID no Mac, Face ID no resto. */
export function rotuloBio(): string {
  try {
    const macSemToque =
      /Mac/i.test(navigator.userAgent) && navigator.maxTouchPoints === 0;
    return macSemToque ? "Touch ID" : "Face ID";
  } catch {
    return "Face ID";
  }
}

/** Explica em português por que a biometria não foi ligada/confirmada. */
export function motivoFalhaBio(e: unknown): string {
  const bio = rotuloBio();
  try {
    if (window.self !== window.top)
      return `${bio} só funciona no app publicado (app.evoque.global), não na tela de edição.`;
  } catch {
    return `${bio} só funciona no app publicado (app.evoque.global).`;
  }
  const nome = (e as { name?: string })?.name ?? "";
  if (nome === "NotAllowedError")
    return `${bio} cancelado ou sem resposta. Toque de novo e encoste o dedo no sensor.`;
  if (nome === "SecurityError") return `${bio} não aceito neste endereço. Abra por app.evoque.global.`;
  if (nome === "InvalidStateError") return `${bio} já estava ligado. Desligue e ligue de novo.`;
  if (nome === "NotSupportedError") return `Este navegador não oferece ${bio}. Use o Safari ou o Chrome.`;
  return `${bio} não foi ativado${nome ? ` (${nome})` : ""}. Tente de novo.`;
}

export function useFaceIdLigado() {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => !!lerId(),
    () => false,
  );
}

export async function faceIdDisponivel() {
  try {
    return (
      !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

export async function ligarFaceId(email: string) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: aleatorio(),
      rp: { name: "Viagens Organizadas", id: location.hostname },
      user: { id: aleatorio(), name: email || "Viagens Organizadas", displayName: "Viagens Organizadas" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
      },
      timeout: 60000,
      hints: ["client-device"],
    } as PublicKeyCredentialCreationOptions,
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("cancelado");
  localStorage.setItem(CHAVE, b64(cred.rawId));
  avisar();
}

/** Cria uma credencial de Face ID separada (ex.: para o cofre) e devolve o id. */
export async function criarCredencialFaceId(nome: string) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: aleatorio(),
      rp: { name: "Viagens Organizadas", id: location.hostname },
      user: { id: aleatorio(), name: nome, displayName: nome },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000,
      hints: ["client-device"],
    } as PublicKeyCredentialCreationOptions,
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("cancelado");
  return b64(cred.rawId);
}

export function desligarFaceId() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
  avisar();
}

export async function conferir(id: string) {
  const r = await navigator.credentials.get({
    publicKey: {
      challenge: aleatorio(),
      rpId: location.hostname,
      allowCredentials: [{ type: "public-key", id: deB64(id), transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000,
      hints: ["client-device"],
    } as PublicKeyCredentialRequestOptions,
  });
  if (!r) throw new Error("cancelado");
}

/** Envolve o app: se a trava estiver ligada, pede Face ID ao abrir e ao voltar após 5 min. */
export function TravaFaceId({ children }: { children: React.ReactNode }) {
  const ligado = useFaceIdLigado();
  const [travado, setTravado] = useState(() => typeof window !== "undefined" && !!lerId());
  const [tentando, setTentando] = useState(false);

  useEffect(() => {
    if (!ligado) {
      setTravado(false);
      return;
    }
    let saiuEm = 0;
    const vis = () => {
      if (document.visibilityState === "hidden") saiuEm = Date.now();
      else if (saiuEm && Date.now() - saiuEm > FORA_MS) setTravado(true);
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [ligado]);

  async function destravar() {
    const id = lerId();
    if (!id) return setTravado(false);
    setTentando(true);
    try {
      await conferir(id);
      setTravado(false);
    } catch {
      toast.error("Não foi possível confirmar. Tente de novo.");
    } finally {
      setTentando(false);
    }
  }

  // Pede o rosto assim que a trava aparece.
  useEffect(() => {
    if (travado && ligado) void destravar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travado]);

  async function entrarComSenha() {
    desligarFaceId();
    await supabase.auth.signOut();
  }

  if (!travado || !ligado) return <>{children}</>;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <ScanFace size={72} strokeWidth={1.8} className="text-primary" aria-hidden />
      <h1 className="text-2xl text-foreground">Viagens Organizadas travado</h1>
      <button
        type="button"
        onClick={destravar}
        disabled={tentando}
        className="gradient-hero shadow-medium tap flex w-full max-w-sm items-center justify-center gap-3 rounded-2xl text-xl font-bold disabled:opacity-60"
      >
        <ScanFace size={28} strokeWidth={2.2} /> Abrir com {rotuloBio()}
      </button>
      <button
        type="button"
        onClick={entrarComSenha}
        className="tap flex items-center gap-2 text-base font-semibold text-muted-foreground"
      >
        <LogOut size={22} /> Entrar com e-mail e senha
      </button>
    </div>
  );
}
