import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, ChevronDown, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { estadoPush, ligarAvisos, tokenSalvo, esquecerToken, type EstadoPush } from "@/lib/push";
import {
  registrarAparelho,
  removerAparelho,
  salvarPrefPush,
  avisoTeste,
} from "@/lib/push.functions";

type Pref = {
  voo: boolean;
  aviso: boolean;
  convite: boolean;
  claude: boolean;
  documento: boolean;
  checkin: boolean;
  silencio_inicio: string;
  silencio_fim: string;
};

const PREF_PADRAO: Pref = {
  voo: true,
  aviso: true,
  convite: true,
  claude: true,
  documento: true,
  checkin: false,
  silencio_inicio: "22:00",
  silencio_fim: "07:00",
};

const TIPOS: {
  chave: keyof Omit<Pref, "silencio_inicio" | "silencio_fim">;
  nome: string;
  detalhe: string;
}[] = [
  { chave: "voo", nome: "Status do voo", detalhe: "Atraso, portão, cancelamento e embarque" },
  { chave: "aviso", nome: "Avisos do organizador", detalhe: "Recados da viagem" },
  { chave: "convite", nome: "Convites", detalhe: "Convite para viagem ou item para aceitar" },
  { chave: "claude", nome: "Chegou pelo Claude", detalhe: "Itens novos na sua caixa" },
  {
    chave: "documento",
    nome: "Documento vencendo",
    detalhe: "Passaporte ou visto antes de uma viagem",
  },
  { chave: "checkin", nome: "Lembrete de check-in", detalhe: "No dia anterior ao voo" },
];

