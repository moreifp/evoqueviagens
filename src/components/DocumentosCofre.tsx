import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, FileLock2, FilePlus2, LockKeyhole, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DestravarCofre } from "@/components/Cofre";
import { CampoPrivado } from "@/components/CampoPrivado";
import { faceIdDisponivel, motivoFalhaBio, rotuloBio } from "@/components/TravaFaceId";
import { ScanFace } from "lucide-react";
import {
  deleteVaultDocument,
  listVaultDocuments,
  lockVault,
  readVaultDocument,
  useVaultUnlocked,
  type VaultDocument,
  type VaultDocumentContents,
  updateVaultDocument,
  cofreFaceIdLigado,
  ligarFaceIdCofre,
} from "@/lib/vault";

const ROTULOS: Record<string, string> = {
  nome_no_documento: "Nome",
  numero: "Número",
  pais_emissor: "País",
  sexo: "Sexo",
  detalhe: "Detalhe 1",
  detalhe2: "Detalhe 2",
  emissao: "Emissão",
  validade: "Validade",
  cvv: "CVV",
  senha: "Senha",
  categoria: "Tipo",
};
const CAMPOS_CARTAO = ["nome_no_documento", "numero", "validade", "cvv", "senha"];
/** Campos editáveis: cartão mostra sempre os 5; outros, os preenchidos + detalhes. */
function camposDe(c: VaultDocumentContents) {
  const f = c.fields as Record<string, string | undefined>;
  const base =
    f.categoria === "Cartão de crédito"
      ? CAMPOS_CARTAO
      : ["nome_no_documento", "numero", "detalhe", "detalhe2"];
  return [...new Set([...base, ...Object.keys(f).filter((k) => f[k])])];
}
const tituloDe = (c: VaultDocumentContents) =>
  c.fields.nome_no_documento ||
  (c.fields.categoria === "Cartão de crédito" && c.fields.numero
    ? `Cartão •••• ${c.fields.numero.replace(/\D/g, "").slice(-4)}`
    : "") ||
  c.fields.detalhe || c.file?.name || "Outro documento";

