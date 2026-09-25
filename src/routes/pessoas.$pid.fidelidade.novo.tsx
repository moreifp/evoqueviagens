import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Topo } from "@/components/Chrome";
import { Campo, inputCls } from "@/components/Form";
import { DestravarCofre } from "@/components/Cofre";
import { euQuery } from "@/lib/eu";
import { PROGRAMAS_COMUNS } from "@/lib/programas";
import { saveVaultItem, useVaultUnlocked } from "@/lib/vault";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pessoas/$pid/fidelidade/novo")({
  validateSearch: (s: Record<string, unknown>): { editar?: string } => ({ editar: typeof s.editar === "string" ? s.editar : undefined }),
  head: () => ({ meta: [
    { title: "Programa de fidelidade — Evoque Viagens" }, { name: "description", content: "Adicione ou edite um programa de fidelidade." },
    { property: "og:title", content: "Programa de fidelidade — Evoque Viagens" }, { property: "og:description", content: "Cadastre seu programa de fidelidade." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Novo,
});

function Novo() {
  const { pid } = Route.useParams(); const { editar } = Route.useSearch();
  const nav = useNavigate(); const qc = useQueryClient(); const { data } = useQuery(euQuery(pid));
  const atual = editar ? data?.fidelidades.find((x) => x.id === editar) : undefined;
  const [f, setF] = useState({ programa: "", tipo: "aerea", numero: "", categoria: "", titular: "", site_url: "" });
  const [loaded, setLoaded] = useState(!editar);
  const [cofre, setCofre] = useState(false); const [login, setLogin] = useState(""); const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const unlocked = useVaultUnlocked(data?.uid);

  useEffect(() => {
    if (atual && !loaded) {
      setF({ programa: atual.programa, tipo: atual.tipo, numero: atual.numero ?? "", categoria: atual.categoria ?? "", titular: atual.titular ?? "", site_url: atual.site_url ?? "" });
      setLoaded(true);
    }
  }, [atual, loaded]);

  function setPrograma(v: string) {
    const c = PROGRAMAS_COMUNS.find((p) => p.nome.toLowerCase() === v.trim().toLowerCase());
    setF((o) => ({ ...o, programa: v, ...(c ? { tipo: c.tipo, site_url: o.site_url || c.site } : {}) }));
  }

  if (!data || !loaded) return <p className="p-6 text-lg">Carregando…</p>;
  if (editar && !atual) return <p className="p-6 text-lg">Programa não encontrado.</p>;

  async function save() {
    if (!data || data.pessoa.account_id !== data.uid) return;
    if (!f.programa.trim()) return toast.error("Digite o nome do programa.");
    setSaving(true);
    const valores = { programa: f.programa.trim(), tipo: f.tipo, numero: f.numero.trim() || null, categoria: f.categoria.trim() || null, titular: f.titular.trim() || null, site_url: f.site_url.trim() || null };
    let id = editar;
    if (atual) {
      // Só envia o que mudou.
      const mud = Object.fromEntries(Object.entries(valores).filter(([k, v]) => (atual as Record<string, unknown>)[k] !== v));
      if (Object.keys(mud).length) { const { error } = await supabase.from("loyalty_account").update(mud).eq("id", atual.id); if (error) { toast.error("Não foi possível salvar."); setSaving(false); return; } }
    } else {
      id = crypto.randomUUID();
      const { error } = await supabase.from("loyalty_account").insert({ id, person_id: pid, ...valores });
      if (error) { toast.error("Não foi possível salvar."); setSaving(false); return; }
    }
    if (cofre && unlocked && (login || senha)) {
      try { const r = await saveVaultItem(data.uid, id!, login, senha); if (r.localOnly) toast("Sem internet · senha salva no aparelho"); }
      catch (e) { toast.error((e as Error).message); }
    }
    await qc.invalidateQueries({ queryKey: ["eu", pid] });
    toast.success(atual ? "Programa atualizado" : "Programa salvo");
    nav({ to: "/pessoas/$pid/fidelidade/$fid", params: { pid, fid: id! }, replace: true });
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((o) => ({ ...o, [k]: e.target.value }));
  return <div className="min-h-screen bg-background pb-20"><Topo titulo={atual ? "Editar programa" : "Novo programa"} voltarPara="/pessoas/$pid/fidelidade" voltarParams={{ pid }} />
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="mx-auto max-w-xl space-y-4 px-4 pt-5">
      <Campo rotulo="Programa"><input required list="programas-comuns" value={f.programa} onChange={(e) => setPrograma(e.target.value)} placeholder="Ex.: LATAM Pass, Smiles…" className={inputCls} /><datalist id="programas-comuns">{PROGRAMAS_COMUNS.map((p) => <option key={p.nome} value={p.nome} />)}</datalist></Campo>
      <Campo rotulo="Tipo"><select value={f.tipo} onChange={set("tipo")} className={inputCls}><option value="aerea">Aérea</option><option value="hotel">Hotel</option><option value="locadora">Locadora</option><option value="sala_vip">Sala VIP</option><option value="outro">Outro</option></select></Campo>
      <Campo rotulo="Número"><input value={f.numero} onChange={set("numero")} className={`${inputCls} mono-code`} /></Campo>
      <Campo rotulo="Categoria"><input value={f.categoria} onChange={set("categoria")} placeholder="Gold, Platinum…" className={inputCls} /></Campo>
      <Campo rotulo="Nome do titular"><input value={f.titular} onChange={set("titular")} className={inputCls} /></Campo>
      <Campo rotulo="Site do programa"><input type="url" value={f.site_url} onChange={set("site_url")} className={inputCls} /></Campo>
      {!atual && <section className="rounded-lg border-2 border-border bg-card p-4">
        <label className="tap flex items-center gap-3 text-lg font-bold"><input type="checkbox" checked={cofre} onChange={(e) => setCofre(e.target.checked)} className="h-7 w-7" /><LockKeyhole size={26} /> Guardar login e senha no cofre (opcional)</label>
        {cofre && !unlocked && <DestravarCofre uid={data.uid} />}
        {cofre && unlocked && <div className="mt-4 space-y-3">
          <Campo rotulo="Login"><input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="off" className={inputCls} /></Campo>
          <Campo rotulo="Senha"><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" className={inputCls} /></Campo>
          <p className="text-base text-muted-foreground">Cifrada no seu aparelho. Nunca entra em compartilhamento.</p>
        </div>}
      </section>}
      <button disabled={saving} className="gradient-hero tap w-full rounded-lg text-lg font-bold">{saving ? "Salvando…" : atual ? "Salvar alterações" : "Salvar programa"}</button>
    </form></div>;
}
