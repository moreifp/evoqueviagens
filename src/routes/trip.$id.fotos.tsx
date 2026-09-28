import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, Download, Images, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { tripQuery } from "@/lib/data";
import { comprimir } from "@/lib/imagem";

export const Route = createFileRoute("/trip/$id/fotos")({
  head: () => ({
    meta: [
      { title: "Fotos da viagem — Evoque Viagens" },
      { name: "description", content: "Fotos da viagem para todos os participantes verem." },
      { property: "og:title", content: "Fotos da viagem — Evoque Viagens" },
      { property: "og:description", content: "Fotos da viagem para todos os participantes verem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FotosViagem,
});

type Foto = { id: string; storage_path: string; url: string | null };
const BUCKET = "fotos-viagem";

function fotosQuery(tripId: string) {
  return {
    queryKey: ["fotos", tripId],
    queryFn: async (): Promise<Foto[]> => {
      const { data, error } = await supabase.from("trip_photo").select("id,storage_path").eq("trip_id", tripId).is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      if (!rows.length) return [];
      const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600);
      const mapa = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));
      return rows.map((r) => ({ ...r, url: mapa.get(r.storage_path) ?? null }));
    },
    staleTime: 30 * 60 * 1000,
  };
}

function FotosViagem() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: trip } = useQuery(tripQuery(id));
  const { data: fotos = [], isLoading } = useQuery(fotosQuery(id));
  const [meuId, setMeuId] = useState<string | null>(null);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setMeuId(data.user?.id ?? null)); }, []);
  const souDono = Boolean(trip && meuId && (trip as { owner_id?: string }).owner_id === meuId);

  const [camera, setCamera] = useState(false);
  const [novas, setNovas] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(0);
  const [aberta, setAberta] = useState<Foto | null>(null);
  const galeria = useRef<HTMLInputElement>(null);

  async function enviar(f: File) {
    setEnviando((n) => n + 1);
    try {
      const mini = await comprimir(f, 480, 0.7);
      const path = `${id}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(path, mini, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const ins = await supabase.from("trip_photo").insert({ trip_id: id, storage_path: path, tirada_em: new Date(f.lastModified || Date.now()).toISOString() });
      if (ins.error) { await supabase.storage.from(BUCKET).remove([path]); throw ins.error; }
    } catch {
      toast.error("Uma foto não foi enviada. Confira a internet.");
    } finally {
      setEnviando((n) => n - 1);
      void qc.invalidateQueries({ queryKey: ["fotos", id] });
    }
  }

  function receber(fs: File[]) {
    if (!fs.length) return;
    setNovas((a) => [...a, ...fs]);
    fs.forEach((f) => void enviar(f));
  }

  async function salvarNoFotos() {
    const files = novas;
    if (navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files });
        setNovas([]);
      } catch { /* cancelou */ }
      return;
    }
    // Computador: baixa os arquivos.
    files.forEach((f, i) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(f);
      a.download = `${trip?.nome ?? "viagem"}-${i + 1}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
    setNovas([]);
  }

  async function apagar(f: Foto) {
    const r = await supabase.from("trip_photo").update({ deleted_at: new Date().toISOString() }).eq("id", f.id);
    if (r.error) return void toast.error("Não foi possível apagar.");
    await supabase.storage.from(BUCKET).remove([f.storage_path]);
    setAberta(null);
    await qc.invalidateQueries({ queryKey: ["fotos", id] });
    toast.success("Foto apagada");
  }

  return (
    <div className="pb-8">
      <header className="flex items-center gap-3 px-4 py-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pess-soft text-pess"><Images size={26} strokeWidth={2.2} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl">Fotos</h1>
          <Link to="/fotos" search={{ escolher: true }} className="tap inline-flex items-center gap-1 text-base font-semibold text-muted-foreground">
            <span className="truncate">{trip?.nome ?? "Viagem"}</span> <ChevronDown size={20} strokeWidth={2.2} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4">
        {souDono && !camera && (
          <div className="flex gap-3">
            <button type="button" onClick={() => setCamera(true)} className="tap flex min-h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
              <Camera size={28} strokeWidth={2.2} /> Tirar fotos
            </button>
            <button type="button" onClick={() => galeria.current?.click()} aria-label="Escolher da galeria" className="tap flex min-h-16 items-center justify-center rounded-2xl border-2 border-border px-5 text-foreground">
              <Images size={28} strokeWidth={2.2} />
            </button>
            <input ref={galeria} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { receber(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
          </div>
        )}

        {camera && <CameraContinua onFoto={(f) => receber([f])} onFechar={() => setCamera(false)} total={novas.length} />}

        {souDono && novas.length > 0 && !camera && (
          <div className="space-y-2 rounded-2xl border-2 border-accent bg-card p-4">
            <p className="text-lg font-semibold">{novas.length} {novas.length === 1 ? "foto nova" : "fotos novas"}{enviando > 0 ? ` · enviando ${enviando}…` : ""}</p>
            <button type="button" onClick={salvarNoFotos} className="tap flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent text-lg font-bold text-accent-foreground">
              <Download size={24} strokeWidth={2.2} /> Salvar no Fotos do iPhone
            </button>
            <p className="text-base text-muted-foreground">No menu, toque em "Salvar imagens". Depois, no Fotos, junte-as no álbum "{trip?.nome}".</p>
          </div>
        )}

        {isLoading ? <p className="text-lg">Carregando…</p> : fotos.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-lg">Nenhuma foto ainda.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
            {fotos.map((f) => (
              <button key={f.id} type="button" onClick={() => setAberta(f)} className="aspect-square overflow-hidden rounded-md bg-muted">
                {f.url && <img src={f.url} alt="" loading="lazy" className="size-full object-cover" />}
              </button>
            ))}
          </div>
        )}
        {!souDono && fotos.length > 0 && <p className="text-base text-muted-foreground">Só o organizador acrescenta ou apaga fotos.</p>}
      </main>

      {aberta && <VerFoto foto={aberta} podeApagar={souDono} onFechar={() => setAberta(null)} onApagar={() => apagar(aberta)} />}
    </div>
  );
}

function VerFoto({ foto, podeApagar, onFechar, onApagar }: { foto: Foto; podeApagar: boolean; onFechar: () => void; onApagar: () => void }) {
  const [conf, setConf] = useState(false);
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex flex-col bg-primary">
      <div className="flex items-center justify-between p-3">
        <button type="button" onClick={onFechar} className="tap flex min-h-14 items-center gap-2 px-3 text-lg font-bold text-primary-foreground"><X size={28} strokeWidth={2.2} /> Fechar</button>
        {podeApagar && (
          <button type="button" onClick={() => (conf ? onApagar() : setConf(true))} className="tap flex min-h-14 items-center gap-2 rounded-xl bg-destructive px-4 text-lg font-bold text-destructive-foreground">
            <Trash2 size={24} strokeWidth={2.2} /> {conf ? "Tem certeza?" : "Apagar"}
          </button>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center p-2">{foto.url && <img src={foto.url} alt="" className="max-h-full max-w-full object-contain" />}</div>
    </div>
  );
}

/** Câmera ao vivo: toca "Capturar" quantas vezes quiser; "Pronto" fecha. */
function CameraContinua({ onFoto, onFechar, total }: { onFoto: (f: File) => void; onFechar: () => void; total: number }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let vivo = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment", width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false })
      .then((s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => { toast.error("Não consegui abrir a câmera. Use o botão da galeria."); onFechar(); });
    return () => { vivo = false; stream.current?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function capturar() {
    const v = video.current;
    if (!v || !v.videoWidth) return void toast.error("Aguarde a câmera carregar.");
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => { if (b) onFoto(new File([b], `foto-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() })); }, "image/jpeg", 0.92);
    setFlash(true); setTimeout(() => setFlash(false), 120);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-primary">
      <video ref={video} autoPlay playsInline muted className={`min-h-0 flex-1 object-contain ${flash ? "opacity-30" : ""}`} />
      <div className="flex items-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onFechar} className="tap flex min-h-16 items-center justify-center rounded-2xl border-2 border-primary-foreground px-5 text-lg font-bold text-primary-foreground">
          Pronto{total ? ` (${total})` : ""}
        </button>
        <button type="button" onClick={capturar} aria-label="Capturar" className="tap flex min-h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-foreground text-xl font-bold text-primary">
          <Camera size={30} strokeWidth={2.2} /> Capturar
        </button>
      </div>
    </div>
  );
}
