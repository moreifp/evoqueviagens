import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Topo } from "@/components/Chrome";
import { Campo, inputCls } from "@/components/Form";
import { euQuery } from "@/lib/eu";
import { mutar } from "@/lib/outbox";

export const Route = createFileRoute("/pessoas/$pid/dados")({
  validateSearch: (search: Record<string, unknown>) => ({ secao: typeof search.secao === "string" ? search.secao : "pessoais" }),
  head: () => ({ meta: [
    { title: "Mais sobre você — Evoque Viagens" },
    { name: "description", content: "Dados pessoais, preferências e contato de emergência." },
    { property: "og:title", content: "Mais sobre você — Evoque Viagens" },
    { property: "og:description", content: "Dados pessoais para suas viagens." },
  ] }),
  component: Dados,
});

function Dados() {
  const { pid } = Route.useParams();
  const { secao } = Route.useSearch();
  const qc = useQueryClient();
  const { data } = useQuery(euQuery(pid));
  const [saving, setSaving] = useState(false);
  if (!data) return <p className="p-6 text-lg">Carregando…</p>;
  const owner = data.pessoa.account_id === data.uid;
  const p = data.pessoa;

  async function savePerson(form: FormData) {
    if (!owner) return;
    setSaving(true);
    const fields = ["nome", "cpf", "data_nascimento", "sexo", "telefone", "email", "endereco", "emergencia_nome", "emergencia_parentesco", "emergencia_telefone"];
    const values: Record<string, unknown> = {};
    for (const field of fields) if (form.has(field)) values[field] = String(form.get(field) ?? "").trim() || null;
    if (form.has("nacionalidades")) values.nacionalidades = String(form.get("nacionalidades") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    await mutar({ tipo: "update", tabela: "person", id: pid, valores: values });
    await qc.invalidateQueries({ queryKey: ["eu", pid] });
    setSaving(false); toast.success("Dados salvos");
  }

  async function savePrefs(form: FormData) {
    if (!owner) return;
    setSaving(true);
    const values = { person_id: pid, assento: String(form.get("assento") || "") || null, quarto: String(form.get("quarto") || "") || null, refeicao_voo: String(form.get("refeicao_voo") || "") || null, bebe_alcool: form.get("bebe_alcool") === "sim" ? true : form.get("bebe_alcool") === "nao" ? false : null, restricoes: String(form.get("restricoes") || "").split(",").map((x) => x.trim()).filter(Boolean) };
    await mutar({ tipo: "upsert", tabela: "person_preferences", valores: values, onConflict: "person_id" });
    await qc.invalidateQueries({ queryKey: ["eu", pid] }); setSaving(false); toast.success("Preferências salvas");
  }

  return <div className="min-h-screen bg-background pb-24"><Topo titulo={secao === "preferencias" ? "Preferências" : secao === "emergencia" ? "Contato de emergência" : "Dados pessoais"} voltarPara="/pessoas/$pid" voltarParams={{ pid }} /><main className="mx-auto max-w-xl px-4 pt-5">
    {!owner && <p className="mb-4 rounded-lg border border-border p-3 text-lg">Somente leitura</p>}
    {secao === "preferencias" ? <form action={(fd) => void savePrefs(fd)} className="space-y-4">
      <Campo rotulo="Assento"><select name="assento" defaultValue={data.preferencias?.assento ?? ""} disabled={!owner} className={inputCls}><option value="">Escolha</option><option value="janela">Janela</option><option value="corredor">Corredor</option><option value="tanto_faz">Tanto faz</option></select></Campo>
      <Campo rotulo="Quarto"><select name="quarto" defaultValue={data.preferencias?.quarto ?? ""} disabled={!owner} className={inputCls}><option value="">Escolha</option><option value="casal">Casal</option><option value="duas_camas">Duas camas</option><option value="tanto_faz">Tanto faz</option></select></Campo>
      <Campo rotulo="Restrições alimentares"><input name="restricoes" defaultValue={data.preferencias?.restricoes.join(", ") ?? ""} disabled={!owner} className={inputCls} /></Campo>
      <Campo rotulo="Refeição especial no voo"><input name="refeicao_voo" defaultValue={data.preferencias?.refeicao_voo ?? ""} disabled={!owner} className={inputCls} /></Campo>
      <Campo rotulo="Bebe álcool?"><select name="bebe_alcool" defaultValue={data.preferencias?.bebe_alcool == null ? "" : data.preferencias.bebe_alcool ? "sim" : "nao"} disabled={!owner} className={inputCls}><option value="">Não informado</option><option value="sim">Sim</option><option value="nao">Não</option></select></Campo>
      {owner && <button disabled={saving} className="gradient-hero tap w-full rounded-lg text-lg font-bold">Salvar</button>}
    </form> : <form action={(fd) => void savePerson(fd)} className="space-y-4">
      {(secao === "emergencia" ? [["emergencia_nome", "Nome", "text"], ["emergencia_parentesco", "Parentesco", "text"], ["emergencia_telefone", "Telefone", "tel"]] : [["nome", "Nome completo", "text"], ["cpf", "CPF", "text"], ["data_nascimento", "Nascimento", "date"], ["sexo", "Sexo", "text"], ["nacionalidades", "Nacionalidades, separadas por vírgula", "text"], ["telefone", "Telefone", "tel"], ["email", "E-mail", "email"], ["endereco", "Endereço", "text"]] as [string, string, string][]).map(([key, label, type]) => <Campo key={key} rotulo={label}><input name={key} type={type} defaultValue={key === "nacionalidades" ? p.nacionalidades.join(", ") : String(p[key as keyof typeof p] ?? "")} disabled={!owner} className={inputCls} /></Campo>)}
      {owner && <button disabled={saving} className="gradient-hero tap w-full rounded-lg text-lg font-bold">Salvar</button>}
    </form>}
  </main></div>;
}