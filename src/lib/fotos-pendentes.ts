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

// Cada foto é copiada uma única vez; as gravações seguintes reaproveitam a cópia.
const copias = new WeakMap<File, Promise<Salvo>>();
function copiar(f: File) {
  let c = copias.get(f);
  if (!c) {
    c = f.arrayBuffer().then((data) => ({ name: f.name, type: f.type, lastModified: f.lastModified, data }));
    copias.set(f, c);
  }
  return c;
}

/** Devolve false se não deu para guardar no aparelho (ex.: sem espaço). */
export async function gravarPendentes(tripId: string, p: Pendentes): Promise<boolean> {
  try {
    const salvos: Salvo[] = await Promise.all(p.files.map(copiar));
    const db = await abrir();
    return await new Promise<boolean>((res) => {
      const tx = db.transaction(STORE, "readwrite");
      const s = tx.objectStore(STORE);
      if (salvos.length) s.put({ files: salvos, ids: p.ids }, tripId);
      else s.delete(tripId);
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
      tx.onabort = () => res(false);
    });
  } catch (e) {
    console.error("fotos pendentes", e);
    return false;
  }
}