/** Seção "Avisos no celular" da tela Eu — recolhida por padrão, no fim da tela. */
export function AvisosPush() {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<EstadoPush>(() =>
    typeof window === "undefined" ? "fora_do_app" : estadoPush(),
  );
  const [pref, setPref] = useState<Pref>(PREF_PADRAO);
  const [ocupado, setOcupado] = useState(false);
  const registrar = useServerFn(registrarAparelho);
  const remover = useServerFn(removerAparelho);
  const salvarPref = useServerFn(salvarPrefPush);
  const testar = useServerFn(avisoTeste);

  const { data: prefSalva } = useQuery({
    queryKey: ["push_pref"],
    queryFn: async () => {
      const { data } = await supabase.from("push_pref").select("*").maybeSingle();
      return data as Pref | null;
    },
  });

  // A cada abertura com avisos ligados: se o token mudou, registra o novo.
  useEffect(() => {
    if (estado !== "ligado") return;
    void (async () => {
      const { conferirTokenMudou } = await import("@/lib/push");
      const novo = await conferirTokenMudou();
      if (novo) {
        const plataforma = /iPad|iPhone|iPod/.test(navigator.userAgent)
          ? "ios-pwa"
          : /Android/.test(navigator.userAgent)
            ? "android-web"
            : "web";
        await registrar({
          data: { token: novo, plataforma, userAgent: navigator.userAgent.slice(0, 200) },
        }).catch(() => {});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
  useEffect(() => {
    if (prefSalva) setPref({ ...PREF_PADRAO, ...prefSalva });
  }, [prefSalva]);

  async function ligar() {
    setOcupado(true);
    try {
      const r = await ligarAvisos();
      setEstado(r.estado);
      if (r.estado === "ligado" && r.token) {
        const plataforma = /iPad|iPhone|iPod/.test(navigator.userAgent)
          ? "ios-pwa"
          : /Android/.test(navigator.userAgent)
            ? "android-web"
            : "web";
        await registrar({
          data: { token: r.token, plataforma, userAgent: navigator.userAgent.slice(0, 200) },
        });
        await salvarPref({ data: pref });
        toast.success("Avisos ligados neste aparelho.");
      } else if (r.estado === "bloqueado") {
        toast.error(
          "O navegador bloqueou os avisos. Toque no cadeado do endereço → Notificações → Permitir.",
        );
      }
    } finally {
      setOcupado(false);
    }
  }

  async function desligar() {
    setOcupado(true);
    try {
      const token = tokenSalvo();
      if (token) await remover({ data: { token } });
      esquecerToken();
      setEstado("desligado");
      toast.success("Avisos desligados neste aparelho.");
    } finally {
      setOcupado(false);
    }
  }

  async function mudar(chave: keyof Pref, valor: boolean | string) {
    const nova = { ...pref, [chave]: valor };
    setPref(nova);
    try {
      await salvarPref({ data: nova });
    } catch {
      toast.error("Não salvou. Tente de novo com internet.");
    }
  }

  async function mandarTeste() {
    setOcupado(true);
    try {
      const r = await testar();
      if (r.status === "enviado") toast.success("Aviso de teste enviado! Olhe as notificações.");
      else if (r.status === "sem_aparelho") toast.error("Este aparelho ainda não está registrado.");
      else toast.error("Não consegui enviar agora.");
    } finally {
      setOcupado(false);
    }
  }

  const resumo =
    estado === "ligado"
      ? "Ligados neste aparelho"
      : estado === "desligado"
        ? "Desligados neste aparelho"
        : estado === "bloqueado"
          ? "Bloqueados no navegador"
          : estado === "iphone_sem_instalar"
            ? "Instale o app para receber"
            : estado === "fora_do_app"
              ? "Ligue no app instalado"
              : "Este navegador não aceita avisos";

  return (
    <section aria-label="Avisos no celular">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="tap flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left"
      >
        <Bell size={28} strokeWidth={2.2} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <strong className="block text-lg">Avisos no celular</strong>
          <span className="text-base text-muted-foreground">{resumo}</span>
        </span>
        <ChevronDown
          size={26}
          strokeWidth={2.4}
          className={`shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {aberto && (
        <div className="mt-3 rounded-[18px] border border-border bg-card p-4 shadow-soft">
          {estado === "fora_do_app" && (
            <div className="flex gap-3">
              <Smartphone size={28} strokeWidth={2.2} className="shrink-0 text-accent" />
              <p className="text-lg font-semibold text-foreground">
                Aqui é só uma prévia. Abra o app instalado no celular (ou app.evoque.global) para
                ligar e ajustar os avisos.
              </p>
            </div>
          )}
          {estado === "iphone_sem_instalar" && (
            <div className="flex gap-3">
              <Smartphone size={28} strokeWidth={2.2} className="shrink-0 text-accent" />
              <p className="text-lg font-semibold text-foreground">
                Para receber avisos no iPhone, instale o app: Compartilhar → Adicionar à Tela de
                Início.
              </p>
            </div>
          )}
          {estado === "sem_suporte" && (
            <p className="text-lg font-semibold text-muted-foreground">
              Este navegador não aceita avisos.
            </p>
          )}
          {estado === "bloqueado" && (
            <div className="flex gap-3">
              <BellOff size={28} strokeWidth={2.2} className="shrink-0 text-warn" />
              <p className="text-lg font-semibold text-foreground">
                Os avisos estão bloqueados no navegador. Para liberar: toque no cadeado ao lado do
                endereço → Notificações → Permitir, e volte aqui.
              </p>
            </div>
          )}
          {estado === "desligado" && (
            <button
              onClick={ligar}
              disabled={ocupado}
              className="tap gradient-hero flex w-full items-center justify-center gap-3 rounded-2xl text-lg font-bold"
            >
              <Bell size={26} strokeWidth={2.2} /> Ligar avisos neste aparelho
            </button>
          )}
          {estado === "ligado" && (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-lg font-bold text-ok">
                <Bell size={24} strokeWidth={2.2} /> Avisos ligados neste aparelho
              </p>
              <div className="divide-y divide-border">
                {TIPOS.map((t) => (
                  <label
                    key={t.chave}
                    className="flex min-h-14 cursor-pointer items-center gap-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <strong className="block text-lg">{t.nome}</strong>
                      <span className="text-base text-muted-foreground">{t.detalhe}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={pref[t.chave]}
                      onChange={(e) => mudar(t.chave, e.target.checked)}
                      className="h-7 w-7 accent-[var(--accent)]"
                    />
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="flex-1 text-lg font-semibold">Silêncio</span>
                <input
                  type="time"
                  value={pref.silencio_inicio}
                  onChange={(e) => mudar("silencio_inicio", e.target.value)}
                  className="tap rounded-lg border-2 border-input bg-card px-2 text-lg"
                  aria-label="Início do silêncio"
                />
                <span className="text-lg">até</span>
                <input
                  type="time"
                  value={pref.silencio_fim}
                  onChange={(e) => mudar("silencio_fim", e.target.value)}
                  className="tap rounded-lg border-2 border-input bg-card px-2 text-lg"
                  aria-label="Fim do silêncio"
                />
              </div>
              <p className="text-base text-muted-foreground">
                No silêncio, só chegam avisos de voo nas 24h antes da saída.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={mandarTeste}
                  disabled={ocupado}
                  className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-input bg-card text-lg font-bold"
                >
                  <Send size={24} strokeWidth={2.2} /> Mandar um aviso de teste
                </button>
                <button
                  onClick={desligar}
                  disabled={ocupado}
                  className="tap flex items-center justify-center gap-2 rounded-2xl text-lg font-bold text-destructive"
                >
                  <BellOff size={24} strokeWidth={2.2} /> Desligar neste aparelho
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
