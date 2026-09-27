import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarPessoa } from "./Pessoa";
import { euQuery, minhaPessoaQuery, statusDocumento, type EuDocumento, type EuPessoa } from "@/lib/eu";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Item = { id: string; nome: string; foto: string | null; self: boolean; alerta: "danger" | "warn" | null };

function alertaDe(docs: EuDocumento[] | undefined): Item["alerta"] {
  const tons = (docs ?? []).map((d) => statusDocumento(d).tone);
  return tons.includes("danger") ? "danger" : tons.includes("warn") ? "warn" : null;
}

export function BarraPessoas({ atualId, onAdicionar }: { atualId: string; onAdicionar: () => void }) {
  const { data: eu } = useQuery(minhaPessoaQuery());
  const { data: meus } = useQuery({ ...euQuery(eu?.id ?? ""), enabled: Boolean(eu) });
  const donos = [...new Set((meus?.compartilhamentos ?? []).filter((g) => g.grantee_id === meus?.uid).map((g) => g.owner_id))];
  const { data: comigo = [] } = useQuery({
    queryKey: ["barra-pessoas", donos.join(",")],
    networkMode: "offlineFirst",
    enabled: donos.length > 0,
    queryFn: async () => {
      const { data } = await db.from("person").select("id,nome,apelido,foto_url,account_id").in("account_id", donos).eq("kind", "self").is("deleted_at", null);
      return (data ?? []) as EuPessoa[];
    },
  });
  if (!eu || !meus) return null;
  const itens: Item[] = [
    { id: eu.id, nome: "Eu", foto: eu.foto_url, self: true, alerta: alertaDe(meus.documentos) },
    ...meus.dependentes.map((d) => ({ id: d.id, nome: d.apelido || d.nome, foto: d.foto_url, self: false, alerta: alertaDe(meus.documentosDependentes[d.id]) })),
    ...[...comigo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((d) => ({ id: d.id, nome: d.apelido || d.nome, foto: d.foto_url, self: false, alerta: null })),
  ];
  if (itens.length < 2) return null;
  return (
    <nav aria-label="Pessoas" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {itens.map((it) => {
        const ativo = it.id === atualId;
        const corpo = (
          <>
            <span className={`relative rounded-full p-0.5 ${ativo ? "ring-4 ring-success" : ""}`}>
              <AvatarPessoa nome={it.self ? eu.nome : it.nome} foto={it.foto} tamanho={56} />
              {it.alerta && <span aria-label={it.alerta === "danger" ? "Documento vencido" : "Documento vencendo"} className={`absolute right-0 top-0 h-4 w-4 rounded-full border-2 border-background ${it.alerta === "danger" ? "bg-destructive" : "bg-warning"}`} />}
            </span>
            <span className={`max-w-[72px] truncate text-sm ${ativo ? "font-bold" : ""}`}>{it.nome.split(" ")[0]}</span>
          </>
        );
        const cls = "flex shrink-0 flex-col items-center gap-1";
        return it.self
          ? <Link key={it.id} to="/" className={cls} aria-current={ativo ? "page" : undefined}>{corpo}</Link>
          : <Link key={it.id} to="/pessoas/$pid" params={{ pid: it.id }} className={cls} aria-current={ativo ? "page" : undefined}>{corpo}</Link>;
      })}
      <button onClick={onAdicionar} aria-label="Adicionar dependente" className="flex shrink-0 flex-col items-center gap-1">
        <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 border-dashed border-border"><Plus size={24} strokeWidth={2.2} /></span>
        <span className="text-sm text-muted-foreground">Dependente</span>
      </button>
    </nav>
  );
}
