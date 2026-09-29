import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Campo, inputCls } from "@/components/Form";
import { createVault, unlockVault, vaultExists } from "@/lib/vault";

/** Formulário para criar ou destravar o cofre. Usa div (não form) para poder ficar dentro de outros formulários. */
export function DestravarCofre({ uid }: { uid: string }) {
  const [exists, setExists] = useState<boolean | null>(null);
  const [setup, setSetup] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void vaultExists(uid)
      .then(setExists)
      .catch(() => setExists(null));
  }, [uid]);

  async function go() {
    if (pw.length < 8) return toast.error("A senha do cofre precisa ter pelo menos 8 caracteres.");
    setBusy(true);
    try {
      if (setup) {
        if (pw !== confirm) throw new Error("As senhas não coincidem.");
        await createVault(uid, pw);
        setExists(true);
      } else await unlockVault(uid, pw);
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
      <Campo rotulo={setup ? "Crie a senha do cofre" : "Senha do cofre"}>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void go();
            }
          }}
          autoComplete={setup ? "new-password" : "current-password"}
          className={inputCls}
        />
      </Campo>
      {setup && (
        <>
          <Campo rotulo="Confirme a senha">
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={inputCls}
            />
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
