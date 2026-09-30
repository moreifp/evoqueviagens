import { usuarioLocal } from "@/lib/sessao";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, CheckCheck, ChevronDown, ChevronLeft, Download, Images, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { tripQuery } from "@/lib/data";
import { comprimir } from "@/lib/imagem";
import { useServerFn } from "@tanstack/react-start";
import { fotoDrive, pastaDrive } from "@/lib/drive.functions";
import { gravarPendentes, lerPendentes } from "@/lib/fotos-pendentes";

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
      const { data, error } = await supabase
        .from("trip_photo")
        .select("id,storage_path")
        .eq("trip_id", tripId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      if (!rows.length) return [];
      const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls(
        rows.map((r) => r.storage_path),
        3600,
      );
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
  useEffect(() => {
    void usuarioLocal().then(({ data }) => setMeuId(data.user?.id ?? null));
  }, []);
  const souDono = Boolean(trip && meuId && (trip as { owner_id?: string }).owner_id === meuId);

  const [camera, setCamera] = useState(false);
  const [novas, setNovas] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(0);
  const [aberta, setAberta] = useState<Foto | null>(null);
  const galeria = useRef<HTMLInputElement>(null);
  // Uploads em andamento e ids das fotos recém-enviadas (para marcá-las como "já no Drive").
  const uploads = useRef<Promise<void>[]>([]);
  const idsNovas = useRef<string[]>([]);
  // Originais pendentes ficam guardados no aparelho até serem salvos (sobrevivem a fechar o app).
  const [restaurado, setRestaurado] = useState(false);
  useEffect(() => {
    void lerPendentes(id).then((p) => {
      if (p.files.length) {
        setNovas((a) => [...p.files, ...a]);
        idsNovas.current = [...p.ids, ...idsNovas.current];
      }
      setRestaurado(true);
    });
  }, [id]);
  useEffect(() => {
    if (!restaurado) return;
    // Espera o lote acalmar: uma gravação só, em vez de uma por foto enviada.
    const t = setTimeout(() => {
      void gravarPendentes(id, { files: novas, ids: idsNovas.current }).then((ok) => {
        if (!ok) toast.error("Sem espaço para guardar os originais no aparelho · salve já no iPhone ou Drive");
      });
    }, 400);
    return () => clearTimeout(t);
  }, [id, novas, enviando, restaurado]);
  useEffect(() => {
    if (!novas.length) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [novas.length]);

  function enviar(f: File) {
    const p = (async () => {
      setEnviando((n) => n + 1);
      try {
        const mini = await comprimir(f, 480, 0.7);
        const path = `${id}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage
          .from(BUCKET)
          .upload(path, mini, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const ins = await supabase
          .from("trip_photo")
          .insert({
            trip_id: id,
            storage_path: path,
            tirada_em: new Date(f.lastModified || Date.now()).toISOString(),
          })
          .select("id")
          .single();
        if (ins.error) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw ins.error;
        }
        idsNovas.current.push(ins.data.id);
      } catch {
        toast.error("Uma foto não foi enviada. Confira a internet.");
      } finally {
        setEnviando((n) => n - 1);
        void qc.invalidateQueries({ queryKey: ["fotos", id] });
      }
    })();
    uploads.current.push(p);
    void p.finally(() => {
      uploads.current = uploads.current.filter((x) => x !== p);
    });
  }

  function receber(fs: File[]) {
    if (!fs.length) return;
    setNovas((a) => [...a, ...fs]);
    fs.forEach((f) => void enviar(f));
  }

  const nomePasta = (trip?.nome ?? "Viagem").replace(/[\\/:*?"<>|]/g, "-").trim() || "Viagem";
  const criarPasta = useServerFn(pastaDrive);
  const mandarFoto = useServerFn(fotoDrive);
  const [progresso, setProgresso] = useState("");

  // Manda direto para a pasta com o nome da viagem no Google Drive, uma foto por vez.
  async function baixarPasta(files: Blob[]) {
    if (!files.length) return;
    if (!navigator.onLine)
      throw new Error(
        "Sem internet · os originais só vão ao Drive com conexão. As cópias pequenas ficam na nuvem do app.",
      );
    const pasta = await criarPasta({ data: { tripId: id } });
    const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    for (let i = 0; i < files.length; i++) {
      setProgresso(`${i + 1} de ${files.length}`);
      const buf = new Uint8Array(await files[i]!.arrayBuffer());
      let bin = "";
      for (let j = 0; j < buf.length; j += 0x8000)
        bin += String.fromCharCode(...buf.subarray(j, j + 0x8000));
      await mandarFoto({
        data: {
          pastaId: pasta.id,
          nome: `${pasta.nome} ${carimbo} ${String(i + 1).padStart(3, "0")}.jpg`,
          base64: btoa(bin),
        },
      });
    }
    setProgresso("");
    toast.success(
      `${files.length} ${files.length === 1 ? "foto enviada" : "fotos enviadas"} para a pasta "${pasta.nome}" no Google Drive`,
    );
  }

  const [salvandoNovas, setSalvandoNovas] = useState(false);
  async function salvarNoFotos() {
    setSalvandoNovas(true);
    try {
      // Espera as cópias pequenas terminarem de subir antes de marcar como enviadas.
      while (uploads.current.length) await Promise.all([...uploads.current]);
      await baixarPasta(novas);
      // Originais foram ao Drive: essas fotos saem da lista "a baixar" (não reenvia a cópia pequena).
      if (idsNovas.current.length) {
        salvarBaixadas(new Set([...baixadas, ...idsNovas.current]));
        idsNovas.current = [];
      }
      setNovas([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui enviar ao Google Drive.");
    } finally {
      setSalvandoNovas(false);
      setProgresso("");
    }
  }

  // iPhone/iPad: o botão entrega ao app Fotos; em outros aparelhos, salva na pasta.
  const ehIphone =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Abre a folha de compartilhar do iPhone com os originais: "Salvar N imagens" guarda no app Fotos.
  async function salvarNoAparelho() {
    const files = novas.map(
      (f, i) =>
        new File([f], f.name || `${nomePasta} ${String(i + 1).padStart(3, "0")}.jpg`, {
          type: f.type || "image/jpeg",
        }),
    );
    if (!files.length) return;
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files })) {
      try {
        await nav.share({ files });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        toast.error("Não consegui abrir o salvar do aparelho.");
        return;
      }
    } else {
      for (const f of files) {
        const url = URL.createObjectURL(f);
        const a = document.createElement("a");
        a.href = url;
        a.download = f.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    }
    while (uploads.current.length) await Promise.all([...uploads.current]);
    if (idsNovas.current.length) {
      salvarBaixadas(new Set([...baixadas, ...idsNovas.current]));
      idsNovas.current = [];
    }
    setNovas([]);
    toast.success("Fotos entregues ao aparelho · o iCloud sincroniza sozinho");
  }


  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selecionando, setSelecionando] = useState(false);
  const [confApagar, setConfApagar] = useState(false);
  // Fotos já baixadas somem da aba só neste aparelho (os outros participantes continuam vendo).
  const chaveBaixadas = `evoque-fotos-baixadas:${id}`;
  const [baixadas, setBaixadas] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      setBaixadas(new Set(JSON.parse(localStorage.getItem(chaveBaixadas) ?? "[]")));
    } catch {
      /* vazio */
    }
  }, [chaveBaixadas]);
  function salvarBaixadas(s: Set<string>) {
    setBaixadas(s);
    localStorage.setItem(chaveBaixadas, JSON.stringify([...s]));
  }
  const pendentes = fotos.filter((f) => !baixadas.has(f.id));
  // Conta só as baixadas que ainda existem (apagadas somem da contagem).
  const nBaixadas = fotos.length - pendentes.length;
  const [verBaixadas, setVerBaixadas] = useState(false);
  const mostradas = verBaixadas ? fotos : pendentes;

  function alternar(fid: string) {
    setConfApagar(false);
    setSel((s) => {
      const n = new Set(s);
      if (n.has(fid)) n.delete(fid);
      else n.add(fid);
      return n;
    });
  }


  async function apagarSelecionadas() {
    if (!confApagar) return setConfApagar(true);
    const alvo = fotos.filter((f) => sel.has(f.id));
    const r = await supabase
      .from("trip_photo")
      .update({ deleted_at: new Date().toISOString() })
      .in(
        "id",
        alvo.map((f) => f.id),
      );
    if (r.error) return void toast.error("Não foi possível apagar.");
    await supabase.storage.from(BUCKET).remove(alvo.map((f) => f.storage_path));
    const restantes = new Set(baixadas);
    alvo.forEach((f) => restantes.delete(f.id));
    salvarBaixadas(restantes);
    setSel(new Set());
    setSelecionando(false);
    setConfApagar(false);
    await qc.invalidateQueries({ queryKey: ["fotos", id] });
    toast.success(`${alvo.length} ${alvo.length === 1 ? "foto apagada" : "fotos apagadas"}`);
  }

  async function apagar(f: Foto) {
    const r = await supabase
      .from("trip_photo")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", f.id);
    if (r.error) return void toast.error("Não foi possível apagar.");
    await supabase.storage.from(BUCKET).remove([f.storage_path]);
    setAberta(null);
    await qc.invalidateQueries({ queryKey: ["fotos", id] });
    toast.success("Foto apagada");
  }

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-1">
          <Link
            to="/trip/$id"
            params={{ id }}
            aria-label="Voltar"
            className="tap flex flex-col items-center justify-center rounded-xl text-foreground"
          >
            <ChevronLeft size={28} strokeWidth={2.2} />
            <span className="text-xs font-semibold">Voltar</span>
          </Link>
        </div>
        <div className="mt-1 flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pess-soft text-pess">
            <Images size={26} strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl">Fotos</h1>
            <Link
              to="/fotos"
              search={{ escolher: true }}
              className="tap inline-flex items-center gap-1 text-base font-semibold text-muted-foreground"
            >
              <span className="truncate">{trip?.nome ?? "Viagem"}</span>{" "}
              <ChevronDown size={20} strokeWidth={2.2} />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4">
        {souDono && !camera && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCamera(true)}
              className="tap flex min-h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-bold text-primary-foreground"
            >
              <Camera size={28} strokeWidth={2.2} /> Tirar fotos
            </button>
            <button
              type="button"
              onClick={() => galeria.current?.click()}
              aria-label="Escolher da galeria"
              className="tap flex min-h-16 items-center justify-center rounded-2xl border-2 border-border px-5 text-foreground"
            >
              <Images size={28} strokeWidth={2.2} />
            </button>
            <input
              ref={galeria}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                receber(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </div>
        )}

        {camera && (
          <CameraContinua
            onFoto={(f) => receber([f])}
            onFechar={() => setCamera(false)}
            total={novas.length}
          />
        )}

        {souDono && novas.length > 0 && !camera && (
          <div className="space-y-2 rounded-2xl border-2 border-accent bg-card p-4">
            <p className="text-lg font-semibold">
              {novas.length} {novas.length === 1 ? "foto nova" : "fotos novas"}
              {enviando > 0 ? ` · enviando ${enviando}…` : ""}
            </p>
            <button
              type="button"
              onClick={salvarNoFotos}
              disabled={salvandoNovas}
              className="tap flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent text-lg font-bold text-accent-foreground"
            >
              <Download size={24} strokeWidth={2.2} />{" "}
              {salvandoNovas ? `Enviando ${progresso}…` : `Originais para o Drive "${nomePasta}"`}
            </button>
          </div>
        )}

        {souDono && !camera && (
          <div className="space-y-2 rounded-2xl border-2 border-accent bg-card p-4">
            <button
              type="button"
              onClick={salvarNoAparelho}
              disabled={novas.length === 0 || salvandoNovas}
              className="tap flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-accent bg-card text-lg font-bold disabled:opacity-50"
            >
              <Download size={24} strokeWidth={2.2} />{" "}
              {ehIphone ? "Salvar no iPhone (iCloud Fotos)" : "Salvar no computador"}
            </button>
            {novas.length > 0 ? (
              ehIphone ? (
                <p className="text-base text-muted-foreground">
                  No iPhone: toque acima e escolha{" "}
                  <strong className="text-foreground">
                    “Salvar {novas.length} {novas.length === 1 ? "imagem" : "imagens"}”
                  </strong>
                  . O iCloud Fotos sincroniza sozinho. No app fica só a cópia pequena.
                </p>
              ) : (
                <p className="text-base text-muted-foreground">
                  No computador: escolha a pasta ao salvar. Para o iCloud, abra o app{" "}
                  <strong className="text-foreground">Fotos</strong> do Mac e importe as fotos dessa pasta.
                </p>
              )
            ) : (
              <p className="text-base text-muted-foreground">
                Tire ou escolha fotos primeiro. Depois, salve no aparelho e o iCloud Fotos sincroniza sozinho.
              </p>
            )}
          </div>
        )}

        {isLoading ? (
          <p className="text-lg">Carregando…</p>
        ) : fotos.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-lg">
            Nenhuma foto ainda.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-base text-muted-foreground">
                {pendentes.length} {pendentes.length === 1 ? "foto" : "fotos"} a baixar
                {verBaixadas && nBaixadas
                  ? ` · ${nBaixadas} já baixada${nBaixadas === 1 ? "" : "s"}`
                  : ""}
              </p>
              <div className="flex items-center">
                {souDono && (
                  <button
                    type="button"
                    aria-label="Selecionar todas as fotos"
                    onClick={() => {
                      setConfApagar(false);
                      const todas = fotos.every((f) => sel.has(f.id));
                      setSelecionando(!todas);
                      setVerBaixadas(!todas);
                      setSel(todas ? new Set() : new Set(fotos.map((f) => f.id)));
                    }}
                    className="tap flex min-h-12 items-center justify-center gap-1 rounded-xl px-3 text-lg font-semibold text-accent"
                  >
                    {fotos.every((f) => sel.has(f.id)) ? (
                      <X size={24} strokeWidth={2.2} />
                    ) : (
                      <CheckCheck size={26} strokeWidth={2.2} />
                    )}
                    Todas
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelecionando((s) => !s);
                    setSel(new Set());
                  }}
                  className="tap min-h-12 rounded-xl px-4 text-lg font-semibold text-accent"
                >
                  {selecionando ? "Cancelar" : "Selecionar"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
              {mostradas.map((f) => {
                const marcada = sel.has(f.id);
                const jaBaixada = baixadas.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={selecionando || sel.size ? marcada : undefined}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || selecionando || sel.size) {
                        if (!selecionando) setSelecionando(true);
                        alternar(f.id);
                      } else setAberta(f);
                    }}
                    className={`relative aspect-square overflow-hidden rounded-md bg-muted ${marcada ? "ring-4 ring-accent" : ""}`}
                  >
                    {f.url && (
                      <img
                        src={f.url}
                        alt=""
                        loading="lazy"
                        className={`size-full object-cover ${marcada ? "opacity-70" : ""}`}
                      />
                    )}
                    {jaBaixada && !marcada && (
                      <span
                        aria-label="Já enviada ao Drive"
                        className="absolute left-1 top-1 flex size-7 items-center justify-center rounded-full bg-primary/80 text-primary-foreground"
                      >
                        <Check size={18} strokeWidth={3} />
                      </span>
                    )}
                    {marcada && (
                      <span className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Check size={20} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {sel.size > 0 && souDono && (
          <button
            type="button"
            onClick={apagarSelecionadas}
            className="tap flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-destructive text-lg font-bold text-destructive-foreground"
          >
            <Trash2 size={24} strokeWidth={2.2} />{" "}
            {confApagar
              ? `Tem certeza? Apagar ${sel.size}`
              : `Apagar ${sel.size} ${sel.size === 1 ? "foto" : "fotos"}`}
          </button>
        )}
        {fotos.length > 0 && pendentes.length === 0 && !verBaixadas && (
          <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-lg">
            Todas as fotos já foram para o Google Drive.
          </p>
        )}
        {nBaixadas > 0 && (
          <button
            type="button"
            onClick={() => setVerBaixadas((v) => !v)}
            aria-pressed={verBaixadas}
            className="tap min-h-12 w-full text-base font-semibold text-muted-foreground underline"
          >
            {verBaixadas
              ? `Esconder as ${nBaixadas} já baixada${nBaixadas === 1 ? "" : "s"}`
              : `Mostrar também as ${nBaixadas} já baixada${nBaixadas === 1 ? "" : "s"}`}
          </button>
        )}
        <p className="text-base text-muted-foreground">
          No computador, segure ⌘ (ou Ctrl) e clique para escolher várias.
          {souDono ? "" : " Só o organizador acrescenta ou apaga fotos."}
        </p>
      </main>

      {aberta && (
        <VerFoto
          foto={aberta}
          podeApagar={souDono}
          onFechar={() => setAberta(null)}
          onApagar={() => apagar(aberta)}
        />
      )}
    </div>
  );
}

function VerFoto({
  foto,
  podeApagar,
  onFechar,
  onApagar,
}: {
  foto: Foto;
  podeApagar: boolean;
  onFechar: () => void;
  onApagar: () => void;
}) {
  const [conf, setConf] = useState(false);
  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex flex-col bg-primary">
      <div className="flex items-center justify-between p-3">
        <button
          type="button"
          onClick={onFechar}
          className="tap flex min-h-14 items-center gap-2 px-3 text-lg font-bold text-primary-foreground"
        >
          <X size={28} strokeWidth={2.2} /> Fechar
        </button>
        {podeApagar && (
          <button
            type="button"
            onClick={() => (conf ? onApagar() : setConf(true))}
            className="tap flex min-h-14 items-center gap-2 rounded-xl bg-destructive px-4 text-lg font-bold text-destructive-foreground"
          >
            <Trash2 size={24} strokeWidth={2.2} /> {conf ? "Tem certeza?" : "Apagar"}
          </button>
        )}
      </div>
      <div className="flex flex-1 items-center justify-center p-2">
        {foto.url && <img src={foto.url} alt="" className="max-h-full max-w-full object-contain" />}
      </div>
    </div>
  );
}

/** Câmera ao vivo: toca "Capturar" quantas vezes quiser; "Pronto" fecha. */
function CameraContinua({
  onFoto,
  onFechar,
  total,
}: {
  onFoto: (f: File) => void;
  onFechar: () => void;
  total: number;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let vivo = true;
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
      })
      .then((s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => {
        toast.error("Não consegui abrir a câmera. Use o botão da galeria.");
        onFechar();
      });
    return () => {
      vivo = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function capturar() {
    const v = video.current;
    if (!v || !v.videoWidth) return void toast.error("Aguarde a câmera carregar.");
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (b)
          onFoto(
            new File([b], `foto-${Date.now()}.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            }),
          );
      },
      "image/jpeg",
      0.92,
    );
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-primary">
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        className={`min-h-0 flex-1 object-contain ${flash ? "opacity-30" : ""}`}
      />
      <div className="flex items-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onFechar}
          className="tap flex min-h-16 items-center justify-center rounded-2xl border-2 border-primary-foreground px-5 text-lg font-bold text-primary-foreground"
        >
          Pronto{total ? ` (${total})` : ""}
        </button>
        <button
          type="button"
          onClick={capturar}
          aria-label="Capturar"
          className="tap flex min-h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-foreground text-xl font-bold text-primary"
        >
          <Camera size={30} strokeWidth={2.2} /> Capturar
        </button>
      </div>
    </div>
  );
}
