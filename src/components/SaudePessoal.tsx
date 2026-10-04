import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Form";
import { TirarFoto } from "@/components/ArquivoFoto";
import { comprimir, blobParaDataUrl } from "@/lib/imagem";
import { mutar } from "@/lib/outbox";
import { entradaSaudeSchema, saudeQuery } from "@/lib/saude";

type Tipo = "remedio" | "medico" | "condicao";
const TIPOS: { id: Tipo; nome: string; singular: string }[] = [
  { id: "remedio", nome: "Remédios", singular: "remédio" },
  { id: "medico", nome: "Médicos", singular: "médico" },
  { id: "condicao", nome: "Condições", singular: "condição" },
];

export function SaudePessoal({ personId, owner }: { personId: string; owner: boolean }) {
  const qc = useQueryClient();
  const { data: entradas = [], error, isLoading } = useQuery({ ...saudeQuery(personId), enabled: owner });
  const [tipo, setTipo] = useState<Tipo>("remedio");
  const [nome, setNome] = useState("");
  const [dose, setDose] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const galeria = useRef<HTMLInputElement>(null);
  if (!owner) return <p className="text-muted-foreground">Dados de saúde disponíveis apenas para o titular da ficha.</p>;

  async function escolherFoto(file: File) {
    try {
      if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) throw new Error("Escolha uma imagem.");
      const image = await comprimir(file, 900, 0.7);
      const encoded = await blobParaDataUrl(image);
      if (encoded.length > 1400000) throw new Error("Essa foto é muito grande. Escolha outra.");
      setFoto(encoded);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível abrir a foto."); }
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    const parsed = entradaSaudeSchema.safeParse({ person_id: personId, tipo, nome, dose: tipo === "remedio" ? dose.trim() || null : null, foto_data: tipo === "remedio" ? foto : null });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Confira os dados.");
    setBusy(true);
    try {
      const status = await mutar({ tipo: "insert", tabela: "person_health_entry", valores: { id: crypto.randomUUID(), ...parsed.data } });
      setNome(""); setDose(""); setFoto(null);
      await qc.invalidateQueries({ queryKey: ["saude", personId] });
      toast.success(status === "fila" ? "Sem internet · será salvo quando voltar" : "Salvo");
    } catch { toast.error("Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  async function remover(id: string) {
    if (!window.confirm("Apagar este registro de saúde?")) return;
    try {
      const status = await mutar({ tipo: "update", tabela: "person_health_entry", id, valores: { deleted_at: new Date().toISOString() } });
      qc.setQueryData< typeof entradas >(["saude", personId], (old) => old?.filter((item) => item.id !== id));
      toast.success(status === "fila" ? "Exclusão pendente de conexão" : "Apagado");
    } catch { toast.error("Não foi possível apagar."); }
  }

  const atual = TIPOS.find((item) => item.id === tipo);
  return <div className="space-y-5">
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Dados de saúde">
      {TIPOS.map((item) => <Button key={item.id} type="button" role="tab" aria-selected={tipo === item.id} variant={tipo === item.id ? "default" : "ghost"} size="sm" onClick={() => { setTipo(item.id); setNome(""); setDose(""); setFoto(null); }} className="min-w-0 px-1 text-sm sm:text-base">{item.nome}</Button>)}
    </div>
    <div role="tabpanel" className="space-y-5">
      <form onSubmit={(event) => void salvar(event)} className="space-y-4">
        <Campo rotulo={tipo === "remedio" ? "Nome do remédio" : tipo === "medico" ? "Nome do médico" : "Doença ou condição"}>
          <input className={inputCls} value={nome} onChange={(event) => setNome(event.target.value)} maxLength={160} required autoComplete="off" />
        </Campo>
        {tipo === "remedio" && <>
          <Campo rotulo="Dose"><input className={inputCls} value={dose} onChange={(event) => setDose(event.target.value)} maxLength={160} placeholder="Ex.: 10 mg, duas vezes ao dia" /></Campo>
          <div className="flex flex-wrap gap-2">
            <TirarFoto onFoto={(file) => void escolherFoto(file)} />
            <input ref={galeria} type="file" accept="image/*,.heic,.heif" className="hidden" aria-label="Foto do remédio" onChange={(event) => { const file = event.target.files?.[0]; if (file) void escolherFoto(file); event.target.value = ""; }} />
            <Button type="button" variant="outline" onClick={() => galeria.current?.click()}><ImagePlus size={22} /> Escolher foto</Button>
          </div>
          {foto && <div className="flex items-start gap-3"><img src={foto} alt="Foto do remédio a salvar" className="size-24 rounded border border-border object-cover" /><Button type="button" variant="ghost" size="icon" aria-label="Remover foto" onClick={() => setFoto(null)}><Trash2 size={22} /></Button></div>}
        </>}
        <Button type="submit" disabled={busy} className="w-full"><Plus size={22} /> {busy ? "Salvando…" : `Adicionar ${atual?.singular ?? "registro"}`}</Button>
      </form>
      {error && <p role="alert" className="text-destructive">Não foi possível carregar os dados de saúde.</p>}
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      <ul className="divide-y divide-border border-t border-border">
        {entradas.filter((item) => item.tipo === tipo).map((item) => <li key={item.id} className="flex items-center gap-3 py-3">
          {item.foto_data ? <img src={item.foto_data} alt={`Foto de ${item.nome}`} className="size-16 shrink-0 rounded border border-border object-cover" /> : tipo === "remedio" ? <Camera size={24} className="shrink-0 text-muted-foreground" aria-hidden /> : null}
          <div className="min-w-0 flex-1"><strong className="block break-words text-lg">{item.nome}</strong>{item.dose && <span className="text-muted-foreground">{item.dose}</span>}</div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Apagar ${item.nome}`} onClick={() => void remover(item.id)}><Trash2 size={22} /></Button>
        </li>)}
      </ul>
    </div>
  </div>;
}