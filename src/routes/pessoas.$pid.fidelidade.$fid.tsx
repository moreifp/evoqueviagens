import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, Eye, EyeOff, ImagePlus, LockKeyhole, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Topo } from "@/components/Chrome";
import { Campo, inputCls } from "@/components/Form";
import { dataBR } from "@/components/FichaPartes";
import { ACEITA_FOTO, TirarFoto, ZonaArquivo } from "@/components/ArquivoFoto";
import { DestravarCofre } from "@/components/Cofre";
import { euQuery } from "@/lib/eu";
import { readVaultItem, removeVaultItem, saveVaultItem, useVaultUnlocked } from "@/lib/vault";
import { prepararArquivo } from "@/lib/imagem";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pessoas/$pid/fidelidade/$fid")({ head: () => ({ meta: [
  { title: "Programa de fidelidade — Evoque Viagens" }, { name: "description", content: "Cartão, categoria e acesso guardado no cofre." },
  { property: "og:title", content: "Programa de fidelidade — Evoque Viagens" }, { property: "og:description", content: "Seu programa e seu cofre pessoal." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
] }), component: Programa });

// Remoções do cofre adiadas até o prazo de "Desfazer" passar (sobrevivem à troca de tela).
const pendentes = new Map<string, ReturnType<typeof setTimeout>>();

type Segredo = { login: string; password: string };

