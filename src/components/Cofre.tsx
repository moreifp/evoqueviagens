import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Campo, inputCls } from "@/components/Form";
import { CampoPrivado } from "@/components/CampoPrivado";
import { KeyRound, ScanFace } from "lucide-react";
import { changeVaultPassword, createVault, unlockVault, vaultExists, cofreFaceIdLigado, unlockVaultFaceId, ligarFaceIdCofre, SENHA_COFRE_MINIMO } from "@/lib/vault";
import { faceIdDisponivel, rotuloBio } from "@/components/TravaFaceId";

/**
 * Campo de senha do cofre que o Apple Senhas, o Google Senhas e outros gerenciadores
 * não preenchem nem guardam: não é um <input> (o iPhone oferecia a senha do site
 * guardada no Google, que nada tem a ver com o cofre). Letras viram bolinhas.
 */
function SenhaCofre({ rotulo, value, onChange, onEnter }: { rotulo: string; value: string; onChange: (v: string) => void; onEnter?: () => void }) {
  return <CampoPrivado rotulo={rotulo} oculto value={value} onChange={onChange} onEnter={onEnter} className={inputCls} />;
}

/** Formulário para criar ou destravar o cofre. Usa div (não form) para poder ficar dentro de outros formulários. */
export function DestravarCofre({ uid }: { uid: string }) {
  const [exists, setExists] = useState<boolean | null>(null);
  const [setup, setSetup] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState(false);
  const [podeBio, setPodeBio] = useState(false);
  useEffect(() => {
    void cofreFaceIdLigado(uid).then(setBio);
    void faceIdDisponivel().then(setPodeBio);
  }, [uid]);
  async function comRosto() {
    setBusy(true);
    try {
      await unlockVaultFaceId(uid);
    } catch (e) {
      const m = (e as Error).message;
      if (m.startsWith("Use")) setBio(false);
      toast.error(m.startsWith("Use") ? m : "Não foi possível confirmar. Tente de novo ou use a senha.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void vaultExists(uid)
      .then(setExists)
      .catch(() => setExists(null));
  }, [uid]);

  async function go() {
    if (setup && pw.length < SENHA_COFRE_MINIMO)
      return toast.error(`A senha do cofre precisa ter pelo menos ${SENHA_COFRE_MINIMO} caracteres.`);
    if (!pw) return;
    setBusy(true);
    try {
      if (setup) {
        if (pw !== confirm) throw new Error("As senhas não coincidem.");
        await createVault(uid, pw);
        setExists(true);
      } else await unlockVault(uid, pw);
      // Face ID do cofre é por aparelho e só liga com o cofre aberto: tenta ligar já,
      // para a próxima vez abrir com o rosto (se o iPhone recusar, o botão aparece no cofre).
      if (podeBio && !bio) void ligarFaceIdCofre(uid).catch(() => undefined);
      setPw("");
      setConfirm("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (exists === null)
    return <p className="mt-4 text-lg text-muted-foreground">Verificando o cofre…</p>;
  if (exists === false && !setup)
    return (
      <button
        type="button"
        onClick={() => setSetup(true)}
        className="tap mt-4 w-full rounded-lg border-2 border-border text-lg font-bold"
      >
        Criar meu cofre
      </button>
    );
  return (
    <div className="mt-4 space-y-3">
      {bio && !setup && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void comRosto()}
          className="tap flex w-full items-center justify-center gap-3 rounded-lg bg-primary text-lg font-bold text-primary-foreground"
        >
          <ScanFace size={26} aria-hidden /> Abrir com {rotuloBio()}
        </button>
      )}
      {!bio && podeBio && !setup && (
        <p className="flex items-center gap-2 text-base text-muted-foreground">
          <ScanFace size={22} aria-hidden /> Abra uma vez com a senha para ligar o {rotuloBio()} neste aparelho.
        </p>
      )}
      <Campo rotulo={setup ? "Crie a senha do cofre" : "Senha do cofre"}>
        <SenhaCofre rotulo={setup ? "Crie a senha do cofre" : "Senha do cofre"} value={pw} onChange={setPw} onEnter={() => void go()} />
      </Campo>
      {setup && (
        <>
          <Campo rotulo="Confirme a senha">
            <SenhaCofre rotulo="Confirme a senha" value={confirm} onChange={setConfirm} onEnter={() => void go()} />
          </Campo>
          <p className="text-base font-bold text-warn">
            Se esquecer, as senhas guardadas não podem ser recuperadas.
          </p>
        </>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void go()}
        className="tap w-full rounded-lg bg-primary text-lg font-bold text-primary-foreground"
      >
        {busy ? "Abrindo…" : setup ? "Criar e destravar" : "Destravar cofre"}
      </button>
    </div>
  );
}


/** Trocar a senha do cofre: um botão; ao tocar, abre os três campos. Recifra tudo no aparelho. */
export function TrocarSenhaCofre({ uid }: { uid: string }) {
  const [aberto, setAberto] = useState(false);
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);
  function fechar() {
    setAberto(false);
    setNova("");
    setConfirma("");
  }
  async function trocar() {
    if (nova !== confirma) return toast.error("As senhas novas não coincidem.");
    setBusy(true);
    try {
      await changeVaultPassword(uid, nova);
      toast.success("Senha do cofre trocada");
      fechar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!aberto)
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="tap flex w-full items-center justify-center gap-3 rounded-lg border-2 border-border text-lg font-bold"
      >
        <KeyRound size={24} aria-hidden /> Trocar senha do cofre
      </button>
    );
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <Campo rotulo={`Senha nova (mín. ${SENHA_COFRE_MINIMO})`}>
        <SenhaCofre rotulo="Senha nova" value={nova} onChange={setNova} />
      </Campo>
      <Campo rotulo="Repita a senha nova">
        <SenhaCofre rotulo="Repita a senha nova" value={confirma} onChange={setConfirma} onEnter={() => void trocar()} />
      </Campo>
      <p className="text-base font-bold text-warn">Guarde a senha nova: se esquecer, o cofre não pode ser recuperado.</p>
      <button
        type="button"
        disabled={busy || !nova || !confirma}
        onClick={() => void trocar()}
        className="tap w-full rounded-lg bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Trocando…" : "Trocar senha"}
      </button>
      <button type="button" disabled={busy} onClick={fechar} className="tap w-full rounded-lg border-2 border-border text-lg font-bold">
        Cancelar
      </button>
    </div>
  );
}