/** Abre o arquivo em nova aba (a aba nasce no toque, para o iPhone não bloquear). */
async function abrirOriginal(file: NonNullable<VaultDocumentContents["file"]>) {
  const janela = window.open("", "_blank");
  const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
  let blob: Blob;
  if (/\.eml$/i.test(file.name) || file.type === "message/rfc822") {
    const { textoDoEml } = await import("@/lib/emailAgencia");
    const texto = textoDoEml(new TextDecoder().decode(bytes)) || "(e-mail vazio)";
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E-mail</title></head><body style="font-family:-apple-system,sans-serif;font-size:17px;line-height:1.5;max-width:720px;margin:24px auto;padding:0 16px;color:#1c2733;white-space:pre-wrap">${texto.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</body></html>`;
    blob = new Blob([html], { type: "text/html" });
  } else {
    blob = new Blob([bytes], { type: file.type || "application/octet-stream" });
  }
  const url = URL.createObjectURL(blob);
  if (janela) janela.location.href = url;
  else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
}

export function DocumentosCofre({ uid, personId }: { uid: string; personId: string }) {
  const unlocked = useVaultUnlocked(uid);
  const [rows, setRows] = useState<VaultDocument[]>([]);
  const [titulos, setTitulos] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<{
    row: VaultDocument;
    contents: VaultDocumentContents;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [aberto, setAberto] = useState(false);
  const liberado = aberto && unlocked;
  const [bioLigado, setBioLigado] = useState(true);
  useEffect(() => {
    if (!liberado) return;
    void Promise.all([faceIdDisponivel(), cofreFaceIdLigado(uid)]).then(([pode, lig]) => setBioLigado(!pode || lig));
  }, [uid, liberado]);
  async function ligarBio() {
    try {
      await ligarFaceIdCofre(uid);
      setBioLigado(true);
      toast.success(`${rotuloBio()} ligado para o cofre.`);
    } catch (e) {
      console.error("biometria cofre", e);
      toast.error(motivoFalhaBio(e));
    }
  }

  useEffect(() => {
    if (!liberado) {
      setSelected(null);
      setRows([]);
      setTitulos({});
      return;
    }
    let alive = true;
    void listVaultDocuments(uid, personId)
      .then(async (items) => {
        if (!alive) return;
        setRows(items);
        for (const row of items) {
          try {
            const c = await readVaultDocument(uid, row);
            if (!alive) return;
            setTitulos((t) => ({ ...t, [row.id]: tituloDe(c) }));
          } catch {
            /* segue */
          }
        }
      })
      .catch(() => toast.error("Não foi possível abrir os arquivos do cofre."));
    return () => {
      alive = false;
    };
  }, [uid, personId, liberado]);

  function abrirSecao() {
    lockVault();
    setAberto(true);
  }
  function fecharSecao() {
    lockVault();
    setAberto(false);
  }
  async function open(row: VaultDocument) {
    try {
      const contents = await readVaultDocument(uid, row);
      setSelected({ row, contents });
      setEdit({ ...contents.fields } as Record<string, string>);
      setSalvo(false);
    } catch {
      toast.error("Não foi possível abrir o arquivo.");
    }
  }
  const mudou =
    !!selected &&
    camposDe(selected.contents).some(
      (k) => (edit[k] ?? "") !== ((selected.contents.fields as Record<string, string | undefined>)[k] ?? ""),
    );
  const [salvo, setSalvo] = useState(false);
  useEffect(() => {
    if (!salvo) return;
    const t = setTimeout(() => setSalvo(false), 4000);
    return () => clearTimeout(t);
  }, [salvo]);
  async function salvar() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const contents = { ...selected.contents, fields: { ...selected.contents.fields, ...edit } } as VaultDocumentContents;
      const row = await updateVaultDocument(uid, selected.row, contents);
      setRows((old) => old.map((r) => (r.id === row.id ? row : r)));
      setTitulos((t) => ({ ...t, [row.id]: tituloDe(contents) }));
      setSelected({ row, contents });
      setSalvo(true);
      toast.success("Guardado no cofre");
    } catch {
      toast.error("Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!selected || busy || !window.confirm("Apagar este arquivo do cofre?")) return;
    setBusy(true);
    try {
      await deleteVaultDocument(uid, selected.row);
      setRows((old) => old.filter((r) => r.id !== selected.row.id));
      setSelected(null);
      toast.success("Arquivo apagado do cofre");
    } catch {
      toast.error("Não foi possível apagar o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={abrirSecao}
        className="tap flex min-h-14 w-full items-center gap-3 py-3 text-left"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-doc-soft text-doc">
          <LockKeyhole size={24} strokeWidth={2.2} />
        </span>
        <span className="flex-1">
          <strong className="block text-lg">Cofre · arquivos</strong>
          <span className="text-base text-muted-foreground">
            Arquivos cifrados que só você abre
          </span>
        </span>
        <ChevronRight size={26} />
      </button>
    );
  }
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-2xl">
          <LockKeyhole size={26} /> Cofre · arquivos
        </h2>
        <div className="flex items-center gap-2">
          <Link
            to="/pessoas/$pid/documentos/novo"
            params={{ pid: personId }}
            search={{ tipo: "outro", did: "", cofre: "1" }}
            aria-label="Adicionar documento no cofre"
            className="tap flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-doc"
          >
            <FilePlus2 size={22} />
          </Link>
          <Button type="button" variant="outline" onClick={fecharSecao}>
            Trancar
          </Button>
        </div>
      </div>
      {!unlocked ? (
        <DestravarCofre uid={uid} />
      ) : (
        <>
          {!bioLigado && (
            <Button type="button" variant="outline" className="w-full" onClick={() => void ligarBio()}>
              <ScanFace size={22} /> Usar {rotuloBio()} para abrir o cofre
            </Button>
          )}
          {!rows.length && (
            <p className="text-base text-muted-foreground">
              Nenhum arquivo guardado no cofre nesta ficha.
            </p>
          )}
          {rows.map((row) => (
            <div key={row.id} className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => (selected?.row.id === row.id ? setSelected(null) : void open(row))}
                className="w-full justify-start text-left"
              >
                <FileLock2 size={24} /> {titulos[row.id] ?? "Abrindo…"}
              </Button>
              {selected?.row.id === row.id && (
              <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                <h3 className="text-xl font-bold">{tituloDe(selected.contents)}</h3>
                {camposDe(selected.contents).map((key) => (
                  <label key={key} className="block">
                    <span className="text-base text-muted-foreground">{ROTULOS[key] ?? key}</span>
                    {key === "numero" || key === "cvv" ? (
                      <CampoPrivado
                        rotulo={ROTULOS[key] ?? key}
                        numerico
                        value={edit[key] ?? ""}
                        onChange={(t) => { renovarCofre(uid); setEdit((v) => ({ ...v, [key]: t })); }}
                        className="mt-1 min-h-12 w-full rounded-lg border border-border bg-background px-3 text-lg"
                      />
                    ) : (
                    <input
                      value={edit[key] ?? ""}
                      onChange={(e) => { renovarCofre(uid); setEdit((v) => ({ ...v, [key]: e.target.value })); }}
                      disabled={key === "categoria"}
                      autoComplete="off"
                      className="mt-1 min-h-12 w-full rounded-lg border border-border bg-background px-3 text-lg disabled:opacity-70"
                    />
                    )}
                  </label>
                ))}
                {mudou && (
                  <Button type="button" className="w-full" disabled={busy} onClick={() => void salvar()}>
                    <LockKeyhole size={22} /> Salvar no cofre
                  </Button>
                )}
                {salvo && !mudou && (
                  <p className="flex items-center gap-2 text-base text-ok" role="status">
                    <Check size={20} strokeWidth={2.5} /> Salvo no cofre
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {selected.contents.file && (
                    <Button type="button" onClick={() => void abrirOriginal(selected.contents.file!)}>
                      <ExternalLink size={22} /> Abrir arquivo original
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                    Fechar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void remove()}
                  >
                    <Trash2 size={22} /> Apagar
                  </Button>
                </div>
              </div>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
