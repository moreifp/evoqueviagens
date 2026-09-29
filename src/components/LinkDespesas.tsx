import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { origemApp } from "@/lib/site";
import { useUid } from "@/lib/despesas";
import { ChevronDown, ChevronUp, Phone, MessageCircle, Users } from "lucide-react";
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

const btnPrimario = "rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium";
const btnSecundario = "rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium";

export function LinkDespesas({ tripId, tripNome }: { tripId: string; tripNome?: string }) {
  const uid = useUid();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [fone, setFone] = useState("");
  const [pais, setPais] = useState("55");
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);

  const [criando, setCriando] = useState(false);
  const { data: links, isLoading: carregandoLink } = useQuery({
    queryKey: ["despesas-link", tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from("despesas_link")
        .select("id, token, expira_em")
        .eq("trip_id", tripId)
        .is("revogado_em", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!uid && aberto,
  });

  const { data: membros } = useQuery({
    queryKey: ["despesas-link-membros", tripId],
    queryFn: async () => {
      const [{ data: ms }, { data: tels }, { data: convites }] = await Promise.all([
        supabase.rpc("membros_viagem", { _tid: tripId }),
        supabase.rpc("telefones_viagem", { _tid: tripId }),
        supabase
          .from("trip_member")
          .select("id, convite_telefone")
          .eq("trip_id", tripId)
          .is("deleted_at", null),
      ]);
      const telPorPessoa = new Map((tels ?? []).map((t) => [t.person_id, t.telefone]));
      const convitePorMembro = new Map((convites ?? []).map((c) => [c.id, c.convite_telefone]));
      return (ms ?? [])
        .filter((m) => m.status !== "saiu")
        .map((m) => ({
          member_id: m.id,
          person_id: m.person_id,
          meu: m.meu,
          person: {
            id: m.person_id,
            nome: m.apelido || m.nome,
            telefone: telPorPessoa.get(m.person_id) ?? convitePorMembro.get(m.id) ?? null,
          },
        }));
    },
    enabled: !!uid && aberto,
  });

  const link = links?.[0] ?? null;
  const vencido = !!link?.expira_em && new Date(link.expira_em).getTime() < Date.now();
  const url = link ? `${origemApp()}/d/${link.token}` : "";
  const texto = `Despesas da viagem${tripNome ? ` ${tripNome}` : ""}: ${url}`;

  // Expira 30 dias depois do fim da viagem.
  async function validade() {
    const { data } = await supabase.from("trip").select("data_fim").eq("id", tripId).maybeSingle();
    const fim = data?.data_fim ? new Date(`${data.data_fim}T23:59:59Z`) : new Date();
    const base = Math.max(fim.getTime(), Date.now());
    return new Date(base + 30 * 864e5).toISOString();
  }

  async function criar() {
    if (criando) return;
    setCriando(true);
    try {
      const token =
        crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      const { error } = await supabase
        .from("despesas_link")
        .insert({ trip_id: tripId, token, criado_por: uid!, expira_em: await validade() });
      if (error) {
        toast.error(
          error.code === "23505"
            ? "Esta viagem já tem um link ligado."
            : "Não consegui criar o link.",
        );
      } else setMsg("Link criado.");
      await qc.invalidateQueries({ queryKey: ["despesas-link", tripId] });
    } finally {
      setCriando(false);
    }
  }

  async function renovar() {
    if (!link) return;
    const { error } = await supabase
      .from("despesas_link")
      .update({ expira_em: await validade() })
      .eq("id", link.id);
    if (error) return void toast.error("Não consegui renovar.");
    await qc.invalidateQueries({ queryKey: ["despesas-link", tripId] });
    setMsg("Link renovado por mais 30 dias após o fim da viagem.");
  }

  async function desligar() {
    if (!links?.length) return;
    const { error } = await supabase
      .from("despesas_link")
      .update({ revogado_em: new Date().toISOString() })
      .in(
        "id",
        links.map((l) => l.id),
      );
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
      const { data: n, error } = await supabase.rpc("salvar_whatsapp_participante", {
        _trip: tripId,
        _person: personId,
        _telefone: formatado,
      });
      if (error) throw new Error(error.message);
      if (!n) throw new Error("Nada foi alterado.");
      await qc.invalidateQueries({ queryKey: ["despesas-link-membros", tripId] });
      setEditando(null);
      setFone("");
      toast.success(`WhatsApp salvo: ${formatado}`);
    } catch (e) {
      toast.error(`Não salvei o número: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-border bg-card">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls="link-despesas-conteudo"
        className="tap flex w-full items-center justify-between gap-3 px-4 text-left"
      >
        <span className="min-w-0">
          <span className="block text-lg font-bold text-foreground">Visão Despesas</span>
          <span className="block text-sm text-muted-foreground">mandar no grupo</span>
        </span>
        {aberto ? (
          <ChevronUp className="shrink-0" size={24} />
        ) : (
          <ChevronDown className="shrink-0" size={24} />
        )}
      </button>
      {aberto && (
        <div id="link-despesas-conteudo" className="space-y-3 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            Quem abre o link vê as despesas e os saldos, sem precisar de conta. As fotos dos recibos
            ficam de fora.
          </p>
          {!link ? (
            <button
              type="button"
              className={btnPrimario}
              onClick={criar}
              disabled={criando || carregandoLink}
            >
              {criando ? "Criando…" : carregandoLink ? "Carregando…" : "Criar link"}
            </button>
          ) : (
            <>
              {(links?.length ?? 0) > 1 && (
                <p className="text-sm font-semibold text-danger">
                  Há {links!.length} links ligados. Toque em Desligar para desligar todos.
                </p>
              )}
              <p
                className={`text-xs ${vencido ? "font-semibold text-danger" : "text-muted-foreground"}`}
              >
                {link.expira_em
                  ? `${vencido ? "Venceu em" : "Vale até"} ${new Date(link.expira_em).toLocaleDateString("pt-BR")}.`
                  : "Sem prazo."}{" "}
                <button
                  type="button"
                  onClick={renovar}
                  className="font-semibold text-accent underline"
                >
                  Renovar
                </button>
              </p>
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
                  {(links?.length ?? 0) > 1 ? "Desligar todos" : "Desligar"}
                </button>
              </div>
              {membros && membros.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-muted-foreground">Enviar para:</p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    >
                      <Users className="h-4 w-4 text-primary" />
                      Todos
                    </a>
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
      )}
    </section>
  );
}
