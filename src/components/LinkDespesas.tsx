import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mutar } from "@/lib/outbox";
import { useUid } from "@/lib/despesas";
import { Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const PAISES = [
  { codigo: "55", nome: "Brasil" },
  { codigo: "1", nome: "EUA / Canadá" },
  { codigo: "351", nome: "Portugal" },
  { codigo: "54", nome: "Argentina" },
  { codigo: "56", nome: "Chile" },
  { codigo: "598", nome: "Uruguai" },
  { codigo: "595", nome: "Paraguai" },
  { codigo: "57", nome: "Colômbia" },
  { codigo: "52", nome: "México" },
  { codigo: "27", nome: "África do Sul" },
  { codigo: "44", nome: "Reino Unido" },
  { codigo: "34", nome: "Espanha" },
  { codigo: "33", nome: "França" },
  { codigo: "49", nome: "Alemanha" },
  { codigo: "39", nome: "Itália" },
] as const;

function formatarWhatsapp(codigo: string, digitos: string): string | null {
  let num = digitos.replace(/\D/g, "");
  if (!num) return null;
  // Se a pessoa digitou o código do país junto, não duplica
  if (num.startsWith(codigo) && num.length > codigo.length + 5) {
    num = num.slice(codigo.length);
  }
  if (num.length < 6 || num.length > 14) return null;
  return `+${codigo}${num}`;
}

function soDigitos(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

const btnPrimario =
  "rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium";
const btnSecundario =
  "rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium";

export function LinkDespesas({ tripId, tripNome }: { tripId: string; tripNome?: string }) {
  const uid = useUid();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [fone, setFone] = useState("");
  const [pais, setPais] = useState("55");
  const [salvando, setSalvando] = useState(false);

  const { data: link } = useQuery({
    queryKey: ["despesas-link", tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from("despesas_link")
        .select("id, token")
        .eq("trip_id", tripId)
        .is("revogado_em", null)
        .maybeSingle();
      return data;
    },
    enabled: !!uid,
  });

  const { data: membros } = useQuery({
    queryKey: ["despesas-link-membros", tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from("trip_member")
        .select("person_id, person:person_id(id, nome, telefone)")
        .eq("trip_id", tripId)
        .is("deleted_at", null);
      return (data ?? []) as Array<{
        person_id: string;
        person: { id: string; nome: string; telefone: string | null } | null;
      }>;
    },
    enabled: !!uid,
  });

  const url = link
    ? `${window.location.hostname === "localhost" ? window.location.origin : "https://evoque.global"}/d/${link.token}`
    : "";
  const texto = `Despesas da viagem${tripNome ? ` ${tripNome}` : ""}: ${url}`;

  async function criar() {
    const token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("despesas_link").insert({
      trip_id: tripId,
      token,
      criado_por: uid!,
    });
    if (error) {
      toast.error("Não consegui criar o link.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["despesas-link", tripId] });
    setMsg("Link criado.");
  }

  async function desligar() {
    if (!link) return;
    const { error } = await supabase
      .from("despesas_link")
      .update({ revogado_em: new Date().toISOString() })
      .eq("id", link.id);
    if (error) {
      toast.error("Não consegui desligar o link.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["despesas-link", tripId] });
    setMsg("Link desligado.");
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setMsg("Link copiado.");
    } catch {
      setMsg(url);
    }
  }

  function abrirEdicao(personId: string) {
    setEditando(personId);
    setFone("");
    setPais("55");
    setMsg("");
  }

  async function salvarFone(personId: string) {
    const formatado = formatarWhatsapp(pais, fone);
    if (!formatado) {
      toast.error("Número inválido. Digite DDD + número, ex: 11 98765-4321.");
      return;
    }
    setSalvando(true);
    try {
      await mutar({
        tipo: "update",
        tabela: "person",
        id: personId,
        valores: { telefone: formatado },
      });
      qc.invalidateQueries({ queryKey: ["despesas-link-membros", tripId] });
      setEditando(null);
      setFone("");
      toast.success(`WhatsApp salvo: ${formatado}`);
    } catch {
      toast.error("Não consegui salvar o número.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="font-medium text-sm">Link para verem as despesas</p>
      <p className="text-xs text-muted-foreground">
        Quem abre o link vê as despesas e os saldos, sem precisar de conta. As
        fotos dos recibos ficam de fora.
      </p>
      {!link ? (
        <button type="button" className={btnPrimario} onClick={criar}>
          Criar link
        </button>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
              target="_blank"
              rel="noreferrer"
              className={btnPrimario}
            >
              WhatsApp
            </a>
            <button type="button" className={btnSecundario} onClick={copiar}>
              Copiar
            </button>
            <button type="button" className={btnSecundario} onClick={desligar}>
              Desligar
            </button>
          </div>
          {membros && membros.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">Enviar para:</p>
              <div className="flex flex-wrap gap-2">
                {membros.map((m) => {
                  const tel = m.person?.telefone?.trim();
                  const nome = m.person?.nome ?? "—";
                  if (tel) {
                    return (
                      <a
                        key={m.person_id}
                        href={`https://wa.me/${soDigitos(tel)}?text=${encodeURIComponent(texto)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                      >
                        <MessageCircle className="h-4 w-4 text-primary" />
                        {nome}
                      </a>
                    );
                  }
                  return (
                    <div key={m.person_id} className="w-full">
                      {editando === m.person_id ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={pais}
                              onChange={(e) => setPais(e.target.value)}
                              className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
                              aria-label="Código do país"
                            >
                              {PAISES.map((p) => (
                                <option key={p.codigo} value={p.codigo}>
                                  +{p.codigo} {p.nome}
                                </option>
                              ))}
                            </select>
                            <input
                              type="tel"
                              inputMode="tel"
                              placeholder="11 98765-4321"
                              value={fone}
                              onChange={(e) => setFone(e.target.value)}
                              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                              autoFocus
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className={btnPrimario}
                              onClick={() => salvarFone(m.person_id)}
                              disabled={salvando}
                            >
                              {salvando ? "Salvando…" : "Salvar"}
                            </button>
                            <button
                              type="button"
                              className={btnSecundario}
                              onClick={() => setEditando(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirEdicao(m.person_id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
                        >
                          <Phone className="h-4 w-4" />
                          {nome} — cadastrar WhatsApp
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
