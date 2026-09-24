import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  User, BookOpen, Stamp, Award, SlidersHorizontal, Phone, Camera, Check, CheckCircle2, RotateCcw, Plus,
  IdCard, Car, Syringe, ShieldPlus, Plane, Home, PauseCircle, X, ChevronRight,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { abrirCadastro, iniciarCadastro, lerPassaporte, salvarPasso, enviarCadastro, urlUpload, relatarErro } from "@/lib/cadastro.functions";
import {
  NOME_DOC, NOME_DOC_EN, NOME_SECAO, PROGRAMAS, REFEICOES, TIPOS_EXTRA, TIPOS_SECAO_EXTRAS, TIPOS_VISTO, passosDoModo,
  type CadastroDTO, type ContaDTO, type DocDTO, type Secao,
} from "@/lib/cadastro-tipos";
import { blobParaDataUrl, prepararArquivo, type Ext } from "@/lib/imagem";
import { CampoData } from "@/components/FichaPartes";
import { ACEITA_FOTO, DicaArrastar, Miniatura, ZonaArquivo, previaDe } from "@/components/ArquivoFoto";

export const Route = createFileRoute("/c/$token")({
  validateSearch: (s) => z.object({ secao: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Cadastro de viagem — Evoque" },
      { name: "description", content: "Seu cadastro de viagem. Você faz uma vez só." },
      { property: "og:title", content: "Cadastro de viagem — Evoque" },
      { property: "og:description", content: "Seu cadastro de viagem. Leva 5 minutos, é uma vez só." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CadastroParticipante,
});

type L = "pt" | "en";
const T = {
  ola: { pt: "Oi", en: "Hi" },
  sub: { pt: "Seu cadastro de viagem. Você faz uma vez só.", en: "Your travel profile. You only do it once." },
  pode: { pt: "Pode parar e voltar pelo mesmo link.", en: "You can stop and come back with the same link." },
  consent: {
    pt: "Concordo em guardar meus dados para as viagens. Só o Fausto e o Diego veem meus documentos.",
    en: "I agree to store my data for the trips. Only Fausto and Diego can see my documents.",
  },
  rapido: { pt: "Rápido", en: "Quick" },
  rapidoSub: { pt: "Só o essencial · 5 min", en: "Just the essentials · 5 min" },
  completo: { pt: "Completo", en: "Complete" },
  completoSub: { pt: "Tudo, com documentos extras · 15 min", en: "Everything, with extra documents · 15 min" },
  passo: { pt: "Passo", en: "Step" },
  de: { pt: "de", en: "of" },
  depois: { pt: "Continuar depois", en: "Finish later" },
  continuar: { pt: "Continuar", en: "Continue" },
  pular: { pt: "Pular", en: "Skip" },
  naoTenho: { pt: "Não tenho", en: "I don't have" },
  enviar: { pt: "Enviar", en: "Send" },
  foto: { pt: "Sua foto", en: "Your photo" },
  apelido: { pt: "Como gosta de ser chamado(a)", en: "What should we call you" },
  cpf: { pt: "CPF", en: "CPF (Brazilians only)" },
  whats: { pt: "WhatsApp", en: "WhatsApp" },
  email: { pt: "E-mail", en: "E-mail" },
  notaNome: { pt: "Nome e nascimento vêm do passaporte.", en: "Name and birth date come from your passport." },
  fotoPass: { pt: "Foto da página com seus dados", en: "Photo of your passport data page" },
  lendo: { pt: "Lendo seu passaporte…", en: "Reading your passport…" },
  lemos: { pt: "Lemos seu passaporte · Confira e toque para corrigir", en: "We read your passport · Check and tap to fix" },
  naoLemos: { pt: "Não deu para ler. Preencha abaixo.", en: "We couldn't read it. Please fill in below." },
  refazer: { pt: "Tirar outra", en: "Retake" },
  nomePass: { pt: "Nome como no passaporte", en: "Name as in passport" },
  nacionalidade: { pt: "Nacionalidade", en: "Nationality" },
  numero: { pt: "Número", en: "Number" },
  validade: { pt: "Validade", en: "Expiry date" },
  nascimento: { pt: "Nascimento", en: "Date of birth" },
  sexo: { pt: "Sexo", en: "Sex" },
  outroPass: { pt: "Tenho outro passaporte", en: "I have another passport" },
  tirar: { pt: "Tirar", en: "Remove" },
  toqueVistos: { pt: "Toque nos que você tem.", en: "Tap the ones you have." },
  fotoVisto: { pt: "Foto do visto", en: "Visa photo" },
  tipoVisto: { pt: "Tipo (ex.: B1/B2)", en: "Type (e.g. B1/B2)" },
  outro: { pt: "Outro", en: "Other" },
  qualPrograma: { pt: "Nome do programa", en: "Program name" },
  semSenha: { pt: "Nunca pedimos senha.", en: "We never ask for passwords." },
  assento: { pt: "Assento", en: "Seat" },
  janela: { pt: "Janela", en: "Window" },
  corredor: { pt: "Corredor", en: "Aisle" },
  tantoFaz: { pt: "Tanto faz", en: "No preference" },
  quarto: { pt: "Quarto", en: "Room" },
  casal: { pt: "Casal", en: "Double bed" },
  duasCamas: { pt: "2 camas", en: "2 beds" },
  alcool: { pt: "Bebe álcool?", en: "Do you drink alcohol?" },
  sim: { pt: "Sim", en: "Yes" },
  nao: { pt: "Não", en: "No" },
  comida: { pt: "Comida", en: "Food" },
  contato: { pt: "Nome do contato", en: "Contact name" },
  parentesco: { pt: "Parentesco", en: "Relationship" },
  telefone: { pt: "Telefone", en: "Phone" },
  pronto: { pt: "Pronto", en: "All done" },
  vaiConferir: { pt: "O Fausto vai conferir e te avisa.", en: "Fausto will check it and let you know." },
  corrigirAlgo: { pt: "Corrigir algo", en: "Fix something" },
  salvo: { pt: "Salvo. Pode fechar e voltar pelo mesmo link.", en: "Saved. You can close and come back with the same link." },
  falta: { pt: "Falta preencher", en: "Please fill in" },
  erro: { pt: "Não deu certo agora. Tente de novo.", en: "Something went wrong. Please try again." },
  voltar: { pt: "Voltar", en: "Back" },
  naoSalvo: {
    pt: "Não conseguimos confirmar que salvou (conexão falhou). Toque em Continuar de novo — nada fica duplicado.",
    en: "We couldn't confirm it was saved (connection failed). Tap Continue again — nothing gets duplicated.",
  },
  correcao: { pt: "Pedido de correção", en: "Correction requested" },
  endereco: { pt: "Endereço", en: "Address" },
  apolice: { pt: "Apólice e telefone", en: "Policy number and phone" },
  viajante: { pt: "Nº de viajante", en: "Traveler number" },
  rapidoDepois: { pt: "Dá para completar depois.", en: "You can complete the rest later." },
  demais: { pt: "Demais dados (opcional)", en: "More details (optional)" },
  demaisTitulo: { pt: "Demais dados", en: "More details" },
  vacinas: { pt: "Vacinas", en: "Vaccines" },
  febre: { pt: "Febre amarela", en: "Yellow fever" },
  certificado: { pt: "Tem o certificado internacional (CIVP)?", en: "Do you have the international certificate (ICVP)?" },
  dataVacina: { pt: "Data da vacina", en: "Vaccination date" },
  fotoCert: { pt: "Foto do certificado", en: "Certificate photo" },
  outraVacina: { pt: "Outra vacina", en: "Other vaccine" },
  nomeVacina: { pt: "Nome da vacina", en: "Vaccine name" },
  negado: { pt: "Algum visto negado ou em processo?", en: "Any visa denied or in process?" },
  negadoDet: { pt: "Qual e quando?", en: "Which one and when?" },
  refeicao: { pt: "Refeição especial no voo", en: "Special in-flight meal" },
  qualRefeicao: { pt: "Qual?", en: "Which one?" },
  programas: { pt: "Milhas e hotéis", en: "Miles and hotels" },
  salaVip: { pt: "Sala VIP", en: "Airport lounge" },
  foto_: { pt: "Foto", en: "Photo" },
} as const;
type Chave = keyof typeof T;

const ICONE: Record<Secao, typeof User> = {
  voce: User, passaporte: BookOpen, extras: IdCard, vistos: Stamp, fidelidade: Award, preferencias: SlidersHorizontal, emergencia: Phone,
};
const PARENTESCOS: { pt: string; en: string }[] = [
  { pt: "Mãe", en: "Mother" }, { pt: "Pai", en: "Father" }, { pt: "Cônjuge", en: "Spouse" },
  { pt: "Irmão(ã)", en: "Sibling" }, { pt: "Filho(a)", en: "Child" }, { pt: "Outro", en: "Other" },
];
const COMIDAS: { v: string; pt: string; en: string }[] = [
  { v: "vegetariana", pt: "Vegetariana", en: "Vegetarian" }, { v: "vegana", pt: "Vegana", en: "Vegan" },
  { v: "sem_gluten", pt: "Sem glúten", en: "Gluten-free" }, { v: "sem_lactose", pt: "Sem lactose", en: "Lactose-free" },
];
const ICONE_EXTRA: Record<string, typeof User> = { rg: IdCard, cnh: Car, pid: Car, vacina: Syringe, seguro: ShieldPlus, global_entry: Plane };

const inp = "tap w-full rounded-xl border-2 border-input bg-card px-4 text-lg text-foreground";

function CadastroParticipante() {
  const { token } = Route.useParams();
  const { secao: secaoInicial } = Route.useSearch();
  const abrir = useServerFn(abrirCadastro);
  const [c, setC] = useState<CadastroDTO | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    abrir({ data: { token } })
      .then((r) => (r.ok ? setC(r.cadastro) : setErro(r.erro)))
      .catch(() => setErro("REDE"));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (erro) {
    const txt =
      erro === "LINK_EXPIRADO"
        ? "Este link venceu. Peça um novo para quem te mandou. · This link has expired."
        : erro === "REDE"
          ? "Sem conexão. Tente de novo. · No connection."
          : "Este link não vale mais. Peça um novo para quem te mandou. · This link is no longer valid.";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <p className="text-xl font-semibold text-foreground">{txt}</p>
      </div>
    );
  }
  if (!c) return <div className="min-h-screen bg-background" />;
  return (
    <Fluxo token={token} inicial={c} secaoInicial={secaoInicial} />
  );
}

/** Passos de "Demais dados": só o que ainda falta (Outros documentos sempre, com as vacinas). */
function filaDemais(c: CadastroDTO): Secao[] {
  const f: Secao[] = ["extras"];
  if (c.person.visto_negado == null) f.push("vistos");
  if (!c.contas.some((x) => x.tipo === "sala_vip")) f.push("fidelidade");
  if (!c.prefs?.refeicao_voo) f.push("preferencias");
  return f;
}

function Fluxo({ token, inicial, secaoInicial }: { token: string; inicial: CadastroDTO; secaoInicial?: string }) {
  const [c, setC] = useState(inicial);
  const L: L = c.person.idioma;
  const t = (k: Chave) => T[k][L];
  const passos = passosDoModo(c.person.modo);
  const iniciou = !!c.person.consentimento_em && !!c.person.modo;
  const [revisando, setRevisando] = useState(false);
  const [tela, setTela] = useState<"boas" | "enviado" | "lista" | Secao>(() => {
    if (!iniciou) return "boas";
    if (secaoInicial && passos.includes(secaoInicial as Secao)) return secaoInicial as Secao;
    if (c.person.status === "enviado" || c.person.status === "aprovado") return "enviado";
    return passos[Math.min(c.person.passo_atual, passos.length - 1)] ?? "voce";
  });

  const salvar = useServerFn(salvarPasso);
  const enviar = useServerFn(enviarCadastro);
  const iniciar = useServerFn(iniciarCadastro);
  const abrir = useServerFn(abrirCadastro);
  const relatar_ = useServerFn(relatarErro);
  const [ocupado, setOcupado] = useState(false);
  // "Demais dados": fila dos passos que faltam; ao terminar volta ao "Pronto".
  const [fila, setFila] = useState<Secao[] | null>(null);
  const [filaTotal, setFilaTotal] = useState(0);

  useEffect(() => window.scrollTo(0, 0), [tela]);

  async function abrirDemais(base: CadastroDTO = c) {
    setOcupado(true);
    try {
      if (base.person.modo !== "completo") {
        await iniciar({ data: { token, modo: "completo" } });
        base = { ...base, person: { ...base.person, modo: "completo" } };
        setC(base);
      }
      const q = filaDemais(base);
      setFilaTotal(q.length);
      setFila(q.slice(1));
      setRevisando(false);
      setTela(q[0]!);
    } catch {
      toast.error(t("erro"));
    } finally {
      setOcupado(false);
    }
  }

  useEffect(() => {
    if (secaoInicial === "demais" && iniciou) void abrirDemais();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (tela === "boas") {
    return (
      <BoasVindas
        c={c}
        t={t}
        onEscolher={async (modo) => {
          setOcupado(true);
          try {
            await iniciar({ data: { token, modo } });
            setC({ ...c, person: { ...c.person, modo, consentimento_em: new Date().toISOString() } });
            setTela("voce");
          } catch {
            toast.error(t("erro"));
          } finally {
            setOcupado(false);
          }
        }}
        ocupado={ocupado}
      />
    );
  }

  if (tela === "lista") {
    return (
      <div className="min-h-screen bg-background px-4 pb-10 pt-8">
        <div className="mx-auto max-w-md space-y-4">
          <h1 className="text-3xl">{t("corrigirAlgo")}</h1>
          {passos.map((s) => {
            const I = ICONE[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setRevisando(true);
                  setTela(s);
                }}
                className="tap flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 text-left text-xl font-bold text-foreground"
              >
                {I && <I size={28} strokeWidth={2.2} className="text-accent" />}
                <span className="flex-1">{NOME_SECAO[s][L]}</span>
                <ChevronRight size={26} strokeWidth={2.2} />
              </button>
            );
          })}
          <button type="button" onClick={() => setTela("enviado")} className="tap w-full rounded-2xl border-2 border-primary text-xl font-bold text-foreground">
            {t("voltar")}
          </button>
        </div>
      </div>
    );
  }

  if (tela === "enviado") {
    return <Enviado c={c} t={t} L={L} ocupado={ocupado} onCorrigir={() => setTela("lista")} onDemais={() => abrirDemais()} />;
  }

  const idx = passos.indexOf(tela);

  async function relatar(onde: string, e: unknown) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ""}` : String(e);
    console.error("[cadastro]", onde, e);
    try {
      await relatar_({ data: { onde, msg: msg.slice(0, 1000), ua: navigator.userAgent.slice(0, 300) } });
    } catch {
      /* sem rede */
    }
  }

  async function gravar(dados: Record<string, unknown>, depois: "proximo" | "pausa") {
    setOcupado(true);
    const secao = tela as Secao;
    let novo: CadastroDTO | null = null;
    try {
      const r = await salvar({ data: { token, secao, passo: idx + 1, ...(dados as object) } } as never);
      novo = (r as { cadastro: CadastroDTO | null }).cadastro;
    } catch (e) {
      void relatar(`salvar:${secao}`, e);
      // A gravação pode ter chegado ao servidor mesmo sem resposta: confere antes de avisar.
      try {
        const a = await abrir({ data: { token } });
        if (a.ok && a.cadastro.revisoes.some((rv) => rv.secao === secao) && a.cadastro.person.passo_atual >= idx + 1) {
          novo = a.cadastro;
        }
      } catch (e2) {
        void relatar(`conferir:${secao}`, e2);
      }
      if (!novo) {
        toast.error(t("naoSalvo"), { duration: 8000 });
        setOcupado(false);
        return;
      }
    }
    try {
      if (novo) setC(novo);
      if (depois === "pausa") {
        toast.success(t("salvo"), { duration: 8000 });
        return;
      }
      if (fila) {
        if (fila.length) {
          setTela(fila[0]!);
          setFila(fila.slice(1));
        } else {
          setFila(null);
          setTela("enviado");
        }
      } else if (revisando) {
        setRevisando(false);
        setTela("enviado");
      } else if (idx + 1 < passos.length) setTela(passos[idx + 1]!);
      else {
        const e = await enviar({ data: { token } });
        if (!e.ok) {
          toast.error(`${t("falta")}: ${NOME_SECAO.passaporte[L]} / ${NOME_SECAO.emergencia[L]}`);
          return;
        }
        if (e.cadastro) setC(e.cadastro);
        setTela("enviado");
      }
    } catch (e) {
      void relatar(`depois:${secao}`, e);
      toast.error(t("naoSalvo"), { duration: 8000 });
    } finally {
      setOcupado(false);
    }
  }

  const emFila = !!fila;
  const props = { c, t, L, token, ocupado, gravar, idx, total: passos.length, emFila };
  const recado = c.revisoes.find((r) => r.secao === tela && r.status === "correcao")?.recado;

  return (
    <div className="min-h-screen bg-background pb-40">
      <Cabecalho idx={emFila ? filaTotal - fila!.length - 1 : idx} total={emFila ? filaTotal : passos.length} t={t} onPausa={() => document.dispatchEvent(new Event("evoque-pausa"))} />
      <main className="mx-auto max-w-md space-y-5 px-4 pt-2">
        <h1 className="text-3xl">{emFila && tela === "extras" ? t("demaisTitulo") : NOME_SECAO[tela][L]}</h1>
        {recado && (
          <div className="rounded-xl bg-warn/10 p-3 text-base font-semibold text-warn">
            {t("correcao")}: {recado}
          </div>
        )}
        {tela === "voce" && <PassoVoce {...props} />}
        {tela === "passaporte" && <PassoPassaporte {...props} />}
        {tela === "extras" && <PassoExtras {...props} />}
        {tela === "vistos" && <PassoVistos {...props} />}
        {tela === "fidelidade" && <PassoFidelidade {...props} />}
        {tela === "preferencias" && <PassoPreferencias {...props} />}
        {tela === "emergencia" && <PassoEmergencia {...props} />}
      </main>
    </div>
  );
}

type PassoProps = {
  c: CadastroDTO;
  t: (k: Chave) => string;
  L: L;
  token: string;
  ocupado: boolean;
  idx: number;
  total: number;
  gravar: (dados: Record<string, unknown>, depois: "proximo" | "pausa") => Promise<void>;
  emFila?: boolean;
};

function Cabecalho({ idx, total, t, onPausa }: { idx: number; total: number; t: (k: Chave) => string; onPausa: () => void }) {
  return (
    <header className="sticky top-0 z-10 bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-2">
          <p className="flex-1 text-base font-bold text-muted-foreground">
            {t("passo")} {idx + 1} {t("de")} {total}
          </p>
          <button onClick={onPausa} className="tap flex items-center gap-2 rounded-xl border-2 border-border px-3 text-base font-bold text-foreground">
            <PauseCircle size={22} strokeWidth={2.2} />
            {t("depois")}
          </button>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i <= idx ? "bg-accent" : "bg-muted"}`} />
          ))}
        </div>
      </div>
    </header>
  );
}

