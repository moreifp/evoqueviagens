// Guarda no aparelho (IndexedDB) os originais ainda não salvos no iPhone/Drive,
// para não se perderem se a tela fechar, recarregar ou o iPhone encerrar o app.
// Os bytes são copiados (ArrayBuffer): o Safari não guarda com segurança um File vindo da galeria.
type Pendentes = { files: File[]; ids: string[] };
type Salvo = { name: string; type: string; lastModified: number; data: ArrayBuffer };
const DB = "evoque-fotos-pendentes";
const STORE = "viagens";

function abrir(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function lerPendentes(tripId: string): Promise<Pendentes> {
  try {
    const db = await abrir();
    const v = await new Promise<{ files: (Salvo | File)[]; ids: string[] } | undefined>((res) => {
      const q = db.transaction(STORE).objectStore(STORE).get(tripId);
      q.onsuccess = () => res(q.result);
      q.onerror = () => res(undefined);
    });
    if (!v) return { files: [], ids: [] };
    const files = v.files.map((s) =>
      s instanceof Blob
        ? (s as File)
        : new File([s.data], s.name, { type: s.type, lastModified: s.lastModified }),
    );
    return { files, ids: v.ids ?? [] };
  } catch {
    return { files: [], ids: [] };
  }
}

export async function gravarPendentes(tripId: string, p: Pendentes): Promise<void> {
  try {
    const salvos: Salvo[] = await Promise.all(
      p.files.map(async (f) => ({
        name: f.name,
        type: f.type,
        lastModified: f.lastModified,
        data: await f.arrayBuffer(),
      })),
    );
    const db = await abrir();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, "readwrite");
      const s = tx.objectStore(STORE);
      if (salvos.length) s.put({ files: salvos, ids: p.ids }, tripId);
      else s.delete(tripId);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch (e) {
    console.error("fotos pendentes", e);
  }
}
