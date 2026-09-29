// Guarda no aparelho (IndexedDB) os originais ainda não salvos no iPhone/Drive,
// para não se perderem se a tela fechar, recarregar ou o iPhone encerrar o app.
type Pendentes = { files: File[]; ids: string[] };
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
    return await new Promise((res) => {
      const q = db.transaction(STORE).objectStore(STORE).get(tripId);
      q.onsuccess = () => res((q.result as Pendentes) ?? { files: [], ids: [] });
      q.onerror = () => res({ files: [], ids: [] });
    });
  } catch {
    return { files: [], ids: [] };
  }
}

export async function gravarPendentes(tripId: string, p: Pendentes): Promise<void> {
  try {
    const db = await abrir();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, "readwrite");
      const s = tx.objectStore(STORE);
      if (p.files.length) s.put(p, tripId);
      else s.delete(tripId);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch {
    /* sem IndexedDB: segue só na memória */
  }
}