/** Liga o botão "Continuar depois" do cabeçalho ao passo atual. */
function usePausa(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = () => ref.current();
    document.addEventListener("evoque-pausa", h);
    return () => document.removeEventListener("evoque-pausa", h);
  }, []);
}

function Rodape({
  principal, onPrincipal, secundario, onSecundario, ocupado,
}: { principal: string; onPrincipal: () => void; secundario?: string; onSecundario?: () => void; ocupado: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-md gap-2">
        {secundario && (
          <button disabled={ocupado} onClick={onSecundario} className="tap flex-1 rounded-2xl border-2 border-border text-xl font-bold text-foreground disabled:opacity-60">
            {secundario}
          </button>
        )}
        <button disabled={ocupado} onClick={onPrincipal} className="gradient-hero shadow-medium tap flex-[2] rounded-2xl text-xl font-bold disabled:opacity-60">
          {ocupado ? "…" : principal}
        </button>
      </div>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-base font-bold text-foreground">{rotulo}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`tap flex items-center justify-center gap-2 rounded-xl border-2 px-3 text-lg font-bold ${
        ativo ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-foreground"
      }`}
    >
      {ativo && <Check size={20} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

function Segmentos<T extends string>({ valor, opcoes, onChange }: { valor: T | null; opcoes: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}>
      {opcoes.map(([v, r]) => (
        <Chip key={v} ativo={valor === v} onClick={() => onChange(v)}>
          {r}
        </Chip>
      ))}
    </div>
  );
}

function useUpload(token: string) {
  const pedir = useServerFn(urlUpload);
  return async (arquivo: File, max = 1600): Promise<{ path: string; blob: Blob; ext: Ext }> => {
    const { blob, ext, contentType } = await prepararArquivo(arquivo, max);
    const u = await pedir({ data: { token, ext } });
    const { error } = await supabase.storage.from("documentos").uploadToSignedUrl(u.path, u.token, blob, { contentType });
    if (error) throw error;
    return { path: u.path, blob, ext };
  };
}

function BotaoFoto({
  rotulo, onFoto, grande, previa, en,
}: { rotulo: string; onFoto: (f: File) => void; grande?: boolean; previa?: string | null; en?: boolean }) {
  return (
    <ZonaArquivo
      colar={grande}
      onArquivo={onFoto}
      className={
        grande
          ? "flex min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-4 border-dashed border-accent bg-accent/5 text-xl font-bold text-accent"
          : "tap flex items-center gap-2 rounded-xl border-2 border-border px-4 text-base font-bold text-foreground"
      }
    >
      {previa && !grande ? <Miniatura src={previa} className="h-10 w-10 rounded" /> : <Camera size={grande ? 44 : 24} strokeWidth={2.2} />}
      {rotulo}
      {grande && <DicaArrastar en={en} />}
    </ZonaArquivo>
  );
}

// ---------------- Boas-vindas ----------------
function BoasVindas({ c, t, onEscolher, ocupado }: { c: CadastroDTO; t: (k: Chave) => string; onEscolher: (m: "rapido" | "completo") => void; ocupado: boolean }) {
  const [ok, setOk] = useState(false);
  const L = c.person.idioma;
  const tiles: Secao[] = ["voce", "passaporte", "vistos", "fidelidade", "preferencias", "emergencia"];
  return (
    <div className="min-h-screen bg-background px-4 pb-10 pt-8">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-3xl">
            {t("ola")}, {c.person.apelido || c.person.nome.split(" ")[0]}
          </h1>
          <p className="mt-2 text-lg text-foreground">{t("sub")}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((s) => {
            const I = ICONE[s];
            return (
              <div key={s} className="flex flex-col items-center gap-2 rounded-2xl bg-muted p-3 text-center">
                <I size={28} strokeWidth={2.2} className="text-accent" />
                <span className="text-sm font-bold text-foreground">{NOME_SECAO[s][L]}</span>
              </div>
            );
          })}
        </div>
        <p className="text-base text-muted-foreground">{t("pode")}</p>
        <label className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1 h-7 w-7 shrink-0 accent-[var(--accent)]" />
          <span className="text-base text-foreground">{t("consent")}</span>
        </label>
        <div className="space-y-3">
          {(["rapido", "completo"] as const).map((m, i) => (
            <button
              key={m}
              disabled={!ok || ocupado}
              onClick={() => onEscolher(m)}
              className={`tap flex w-full flex-col items-center justify-center rounded-2xl py-3 disabled:opacity-50 ${
                i === 0 ? "gradient-hero shadow-medium" : "border-2 border-primary text-foreground"
              }`}
            >
              <span className="text-xl font-bold">{t(m)}</span>
              <span className="text-base">{t(m === "rapido" ? "rapidoSub" : "completoSub")}</span>
              {m === "rapido" && <span className="text-base font-semibold">{t("rapidoDepois")}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- Você ----------------
function PassoVoce({ c, t, token, ocupado, gravar }: PassoProps) {
  const p = c.person;
  const [v, setV] = useState({ apelido: p.apelido ?? "", cpf: p.cpf ?? "", telefone: p.telefone ?? "", email: p.email ?? "" });
  const [foto, setFoto] = useState<string | null>(p.foto_url);
  const [previa, setPrevia] = useState<string | null>(p.foto_url ? c.fotos[p.foto_url] ?? null : null);
  const upload = useUpload(token);
  const dados = () => ({ person: { ...v, foto_url: foto } });
  usePausa(() => gravar(dados(), "pausa"));
  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <ZonaArquivo
          aceita={ACEITA_FOTO}
          ariaLabel={t("foto")}
          onArquivo={async (f) => {
            setPrevia(URL.createObjectURL(f));
            try {
              const r = await upload(f, 800);
              setFoto(r.path);
            } catch {
              toast.error(t("erro"));
            }
          }}
          className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-dashed border-accent bg-accent/5"
        >
          {previa ? <img src={previa} alt="" className="h-full w-full object-cover" /> : <Camera size={40} strokeWidth={2.2} className="text-accent" />}
        </ZonaArquivo>
        <span className="text-base font-bold text-foreground">{t("foto")}</span>
      </div>
      <Campo rotulo={t("apelido")}>
        <input className={inp} value={v.apelido} onChange={(e) => setV({ ...v, apelido: e.target.value })} />
      </Campo>
      <Campo rotulo={t("cpf")}>
        <input className={inp} inputMode="numeric" value={v.cpf} onChange={(e) => setV({ ...v, cpf: e.target.value })} />
      </Campo>
      <Campo rotulo={t("whats")}>
        <input className={inp} inputMode="tel" value={v.telefone} onChange={(e) => setV({ ...v, telefone: e.target.value })} />
      </Campo>
      <Campo rotulo={t("email")}>
        <input className={inp} type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      </Campo>
      <p className="text-base text-muted-foreground">{t("notaNome")}</p>
      <Rodape
        ocupado={ocupado}
        principal={t("continuar")}
        onPrincipal={() => {
          if (!v.apelido.trim() || !v.telefone.trim()) return toast.error(`${t("falta")}: ${t("apelido")} / ${t("whats")}`);
          gravar(dados(), "proximo");
        }}
      />
    </>
  );
}

// ---------------- Passaporte ----------------
type PassLocal = DocDTO & { previa?: string | null; lido?: "ok" | "falhou" | "lendo" };

function PassoPassaporte({ c, t, L, token, ocupado, gravar }: PassoProps) {
  const existentes = c.docs.filter((d) => d.tipo === "passaporte");
  const [lista, setLista] = useState<PassLocal[]>(
    existentes.length
      ? existentes.map((d) => ({ ...d, previa: d.arquivo_path ? c.fotos[d.arquivo_path] ?? null : null }))
      : [{ tipo: "passaporte" }],
  );
  const [nasc, setNasc] = useState(c.person.data_nascimento ?? "");
  const upload = useUpload(token);
  const ler = useServerFn(lerPassaporte);
  const set = (i: number, v: Partial<PassLocal>) => setLista((ls) => ls.map((x, j) => (j === i ? { ...x, ...v } : x)));

  async function foto(i: number, f: File) {
    set(i, { previa: previaDe(f), lido: "lendo" });
    try {
      const { path, blob, ext } = await upload(f);
      set(i, { arquivo_path: path });
      if (ext === "pdf") return set(i, { lido: "falhou" });
      const r = await ler({ data: { token, imagem: await blobParaDataUrl(blob) } });
      if (r.ok) {
        const m = r.mrz;
        set(i, {
          lido: "ok",
          nome_no_documento: m.nomeCompleto || undefined,
          pais_emissor: m.nacionalidade || m.paisEmissor,
          numero: m.numero,
          validade: m.validade,
          sexo: m.sexo,
          ...(r.emissao ? { emissao: r.emissao } : {}),
        });
        if (m.nascimento) setNasc(m.nascimento);
      } else set(i, { lido: "falhou" });
    } catch {
      set(i, { lido: "falhou" });
    }
  }

  const dados = () => ({
    tiposDaSecao: ["passaporte"],
    docs: lista
      .filter((d) => d.numero || d.arquivo_path || d.nome_no_documento)
      .map(({ previa: _p, lido: _l, ...d }) => ({ ...d, tipo: "passaporte" })),
    person: { data_nascimento: nasc || null },
  });
  usePausa(() => gravar(dados(), "pausa"));

  return (
    <>
      {lista.map((d, i) => (
        <div key={i} className="space-y-3">
          {i > 0 && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-xl font-bold">{NOME_DOC_EN.passaporte && (L === "en" ? "Passport" : "Passaporte")} {i + 1}</p>
              <button onClick={() => setLista(lista.filter((_, j) => j !== i))} className="tap flex items-center gap-1 text-base font-bold text-muted-foreground">
                <X size={22} strokeWidth={2.2} /> {t("tirar")}
              </button>
            </div>
          )}
          {!d.previa ? (
            <BotaoFoto grande en={L === "en"} rotulo={t("fotoPass")} onFoto={(f) => foto(i, f)} />
          ) : (
            <div className={`flex items-center gap-3 rounded-2xl p-3 ${d.lido === "ok" ? "bg-ok/10 text-ok" : d.lido === "falhou" ? "bg-warn/10 text-warn" : "bg-muted text-foreground"}`}>
              <Miniatura src={d.previa} className="h-16 w-16 rounded-lg" />
              <span className="flex-1 text-base font-bold">
                {d.lido === "lendo" ? t("lendo") : d.lido === "ok" ? t("lemos") : d.lido === "falhou" ? t("naoLemos") : NOME_SECAO.passaporte[L]}
              </span>
              <ZonaArquivo colar onArquivo={(f) => foto(i, f)} className="tap flex flex-col items-center justify-center rounded-xl text-foreground">
                <RotateCcw size={24} strokeWidth={2.2} />
                <span className="text-sm font-bold">{t("refazer")}</span>
              </ZonaArquivo>
            </div>
          )}
          <Campo rotulo={t("nomePass")}>
            <input className={inp} value={d.nome_no_documento ?? ""} onChange={(e) => set(i, { nome_no_documento: e.target.value })} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo={t("nacionalidade")}>
              <input className={inp} value={d.pais_emissor ?? ""} onChange={(e) => set(i, { pais_emissor: e.target.value.toUpperCase() })} />
            </Campo>
            <Campo rotulo={t("numero")}>
              <input className={inp} value={d.numero ?? ""} onChange={(e) => set(i, { numero: e.target.value.toUpperCase() })} />
            </Campo>
          </div>
          <Campo rotulo={t("validade")}>
            <CampoData en={L === "en"} className={inp} value={d.validade ?? ""} onChange={(x) => set(i, { validade: x })} />
          </Campo>
          <Campo rotulo={L === "en" ? "Date of issue" : "Data de emissão"}>
            <CampoData en={L === "en"} className={inp} value={d.emissao ?? ""} onChange={(x) => set(i, { emissao: x })} />
          </Campo>
          {i === 0 && (
            <Campo rotulo={t("nascimento")}>
              <CampoData en={L === "en"} className={inp} value={nasc} onChange={setNasc} />
            </Campo>
          )}
          <div>
            <p className="text-base font-bold text-foreground">{t("sexo")}</p>
            <div className="mt-2">
              <Segmentos valor={(d.sexo as "M" | "F" | "X") ?? null} opcoes={[["F", "F"], ["M", "M"], ["X", "X"]]} onChange={(v) => set(i, { sexo: v })} />
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => setLista([...lista, { tipo: "passaporte" }])} className="tap flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-lg font-bold text-foreground">
        <Plus size={24} strokeWidth={2.2} />
        {t("outroPass")}
      </button>
      <Rodape
        ocupado={ocupado}
        principal={t("continuar")}
        onPrincipal={() => {
          if (!lista[0]?.numero?.trim()) return toast.error(`${t("falta")}: ${t("numero")}`);
          gravar(dados(), "proximo");
        }}
      />
    </>
  );
}

// ---------------- Outros documentos (e "Demais dados") ----------------
type DocLocal = DocDTO & { previa?: string | null };
const SIMPLES = TIPOS_EXTRA.filter((x) => x !== "vacina");

function PassoExtras({ c, t, L, token, ocupado, gravar, emFila }: PassoProps) {
  const [docs, setDocs] = useState<Record<string, DocLocal>>(() =>
    Object.fromEntries(
      c.docs.filter((d) => (TIPOS_EXTRA as readonly string[]).includes(d.tipo)).map((d) => [d.tipo, { ...d, previa: d.arquivo_path ? c.fotos[d.arquivo_path] ?? null : null }]),
    ),
  );
  const [outras, setOutras] = useState<DocLocal[]>(() =>
    c.docs.filter((d) => d.tipo === "outra_vacina").map((d) => ({ ...d, previa: d.arquivo_path ? c.fotos[d.arquivo_path] ?? null : null })),
  );
  const [endereco, setEndereco] = useState(c.person.endereco ?? "");
  // Em "Demais dados" só aparece o que ainda está vazio (o que já tem continua salvo).
  const [preenchidos] = useState(() => new Set(emFila ? c.docs.map((d) => d.tipo) : []));
  const [endPreenchido] = useState(() => !!emFila && !!c.person.endereco);
  const upload = useUpload(token);
  const nomes = L === "en" ? NOME_DOC_EN : NOME_DOC;
  const dados = () => ({
    tiposDaSecao: [...TIPOS_SECAO_EXTRAS],
    docs: [
      ...Object.values(docs).map(({ previa: _p, ...d }) => d),
      ...outras.filter((o) => o.detalhe?.trim() || o.arquivo_path).map(({ previa: _p, ...d }) => ({ ...d, tipo: "outra_vacina" })),
    ],
    person: { endereco: endereco || null },
  });
  usePausa(() => gravar(dados(), "pausa"));
  const upd = (tipo: string, v: Partial<DocLocal>) => setDocs((d) => ({ ...d, [tipo]: { tipo, ...d[tipo], ...v } }));
  const updOutra = (i: number, v: Partial<DocLocal>) => setOutras((ls) => ls.map((x, j) => (j === i ? { ...x, ...v } : x)));
  async function subir(f: File, onPath: (p: string) => void) {
    try {
      const r = await upload(f);
      onPath(r.path);
    } catch {
      toast.error(t("erro"));
    }
  }
  const febre = docs.vacina;

  return (
    <>
      {!preenchidos.has("vacina") && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-3">
            <Syringe size={28} strokeWidth={2.2} className="text-accent" />
            <span className="flex-1 text-lg font-bold text-foreground">
              {t("vacinas")} · {t("febre")}
            </span>
          </div>
          <p className="text-base font-bold text-foreground">{t("certificado")}</p>
          <Segmentos
            valor={febre ? "s" : null}
            opcoes={[["s", t("sim")], ["n", t("nao")]]}
            onChange={(x) =>
              x === "s"
                ? upd("vacina", {})
                : setDocs((d) => {
                    const n = { ...d };
                    delete n.vacina;
                    return n;
                  })
            }
          />
          {febre && (
            <>
              <BotaoFoto
                rotulo={t("fotoCert")}
                previa={febre.previa}
                onFoto={(f) => {
                  upd("vacina", { previa: previaDe(f) });
                  void subir(f, (p) => upd("vacina", { arquivo_path: p }));
                }}
              />
              <Campo rotulo={t("dataVacina")}>
                <CampoData en={L === "en"} className={inp} value={febre.emissao ?? ""} onChange={(x) => upd("vacina", { emissao: x })} />
              </Campo>
            </>
          )}
        </div>
      )}
      {outras.map((o, i) => (
        <div key={o.id ?? `n${i}`} className="space-y-3 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-3">
            <Syringe size={28} strokeWidth={2.2} className="text-accent" />
            <span className="flex-1 text-lg font-bold text-foreground">{t("outraVacina")}</span>
            <button onClick={() => setOutras(outras.filter((_, j) => j !== i))} className="tap flex items-center gap-1 text-base font-bold text-muted-foreground">
              <X size={22} strokeWidth={2.2} /> {t("tirar")}
            </button>
          </div>
          <Campo rotulo={t("nomeVacina")}>
            <input className={inp} value={o.detalhe ?? ""} onChange={(e) => updOutra(i, { detalhe: e.target.value })} />
          </Campo>
          <Campo rotulo={t("dataVacina")}>
            <CampoData en={L === "en"} className={inp} value={o.emissao ?? ""} onChange={(x) => updOutra(i, { emissao: x })} />
          </Campo>
          <BotaoFoto
            rotulo={t("foto_")}
            previa={o.previa}
            onFoto={(f) => {
              updOutra(i, { previa: previaDe(f) });
              void subir(f, (p) => updOutra(i, { arquivo_path: p }));
            }}
          />
        </div>
      ))}
      <button
        onClick={() => setOutras([...outras, { tipo: "outra_vacina" }])}
        className="tap flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-lg font-bold text-foreground"
      >
        <Plus size={24} strokeWidth={2.2} />
        {t("outraVacina")}
      </button>

      {SIMPLES.filter((tipo) => !preenchidos.has(tipo)).map((tipo) => {
        const I = ICONE_EXTRA[tipo] ?? IdCard;
        const d = docs[tipo];
        const numRot = tipo === "seguro" ? t("apolice") : tipo === "global_entry" ? t("viajante") : t("numero");
        return (
          <div key={tipo} className="space-y-2 rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <I size={28} strokeWidth={2.2} className="text-accent" />
              <span className="flex-1 text-lg font-bold text-foreground">{nomes[tipo]}</span>
              <BotaoFoto
                rotulo={d?.arquivo_path ? "✓" : t("foto_")}
                previa={d?.previa}
                onFoto={(f) => {
                  upd(tipo, { previa: previaDe(f) });
                  void subir(f, (p) => upd(tipo, { arquivo_path: p }));
                }}
              />
            </div>
            {d && (
              <div className="grid grid-cols-2 gap-2">
                <input aria-label={numRot} placeholder={numRot} className={inp} value={d.numero ?? ""} onChange={(e) => upd(tipo, { numero: e.target.value })} />
                <CampoData ariaLabel={t("validade")} en={L === "en"} className={inp} value={d.validade ?? ""} onChange={(x) => upd(tipo, { validade: x })} />
              </div>
            )}
            {!d && (
              <button onClick={() => upd(tipo, {})} className="tap text-base font-bold text-accent underline">
                {L === "en" ? "Type the number" : "Digitar o número"}
              </button>
            )}
          </div>
        );
      })}
      {!endPreenchido && (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-3">
            <Home size={28} strokeWidth={2.2} className="text-accent" />
            <span className="text-lg font-bold text-foreground">{t("endereco")}</span>
          </div>
          <input aria-label={t("endereco")} className={inp} value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </div>
      )}
      <Rodape ocupado={ocupado} secundario={t("pular")} onSecundario={() => gravar({ pulou: true }, "proximo")} principal={t("continuar")} onPrincipal={() => gravar(dados(), "proximo")} />
    </>
  );
}

// ---------------- Vistos ----------------
function PassoVistos({ c, t, L, token, ocupado, gravar, emFila }: PassoProps) {
  const [sel, setSel] = useState<Record<string, DocDTO & { previa?: string | null }>>(() =>
    Object.fromEntries(
      c.docs.filter((d) => (TIPOS_VISTO as readonly string[]).includes(d.tipo)).map((d) => [d.tipo, { ...d, previa: d.arquivo_path ? c.fotos[d.arquivo_path] ?? null : null }]),
    ),
  );
  const upload = useUpload(token);
  const nomes = L === "en" ? NOME_DOC_EN : NOME_DOC;
  const [negado, setNegado] = useState<boolean | null>(c.person.visto_negado);
  const [negadoDet, setNegadoDet] = useState(c.person.visto_negado_detalhe ?? "");
  const pessoaNeg = () => ({ visto_negado: negado, visto_negado_detalhe: negado ? negadoDet || null : null });
  const dados = () => ({ tiposDaSecao: [...TIPOS_VISTO], docs: Object.values(sel).map(({ previa: _p, ...d }) => d), person: pessoaNeg() });
  usePausa(() => gravar(dados(), "pausa"));
  const upd = (tipo: string, v: Partial<DocDTO & { previa?: string | null }>) => setSel((s) => ({ ...s, [tipo]: { ...s[tipo]!, ...v } }));
  return (
    <>
      <p className="text-lg text-foreground">{t("toqueVistos")}</p>
      <div className="grid grid-cols-2 gap-2">
        {TIPOS_VISTO.map((tipo) => (
          <Chip
            key={tipo}
            ativo={!!sel[tipo]}
            onClick={() =>
              setSel((s) => {
                const n = { ...s };
                if (n[tipo]) delete n[tipo];
                else n[tipo] = { tipo };
                return n;
              })
            }
          >
            {tipo === "outro_visto" ? `+ ${t("outro")}` : nomes[tipo]}
          </Chip>
        ))}
      </div>
      {Object.values(sel).map((d) => (
        <div key={d.tipo} className="space-y-3 rounded-2xl border border-border bg-card p-3">
          <p className="text-lg font-bold text-foreground">{nomes[d.tipo]}</p>
          <BotaoFoto
            rotulo={t("fotoVisto")}
            previa={d.previa}
            onFoto={async (f) => {
              upd(d.tipo, { previa: previaDe(f) });
              try {
                const r = await upload(f);
                upd(d.tipo, { arquivo_path: r.path });
              } catch {
                toast.error(t("erro"));
              }
            }}
          />
          {(d.tipo === "visto" || d.tipo === "outro_visto") && (
            <input aria-label={t("tipoVisto")} placeholder={t("tipoVisto")} className={inp} value={d.detalhe ?? ""} onChange={(e) => upd(d.tipo, { detalhe: e.target.value })} />
          )}
          <Campo rotulo={t("validade")}>
            <CampoData en={L === "en"} className={inp} value={d.validade ?? ""} onChange={(x) => upd(d.tipo, { validade: x })} />
          </Campo>
        </div>
      ))}
      <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
        <p className="text-base font-bold text-foreground">{t("negado")}</p>
        <Segmentos valor={negado == null ? null : negado ? "s" : "n"} opcoes={[["s", t("sim")], ["n", t("nao")]]} onChange={(x) => setNegado(x === "s")} />
        {negado && (
          <Campo rotulo={t("negadoDet")}>
            <input className={inp} value={negadoDet} onChange={(e) => setNegadoDet(e.target.value)} />
          </Campo>
        )}
      </div>
      <Rodape
        ocupado={ocupado}
        secundario={emFila ? t("pular") : t("naoTenho")}
        onSecundario={() => (emFila ? gravar({ pulou: true }, "proximo") : gravar({ tiposDaSecao: [...TIPOS_VISTO], docs: [], person: pessoaNeg() }, "proximo"))}
        principal={t("continuar")}
        onPrincipal={() => gravar(dados(), "proximo")}
      />
    </>
  );
}

// ---------------- Fidelidade ----------------
function PassoFidelidade({ c, t, ocupado, gravar }: PassoProps) {
  const [contas, setContas] = useState<ContaDTO[]>(c.contas.map((x) => ({ programa: x.programa, numero: x.numero, tipo: x.tipo })));
  const [outro, setOutro] = useState("");
  const tem = (n: string) => contas.some((x) => x.programa === n);
  const toggle = (n: string, tipo: string) => setContas(tem(n) ? contas.filter((x) => x.programa !== n) : [...contas, { programa: n, numero: "", tipo }]);
  const dados = () => ({ contas: contas.filter((x) => x.programa.trim()) });
  usePausa(() => gravar(dados(), "pausa"));
  return (
    <>
      {([false, true] as const).map((vip) => (
        <div key={String(vip)}>
          <p className="mb-2 text-base font-bold text-foreground">{vip ? t("salaVip") : t("programas")}</p>
          <div className="grid grid-cols-2 gap-2">
            {PROGRAMAS.filter((p) => (p.tipo === "sala_vip") === vip).map((p) => (
              <Chip key={p.nome} ativo={tem(p.nome)} onClick={() => toggle(p.nome, p.tipo)}>
                {p.nome}
              </Chip>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <input aria-label={t("qualPrograma")} placeholder={`+ ${t("outro")}: ${t("qualPrograma")}`} className={inp} value={outro} onChange={(e) => setOutro(e.target.value)} />
        <button
          aria-label={t("outro")}
          onClick={() => {
            if (outro.trim() && !tem(outro.trim())) setContas([...contas, { programa: outro.trim(), numero: "", tipo: "aerea" }]);
            setOutro("");
          }}
          className="tap flex w-14 shrink-0 items-center justify-center rounded-xl border-2 border-border text-foreground"
        >
          <Plus size={24} strokeWidth={2.2} />
        </button>
      </div>
      {contas.map((x, i) => (
        <Campo key={x.programa} rotulo={`${x.programa} · ${t("numero")}`}>
          <input className={inp} value={x.numero ?? ""} onChange={(e) => setContas(contas.map((y, j) => (j === i ? { ...y, numero: e.target.value } : y)))} />
        </Campo>
      ))}
      <p className="text-base text-muted-foreground">{t("semSenha")}</p>
      <Rodape ocupado={ocupado} secundario={t("pular")} onSecundario={() => gravar({ pulou: true }, "proximo")} principal={t("continuar")} onPrincipal={() => gravar(dados(), "proximo")} />
    </>
  );
}

// ---------------- Preferências ----------------
function PassoPreferencias({ c, t, L, ocupado, gravar }: PassoProps) {
  const [v, setV] = useState({
    assento: c.prefs?.assento ?? null,
    quarto: c.prefs?.quarto ?? null,
    bebe_alcool: c.prefs?.bebe_alcool ?? null,
    restricoes: c.prefs?.restricoes ?? [],
    refeicao_voo: c.prefs?.refeicao_voo ?? null,
  });
  const naLista = (x: string | null) => !x || REFEICOES.some((r) => r.v === x);
  const refSel = v.refeicao_voo == null ? null : naLista(v.refeicao_voo) ? v.refeicao_voo : "outra";
  const dados = () => ({ prefs: v });
  usePausa(() => gravar(dados(), "pausa"));
  return (
    <>
      <div>
        <p className="text-base font-bold text-foreground">{t("assento")}</p>
        <div className="mt-2">
          <Segmentos valor={v.assento} opcoes={[["janela", t("janela")], ["corredor", t("corredor")], ["tanto_faz", t("tantoFaz")]]} onChange={(x) => setV({ ...v, assento: x })} />
        </div>
      </div>
      <div>
        <p className="text-base font-bold text-foreground">{t("quarto")}</p>
        <div className="mt-2">
          <Segmentos valor={v.quarto} opcoes={[["casal", t("casal")], ["duas_camas", t("duasCamas")], ["tanto_faz", t("tantoFaz")]]} onChange={(x) => setV({ ...v, quarto: x })} />
        </div>
      </div>
      <div>
        <p className="text-base font-bold text-foreground">{t("alcool")}</p>
        <div className="mt-2">
          <Segmentos
            valor={v.bebe_alcool == null ? null : v.bebe_alcool ? "s" : "n"}
            opcoes={[["s", t("sim")], ["n", t("nao")]]}
            onChange={(x) => setV({ ...v, bebe_alcool: x === "s" })}
          />
        </div>
      </div>
      <div>
        <p className="text-base font-bold text-foreground">{t("comida")}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {COMIDAS.map((cm) => (
            <Chip
              key={cm.v}
              ativo={v.restricoes.includes(cm.v)}
              onClick={() => setV({ ...v, restricoes: v.restricoes.includes(cm.v) ? v.restricoes.filter((x) => x !== cm.v) : [...v.restricoes, cm.v] })}
            >
              {cm[L]}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="text-base font-bold text-foreground">{t("refeicao")}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {REFEICOES.map((r) => (
            <Chip key={r.v} ativo={refSel === r.v} onClick={() => setV({ ...v, refeicao_voo: r.v })}>
              {r[L]}
            </Chip>
          ))}
        </div>
        {refSel === "outra" && (
          <div className="mt-2">
            <Campo rotulo={t("qualRefeicao")}>
              <input
                className={inp}
                value={v.refeicao_voo === "outra" ? "" : v.refeicao_voo ?? ""}
                onChange={(e) => setV({ ...v, refeicao_voo: e.target.value.trim() ? e.target.value : "outra" })}
              />
            </Campo>
          </div>
        )}
      </div>
      <Rodape ocupado={ocupado} secundario={t("pular")} onSecundario={() => gravar({ pulou: true }, "proximo")} principal={t("continuar")} onPrincipal={() => gravar(dados(), "proximo")} />
    </>
  );
}

// ---------------- Emergência ----------------
function PassoEmergencia({ c, t, L, ocupado, gravar, idx, total }: PassoProps) {
  const p = c.person;
  const [v, setV] = useState({ emergencia_nome: p.emergencia_nome ?? "", emergencia_parentesco: p.emergencia_parentesco ?? "", emergencia_telefone: p.emergencia_telefone ?? "" });
  const dados = () => ({ person: v });
  usePausa(() => gravar(dados(), "pausa"));
  return (
    <>
      <Campo rotulo={t("contato")}>
        <input className={inp} value={v.emergencia_nome} onChange={(e) => setV({ ...v, emergencia_nome: e.target.value })} />
      </Campo>
      <div>
        <p className="text-base font-bold text-foreground">{t("parentesco")}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PARENTESCOS.map((x) => (
            <Chip key={x.pt} ativo={v.emergencia_parentesco === x.pt} onClick={() => setV({ ...v, emergencia_parentesco: x.pt })}>
              {x[L]}
            </Chip>
          ))}
        </div>
      </div>
      <Campo rotulo={t("telefone")}>
        <input className={inp} inputMode="tel" value={v.emergencia_telefone} onChange={(e) => setV({ ...v, emergencia_telefone: e.target.value })} />
      </Campo>
      <Rodape
        ocupado={ocupado}
        principal={idx + 1 === total ? t("enviar") : t("continuar")}
        onPrincipal={() => {
          if (!v.emergencia_nome.trim() || !v.emergencia_telefone.trim()) return toast.error(`${t("falta")}: ${t("contato")} / ${t("telefone")}`);
          gravar(dados(), "proximo");
        }}
      />
    </>
  );
}

// ---------------- Enviado ----------------
function Enviado({
  c, t, L, onCorrigir, onDemais, ocupado,
}: { c: CadastroDTO; t: (k: Chave) => string; L: L; onCorrigir: () => void; onDemais: () => void; ocupado: boolean }) {
  const passos = passosDoModo(c.person.modo).filter((s) => s !== "extras");
  const tem = (s: Secao) => {
    switch (s) {
      case "voce": return !!c.person.apelido;
      case "passaporte": return c.docs.some((d) => d.tipo === "passaporte");
      case "vistos": return c.docs.some((d) => (TIPOS_VISTO as readonly string[]).includes(d.tipo));
      case "fidelidade": return c.contas.length > 0;
      case "preferencias": return !!c.prefs;
      case "emergencia": return !!c.person.emergencia_nome;
      default: return false;
    }
  };
  return (
    <div className="min-h-screen bg-background px-4 pb-10 pt-12">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <CheckCircle2 size={96} strokeWidth={2.2} className="mx-auto text-ok" />
        <h1 className="text-3xl">
          {t("pronto")}, {c.person.apelido || c.person.nome.split(" ")[0]}!
        </h1>
        <p className="text-lg text-foreground">{t("vaiConferir")}</p>
        <ul className="space-y-2 text-left">
          {passos.map((s) => (
            <li key={s} className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
              {tem(s) ? <Check size={24} strokeWidth={2.2} className="text-ok" /> : <X size={24} strokeWidth={2.2} className="text-muted-foreground" />}
              <span className="flex-1 text-lg font-semibold text-foreground">{NOME_SECAO[s][L]}</span>
              {!tem(s) && <span className="text-base text-muted-foreground">{t("naoTenho")}</span>}
            </li>
          ))}
        </ul>
        <button onClick={onCorrigir} className="tap w-full rounded-2xl border-2 border-primary text-xl font-bold text-foreground">
          {t("corrigirAlgo")}
        </button>
        <button disabled={ocupado} onClick={onDemais} className="tap w-full rounded-2xl border-2 border-accent bg-accent/5 text-xl font-bold text-foreground disabled:opacity-60">
          {ocupado ? "…" : t("demais")}
        </button>
      </div>
    </div>
  );
}
