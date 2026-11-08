/**
 * Pede ao servidor que confira a viagem e mande ao Google Drive o que ainda não foi
 * (Viagens/<viagem>/…). Só funciona para o organizador; para os outros o servidor
 * recusa e nada acontece. Nunca trava a tela: roda em segundo plano e engole erros.
 */
import { sincronizarDrive } from "./drive.functions";
import { usuarioLocal } from "./sessao";

const emCurso = new Map<string, Promise<void>>();
const ultima = new Map<string, number>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

async function rodar(tripId: string) {
  // Até 10 lotes por vez (12 arquivos cada): o resto vai na próxima abertura.
  for (let i = 0; i < 10; i++) {
    const r = await sincronizarDrive({ data: { tripId } });
    if (!r.restantes) break;
  }
}

/**
 * Sincroniza agora (se houver internet). `ownerId`, quando conhecido, evita a
 * chamada para quem não organiza. `minIntervaloMs` evita repetir a cada abertura.
 */
export async function sincronizarViagemNoDrive(tripId: string, opts: { ownerId?: string | null; minIntervaloMs?: number } = {}) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const min = opts.minIntervaloMs ?? 0;
  if (min && Date.now() - (ultima.get(tripId) ?? 0) < min) return;
  if (opts.ownerId) {
    const { data } = await usuarioLocal();
    if (data.user?.id !== opts.ownerId) return;
  }
  const atual = emCurso.get(tripId);
  if (atual) return atual;
  const p = rodar(tripId)
    .catch((e) => console.warn("drive sync", (e as Error).message))
    .finally(() => {
      emCurso.delete(tripId);
      ultima.set(tripId, Date.now());
    });
  emCurso.set(tripId, p);
  return p;
}

/** Depois de um envio de arquivo: espera o lote acalmar e sincroniza. */
export function pedirSincroniaDrive(tripId: string) {
  const t = timers.get(tripId);
  if (t) clearTimeout(t);
  timers.set(
    tripId,
    setTimeout(() => {
      timers.delete(tripId);
      void sincronizarViagemNoDrive(tripId);
    }, 2500),
  );
}