function Programa() {
  const { pid, fid } = Route.useParams(); const nav = useNavigate(); const qc = useQueryClient(); const { data } = useQuery(euQuery(pid));
  const [secret, setSecret] = useState<Segredo | null | undefined>(undefined);
  const [editing, setEditing] = useState(false); const [show, setShow] = useState(false); const [saving, setSaving] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false); const [cardUrl, setCardUrl] = useState<string | null>(null);
  // Cada programa destrava só o seu próprio acesso: nada de abrir/fechar todos de uma vez.
  const [revealed, setRevealed] = useState(false);
  const item = data?.fidelidades.find((x) => x.id === fid); const owner = !!data && data.pessoa.account_id === data.uid;
  const unlocked = useVaultUnlocked(owner ? data?.uid : undefined);

  useEffect(() => {
    setSecret(undefined); setShow(false); setRevealed(false);
  }, [fid]);
  useEffect(() => {
    setSecret(undefined); setShow(false);
    if (!revealed || !unlocked || !data) { setEditing(false); return; }
    let vivo = true;
    readVaultItem(data.uid, fid).then((s) => { if (vivo) { setSecret(s); if (!s) setEditing(true); } }).catch((e) => { if (vivo) { toast.error((e as Error).message); setSecret(null); } });
    return () => { vivo = false; };
  }, [unlocked, data?.uid, fid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!item?.cartao_path || !navigator.onLine) return; void supabase.storage.from("documentos").createSignedUrl(item.cartao_path, 600).then(({ data: s }) => setCardUrl(s?.signedUrl ?? null)); }, [item?.cartao_path]);
  useEffect(() => { if (!show) return; const t = setTimeout(() => setShow(false), 30000); return () => clearTimeout(t); }, [show]);

  if (!data || !item) return <p className="p-6 text-lg">Carregando…</p>;
  const copy = (value: string | null | undefined) => { if (!value) return; void navigator.clipboard.writeText(value); toast.success("Copiado"); };

  async function saveSecret(fd: FormData) {
    if (!data) return;
    const login = String(fd.get("login") || ""), password = String(fd.get("password") || "");
    if (!login && !password && secret && !confirmEmpty) { setConfirmEmpty(true); return; }
    setSaving(true);
    try {
      const r = await saveVaultItem(data.uid, fid, login, password);
      setSecret({ login, password }); setEditing(false); setConfirmEmpty(false);
      toast.success(r.localOnly ? "Sem internet · salvo no aparelho. Sobe quando a conexão voltar." : "Cofre atualizado");
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function addCard(file: File) { try { const prep = await prepararArquivo(file); if (prep.ext === "pdf") throw new Error(); const path = `${pid}/loyalty/${fid}/${crypto.randomUUID()}.${prep.ext}`; const up = await supabase.storage.from("documentos").upload(path, prep.blob, { contentType: prep.contentType }); if (up.error) throw up.error; const u = await supabase.from("loyalty_account").update({ cartao_path: path }).eq("id", fid); if (u.error) throw u.error; setCardUrl(null); await qc.invalidateQueries({ queryKey: ["eu", pid] }); toast.success(item?.cartao_path ? "Foto do cartão trocada" : "Foto do cartão salva"); } catch { toast.error("Não foi possível salvar a foto."); } }
  async function removeCard() {
    const antigo = item?.cartao_path; if (!antigo) return;
    const { error } = await supabase.from("loyalty_account").update({ cartao_path: null }).eq("id", fid);
    if (error) return toast.error("Não foi possível tirar a foto.");
    setCardUrl(null); await qc.invalidateQueries({ queryKey: ["eu", pid] });
    toast("Foto do cartão removida", { duration: 10_000, action: { label: "Desfazer", onClick: async () => { await supabase.from("loyalty_account").update({ cartao_path: antigo }).eq("id", fid); await qc.invalidateQueries({ queryKey: ["eu", pid] }); } } });
  }
  async function remove() {
    if (!data) return; const uid = data.uid;
    const { error } = await supabase.from("loyalty_account").update({ deleted_at: new Date().toISOString() }).eq("id", fid);
    if (error) return toast.error("Não foi possível apagar.");
    pendentes.set(fid, setTimeout(() => { pendentes.delete(fid); void removeVaultItem(uid, fid); }, 10_000));
    await qc.invalidateQueries({ queryKey: ["eu", pid] });
    toast(`${item!.programa} apagado`, { duration: 10_000, action: { label: "Desfazer", onClick: async () => {
      const t = pendentes.get(fid); if (t) clearTimeout(t); pendentes.delete(fid);
      await supabase.from("loyalty_account").update({ deleted_at: null }).eq("id", fid);
      await qc.invalidateQueries({ queryKey: ["eu", pid] }); toast.success("Programa restaurado");
    } } });
    nav({ to: "/pessoas/$pid/fidelidade", params: { pid } });
  }

  return <div className="min-h-screen bg-background pb-20"><Topo titulo={item.programa} voltarPara="/pessoas/$pid/fidelidade" voltarParams={{ pid }} /><main className="mx-auto max-w-xl space-y-5 px-4 pt-5">
    <section className="rounded-lg bg-primary p-5 text-primary-foreground shadow-medium"><div className="flex justify-between text-base font-bold"><span>CARTÃO FIDELIDADE</span>{item.categoria && <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{item.categoria}</span>}</div><h2 className="mt-6 text-2xl">{item.programa}</h2><div className="mt-4 flex items-center gap-2"><span className="mono-code min-w-0 flex-1 break-all text-xl">{item.numero || "Sem número"}</span><button onClick={() => copy(item.numero)} aria-label="Copiar número" className="tap"><Copy size={25} /></button></div><p className="mt-3 text-base">{item.titular || data.pessoa.nome}</p></section>
    {item.expira_em && (() => { const hoje = new Date().toISOString().slice(0, 10); const vencido = item.expira_em < hoje; const perto = !vencido && item.expira_em <= new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10); return <p className={`rounded-lg border-2 p-4 text-lg font-bold ${vencido ? "border-danger text-danger" : perto ? "border-warn text-warn" : "border-border text-muted-foreground"}`}>{vencido ? "Venceu em " : "Vence em "}{dataBR(item.expira_em)}{vencido ? " · renove ou use os pontos" : perto ? " · está perto" : ""}</p>; })()}
    {item.cartao_path && cardUrl && <img src={cardUrl} alt="Foto do cartão" className="max-h-64 w-full rounded-lg object-contain" />}
    {owner && item.cartao_path && <button onClick={() => void removeCard()} className="tap flex w-full items-center justify-center gap-2 rounded-lg border-2 border-destructive text-lg font-bold text-destructive"><Trash2 size={24} /> Tirar foto do cartão</button>}
    {item.site_url && <a href={item.site_url} target="_blank" rel="noreferrer" className="tap flex items-center justify-center gap-2 rounded-lg border-2 border-border text-lg font-bold">Abrir o site do programa <ExternalLink size={24} /></a>}
    {owner && <section className="rounded-lg border-2 border-border bg-card p-4"><h2 className="flex items-center gap-2 text-2xl"><LockKeyhole size={28} /> Cofre · acesso ao site</h2>
      {!unlocked && <DestravarCofre uid={data.uid} />}
      {unlocked && secret === undefined && <p className="mt-4 text-lg text-muted-foreground">Abrindo…</p>}
      {unlocked && secret !== undefined && !editing && secret && <div className="mt-4 space-y-3">
        <Campo rotulo="Login"><div className="flex items-center gap-2"><span className="min-w-0 flex-1 break-all rounded-lg bg-muted px-4 py-3 text-lg">{secret.login || "—"}</span><button type="button" onClick={() => copy(secret.login)} aria-label="Copiar login" className="tap"><Copy size={24} /></button></div></Campo>
        <Campo rotulo="Senha"><div className="flex items-center gap-2"><span className="mono-code min-w-0 flex-1 break-all rounded-lg bg-muted px-4 py-3 text-lg">{secret.password ? (show ? secret.password : "••••••••") : "—"}</span><button type="button" onClick={() => setShow((x) => !x)} aria-label={show ? "Esconder senha" : "Mostrar senha"} className="tap">{show ? <EyeOff size={24} /> : <Eye size={24} />}</button><button type="button" onClick={() => copy(secret.password)} aria-label="Copiar senha" className="tap"><Copy size={24} /></button></div></Campo>
        <button type="button" onClick={() => setEditing(true)} className="tap flex w-full items-center justify-center gap-2 rounded-lg border-2 border-border text-lg font-bold"><Pencil size={24} /> Editar acesso</button>
      </div>}
      {unlocked && secret !== undefined && editing && <form key={secret ? "e" : "n"} action={(fd) => void saveSecret(fd)} className="mt-4 space-y-3">
        <Campo rotulo="Login"><input name="login" defaultValue={secret?.login ?? ""} autoComplete="off" className={inputCls} /></Campo>
        <Campo rotulo="Senha"><div className="flex gap-2"><input name="password" type={show ? "text" : "password"} defaultValue={secret?.password ?? ""} autoComplete="new-password" className={inputCls} /><button type="button" onClick={() => setShow((x) => !x)} aria-label="Mostrar senha" className="tap">{show ? <EyeOff size={24} /> : <Eye size={24} />}</button></div></Campo>
        {confirmEmpty && <p className="text-base font-bold text-warn">Os dois campos estão vazios. Toque em "Salvar" de novo para apagar o acesso guardado.</p>}
        <div className="flex gap-2"><button disabled={saving} className="tap flex-[2] rounded-lg bg-primary text-lg font-bold text-primary-foreground">{saving ? "Salvando…" : "Salvar no cofre"}</button>{secret && <button type="button" onClick={() => { setEditing(false); setConfirmEmpty(false); }} className="tap flex-1 rounded-lg border-2 border-border text-lg font-bold">Cancelar</button>}</div>
      </form>}
      <p className="mt-4 text-base text-muted-foreground">A senha é cifrada no seu aparelho com a sua senha do cofre. Nem o Evoque consegue ler. Ela nunca entra em compartilhamento.</p></section>}
    {owner && <><div className="grid grid-cols-2 gap-2"><ZonaArquivo aceita={ACEITA_FOTO} onArquivo={(f) => void addCard(f)} className="tap flex items-center justify-center gap-2 rounded-lg border-2 border-border text-lg font-bold"><ImagePlus size={25} /> {item.cartao_path ? "Trocar foto" : "Foto do cartão"}</ZonaArquivo><TirarFoto onFoto={(f) => void addCard(f)} /></div><div className="grid grid-cols-2 gap-2"><Link to="/pessoas/$pid/fidelidade/novo" params={{ pid }} search={{ editar: fid }} className="tap flex items-center justify-center gap-2 rounded-lg border-2 border-border text-lg font-bold"><Pencil size={24} /> Editar</Link><button onClick={() => void remove()} className="tap flex items-center justify-center gap-2 rounded-lg border-2 border-destructive text-lg font-bold text-destructive"><Trash2 size={24} /> Apagar</button></div></>}
  </main></div>;
}
