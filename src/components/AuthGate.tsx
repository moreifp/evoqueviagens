import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Plane, LogIn } from "lucide-react";
import { toast } from "sonner";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setPronto(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
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
    return { texto: "Já existe uma conta com este e-mail. Toque em “Já tenho conta”." };
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

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (espera > 0 || carregando) return;
    setCarregando(true);
    const fn =
      modo === "entrar"
        ? supabase.auth.signInWithPassword({ email, password: senha })
        : supabase.auth.signUp({
            email,
            password: senha,
            options: { emailRedirectTo: window.location.origin },
          });
    const { data, error } = await fn;
    setCarregando(false);
    if (error) {
      const { texto, espera: s } = traduzErro(error.message);
      if (s) setEspera(s);
      toast.error(texto);
      return;
    }
    if (!data.session) {
      toast.error("Conta criada. Entre com seu e-mail e senha.");
      setModo("entrar");
    }
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
            disabled={carregando}
            className="gradient-hero shadow-medium tap flex w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold"
          >
            <LogIn size={28} strokeWidth={2.2} />
            {modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
          className="tap mt-4 w-full rounded-xl text-base font-semibold text-accent underline"
        >
          {modo === "entrar" ? "Criar conta" : "Já tenho conta"}
        </button>
      </div>
    </div>
  );
}
