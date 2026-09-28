import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { mutar } from "@/lib/outbox";
import { useUid } from "@/lib/despesas";
import { Botao } from "@/components/Chrome";
import { Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";

function formatarWhatsapp(digitos: string): string | null {
  const num = digitos.replace(/\D/g, "");
  if (!num) return null;
  let sem55 = num;
  if (sem55.startsWith("55") && (sem55.length === 12 || sem55.length === 13)) {
    sem55 = sem55.slice(2);
  }
  if (sem55.length === 11 || sem55.length === 10) {
    return `+55${sem55}`;
  }
  if (sem55.length >= 12) {
    return `+${num}`;
  }
  return null;
}

function soDigitos(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

export function LinkDespesas({ tripId }: { tripId: string }) {
  const uid = useUid();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [msg, setMsg] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [fone, setFone] = useState("");
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
  const texto = `Despesas da viagem: ${url}`;

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
    setMsg("");
  }

  async function salvarFone(personId: string) {
    const formatado = formatarWhatsapp(fone);
    if (!formatado) {
      toast.error("Número inválido. Use DDD + número, ex: 11 98765-4321.");
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
        <Botao tipo="button" onClick={criar}>
          Criar link
        </Botao>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
            >
              WhatsApp
            </a>
            <Botao tipo="button" variante="secundario" onClick={copiar}>
              Copiar
            </Botao>
            <Botao tipo="button" variante="secundario" onClick={desligar}>
              Desligar
            </Botao>
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
                        <div className="flex items-center gap-2">
                          <input
                            type="tel"
                            inputMode="tel"
                            placeholder="11 98765-4321"
                            value={fone}
                            onChange={(e) => setFone(e.target.value)}
                            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            autoFocus
                          />
                          <Botao
                            tipo="button"
                            onClick={() => salvarFone(m.person_id)}
                            disabled={salvando}
                          >
                            {salvando ? "Salvando…" : "Salvar"}
                          </Botao>
                          <Botao
                            tipo="button"
                            variante="secundario"
                            onClick={() => setEditando(null)}
                          >
                            Cancelar
                          </Botao>
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
