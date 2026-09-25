import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Plane, LogIn, Chrome, Apple } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { garantirMinhaFicha } from "@/lib/compartilhar.functions";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [pronto, setPronto] = useState(false);

  const garantir = useServerFn(garantirMinhaFicha);
  const qc = useQueryClient();

  useEffect(() => {
    let vivo = true;
    let garantido = false;
    async function aplicar(s: Session | null) {
      if (s && !garantido) {
        garantido = true;
        garantir()
          .then(() => qc.invalidateQueries({ queryKey: ["pessoas"] }))
          .catch((e) => console.error(e));
      }
      if (vivo) {
        setSession(s);
        setPronto(true);
      }
    }
    supabase.auth.getSession().then(({ data }) => aplicar(data.session)).catch(() => aplicar(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setTimeout(() => aplicar(s), 0);
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!pronto) {
    return <div className="min-h-screen bg-background" />;
  }
  if (!session) return <Entrar />;
  return <>{children}</>;
}

function traduzErro(msg: string): { texto: string; espera?: number } {
  const m = msg.toLowerCase();
  const seg = /after (\d+) seconds?/.exec(m);
  if (seg || m.includes("rate limit") || m.includes("too many")) {
    const s = seg?.[1] ? parseInt(seg[1], 10) : 60;
    return { texto: "Aguarde um minuto antes de tentar de novo.", espera: s };
  }
  if (m.includes("invalid login credentials")) return { texto: "E-mail ou senha incorretos." };
  if (m.includes("email not confirmed")) return { texto: "Este e-mail ainda não foi liberado. Tente entrar de novo." };
  if (m.includes("user already registered") || m.includes("already been registered"))
    return { texto: "Já existe uma conta com este e-mail. Toque em Entrar." };
  if (m.includes("password should be at least"))
    return { texto: "A senha precisa ter pelo menos 6 caracteres." };
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return { texto: "Digite um e-mail válido." };
  if (m.includes("network") || m.includes("failed to fetch"))
    return { texto: "Sem conexão. Verifique a internet e tente de novo." };
  return { texto: "Não deu certo agora. Tente de novo em instantes." };
}

function Entrar() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [carregando, setCarregando] = useState(false);
  const [espera, setEspera] = useState(0);
  const convite = typeof window !== "undefined" && window.location.pathname.startsWith("/convite/");

  async function entrarSocial(provedor: "google" | "apple") {
    if (carregando) return;
    setCarregando(true);
    try {
      const r = await lovable.auth.signInWithOAuth(provedor, { redirect_uri: window.location.href });
      if (r.error || r.redirected) {
        setCarregando(false);
        if (r.error) toast.error("Não deu certo agora. Tente de novo em instantes.");
        return;
      }
      setCarregando(false);
    } catch {
      setCarregando(false);
      toast.error("Não deu certo agora. Tente de novo em instantes.");
    }
  }

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (espera > 0 || carregando) return;
    setCarregando(true);
    if (modo === "criar") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: window.location.href },
      });
      setCarregando(false);
      if (error) {
        const { texto, espera: s } = traduzErro(error.message);
        if (s) setEspera(s);
        if (texto.includes("Já existe")) setModo("entrar");
        toast.error(texto);
        return;
      }
      if (!data.session) toast.error("Não deu certo agora. Tente de novo em instantes.");
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      const { texto, espera: s } = traduzErro(error.message);
      if (s) setEspera(s);
      toast.error(texto);
      return;
    }
    if (!data.session) toast.error("Não deu certo agora. Tente de novo em instantes.");
  }


  return (
    <div className="min-h-screen bg-background px-5 pt-16 pb-10">
      <div className="mx-auto w-full max-w-md">
        <div className="gradient-hero shadow-medium mb-8 flex h-32 items-center gap-4 rounded-2xl px-6">
          <Plane size={40} strokeWidth={2.2} />
          <div>
            <h1 className="text-3xl leading-tight">Evoque</h1>
            <p className="text-base opacity-90">Viagens</p>
          </div>
        </div>
        <p className="mb-6 text-lg text-foreground">
          {convite
            ? "Você recebeu um convite. Entre ou crie sua conta para continuar."
            : "Seus documentos, fidelidades e viagens, só seus. Compartilhe com quem quiser."}
        </p>

        <button
          type="button"
          onClick={() => entrarSocial("google")}
          disabled={carregando}
          className="tap mb-3 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-input bg-card text-xl font-bold text-foreground shadow-soft disabled:opacity-60"
        >
          <Chrome size={28} strokeWidth={2.2} />
          Entrar com Google
        </button>

        <button
          type="button"
          onClick={() => entrarSocial("apple")}
          disabled={carregando}
          className="tap mb-6 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-input bg-card text-xl font-bold text-foreground shadow-soft disabled:opacity-60"
        >
          <Apple size={28} strokeWidth={2.2} />
          Entrar com Apple
        </button>

        <form onSubmit={enviar} className="space-y-4">
          <label className="block">
            <span className="text-base font-semibold">E-mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="tap mt-2 w-full rounded-xl border-2 border-input bg-card px-4 text-lg text-foreground"
            />
          </label>
          <label className="block">
            <span className="text-base font-semibold">Senha</span>
            <input
              type="password"
              required
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="tap mt-2 w-full rounded-xl border-2 border-input bg-card px-4 text-lg text-foreground"
            />
          </label>

          <button
            type="submit"
            disabled={carregando || espera > 0}
            className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold disabled:opacity-60"
          >
            <LogIn size={28} strokeWidth={2.2} />
            {espera > 0
              ? `Aguarde ${espera}s`
              : modo === "entrar"
                ? "Entrar"
                : "Criar minha conta"}
          </button>
          {espera > 0 && (
            <p className="text-center text-base text-muted-foreground">
              Muitas tentativas seguidas. Tente de novo em {espera} segundos.
            </p>
          )}

        </form>

        <button
          onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
          className="tap mt-4 w-full rounded-xl text-base font-semibold text-accent underline"
        >
          {modo === "entrar" ? "Não tenho conta · criar agora" : "Já tenho conta · entrar"}
        </button>
      </div>
    </div>
  );
}
