/**
 * Avisos push no navegador. Só em app.evoque.global, no endereço de testes do Cloudflare e em localhost.
 * O SDK do Firebase é carregado sob demanda, só quando a pessoa liga os avisos.
 */
import { toast } from "sonner";

export type EstadoPush =
  | "fora_do_app" // host sem app (landing, prévia)
  | "sem_suporte"
  | "iphone_sem_instalar"
  | "bloqueado"
  | "desligado"
  | "ligado";

const CHAVE_TOKEN = "evoque-push-token";

export function hostPermitePush(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  // Endereço de testes no Cloudflare (evoque-viagens.<conta>.workers.dev) também liga os avisos.
  return h === "app.evoque.global" || h === "localhost" || h === "127.0.0.1" || /^evoque-viagens\.[a-z0-9-]+\.workers\.dev$/.test(h);
}

function ehIphoneSemInstalar(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instalado = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !instalado;
}

export function estadoPush(): EstadoPush {
  if (!hostPermitePush()) return "fora_do_app";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "sem_suporte";
  if (ehIphoneSemInstalar()) return "iphone_sem_instalar";
  if (Notification.permission === "denied") return "bloqueado";
  return localStorage.getItem(CHAVE_TOKEN) ? "ligado" : "desligado";
}

function configFirebase() {
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    appId,
    messagingSenderId: appId?.split(":")[1] ?? "",
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined,
  };
}

async function obterToken(): Promise<string | null> {
  const cfg = configFirebase();
  if (!cfg.apiKey || !cfg.projectId || !cfg.appId || !cfg.messagingSenderId || !cfg.vapidKey) return null;
  const [{ initializeApp }, { getMessaging, getToken, onMessage, isSupported }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  if (!(await isSupported())) return null;
  const app = initializeApp({ apiKey: cfg.apiKey, projectId: cfg.projectId, appId: cfg.appId, messagingSenderId: cfg.messagingSenderId });
  const messaging = getMessaging(app);
  const registro = await navigator.serviceWorker.getRegistration();
  if (!registro) return null;
  const token = await getToken(messaging, { vapidKey: cfg.vapidKey, serviceWorkerRegistration: registro });
  // App aberto: toast discreto em vez de notificação do sistema.
  onMessage(messaging, (msg) => {
    toast(msg.notification?.title ?? "Aviso", { description: msg.notification?.body });
  });
  return token;
}

/** Chamar só a partir de um toque da pessoa. */
export async function ligarAvisos(): Promise<{ estado: EstadoPush; token?: string }> {
  const estado = estadoPush();
  if (estado !== "desligado" && estado !== "ligado") return { estado };
  const permissao = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permissao !== "granted") return { estado: "bloqueado" };
  try {
    const token = await obterToken();
    if (!token) return { estado: "sem_suporte" };
    localStorage.setItem(CHAVE_TOKEN, token);
    return { estado: "ligado", token };
  } catch (e) {
    console.error("push token", e);
    return { estado: "sem_suporte" };
  }
}

/** A cada abertura: se já está ligado, confere se o token mudou. */
export async function conferirTokenMudou(): Promise<string | null> {
  const salvo = localStorage.getItem(CHAVE_TOKEN);
  if (!salvo || estadoPush() !== "ligado") return null;
  try {
    const atual = await obterToken();
    if (atual && atual !== salvo) {
      localStorage.setItem(CHAVE_TOKEN, atual);
      return atual;
    }
  } catch {
    /* sem rede: mantém o salvo */
  }
  return null;
}

export function tokenSalvo(): string | null {
  return localStorage.getItem(CHAVE_TOKEN);
}

export function esquecerToken() {
  localStorage.removeItem(CHAVE_TOKEN);
}
