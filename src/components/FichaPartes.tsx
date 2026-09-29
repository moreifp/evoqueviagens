import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  Check,
  X,
} from "lucide-react";
import {
  DicaArrastar,
  Miniatura,
  TirarFoto,
  ZonaArquivo,
  previaDe,
} from "@/components/ArquivoFoto";
import { toast } from "sonner";
import { inputCls } from "@/components/Form";
import { mascarar, urlAssinada } from "@/lib/pessoas";

export function Cartao({
  titulo,
  children,
  onEditar,
  onApagar,
  extra,
}: {
  titulo: string;
  children: React.ReactNode;
  onEditar?: () => void;
  onApagar?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <section className="shadow-soft rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-xl">{titulo}</h2>
        {extra}
        {onEditar && (
          <button
            onClick={onEditar}
            aria-label={`Editar ${titulo}`}
            className="tap flex flex-col items-center justify-center rounded-xl text-foreground"
          >
            <Pencil size={24} strokeWidth={2.2} />
            <span className="text-sm font-bold">Editar</span>
          </button>
        )}
        {onApagar && (
          <button
            onClick={onApagar}
            aria-label={`Apagar ${titulo}`}
            className="tap flex flex-col items-center justify-center rounded-xl text-destructive"
          >
            <Trash2 size={24} strokeWidth={2.2} />
            <span className="text-sm font-bold">Apagar</span>
          </button>
        )}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function Dado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="text-base text-muted-foreground">{rotulo}</span>
      <span className="text-right text-lg font-semibold text-foreground">{valor || "—"}</span>
    </div>
  );
}

export function NumeroOculto({ numero }: { numero: string | null }) {
  const [ver, setVer] = useState(false);
  if (!numero) return <span>—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">{ver ? numero : mascarar(numero)}</span>
      <button
        onClick={() => setVer(!ver)}
        aria-label={ver ? "Esconder número" : "Mostrar número"}
        className="flex h-14 w-14 items-center justify-center rounded-xl text-accent"
      >
        {ver ? <EyeOff size={24} strokeWidth={2.2} /> : <Eye size={24} strokeWidth={2.2} />}
      </button>
    </span>
  );
}

export function VerFoto({ path, rotulo = "Ver foto" }: { path: string | null; rotulo?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  if (!path) return null;
  const pdf = /\.pdf$/i.test(path);
  return (
    <div className="mt-2">
      {url && !pdf ? (
        <img
          src={url}
          alt="Foto do documento"
          className="w-full rounded-xl border border-border"
          onError={() => setUrl(null)}
        />
      ) : (
        <button
          onClick={async () => {
            if (!navigator.onLine) return toast.error("A foto só abre com internet.");
            const u = await urlAssinada(path);
            if (!u) return;
            if (pdf) window.open(u, "_blank", "noopener");
            else setUrl(u);
          }}
          className="tap flex items-center gap-2 rounded-xl border-2 border-border px-4 text-base font-bold text-foreground"
        >
          {pdf ? (
            <FileText size={24} strokeWidth={2.2} />
          ) : (
            <ImageIcon size={24} strokeWidth={2.2} />
          )}
          {pdf ? "Abrir PDF" : rotulo}
        </button>
      )}
    </div>
  );
}

/**
 * Campo de data que mostra VAZIO quando não há data.
 * (O iPhone desenha a data de hoje num campo de data vazio; aqui o texto fica escondido e
 * aparece "Vazio · toque para escolher".) Tem botão para limpar.
 */
export function CampoData({
  value,
  onChange,
  className,
  ariaLabel,
  en,
}: {
  value: string;
  onChange: (v: string) => void;
  className: string;
  ariaLabel?: string;
  en?: boolean;
}) {
  const vazio = !value;
  return (
    <div className="relative">
      <input
        type="date"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${className} pr-16 ${vazio ? "text-transparent [-webkit-text-fill-color:transparent] [&::-webkit-date-and-time-value]:text-transparent" : ""}`}
      />
      {vazio && (
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-muted-foreground">
          {en ? "Empty" : "Vazio"}
        </span>
      )}
      {!vazio && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={en ? "Clear date" : "Limpar data"}
          className="absolute right-1 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground"
        >
          <X size={22} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

export type CampoEd = {
  chave: string;
  rotulo: string;
  tipo?: "text" | "date" | "tel" | "email";
  opcoes?: [string, string][];
};

function paraTexto(x: unknown): string {
  if (x == null) return "";
  const s = String(x);
  // datas vindas como timestamp: o campo de data só aceita AAAA-MM-DD
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s;
}

/**
 * Formulário pré-preenchido com os valores atuais.
 * onSalvar recebe SÓ os campos que mudaram (campos não tocados nunca viram vazio).
 * Se `foto` for passado, mostra a foto atual com Trocar/Remover; a foto só muda se o admin pedir.
 * `lerFoto`: ao escolher foto nova, tenta ler (passaporte) e PRÉ-PREENCHE os campos — nada é salvo sem "Salvar".
 */
export function Editor({
  campos,
  valores,
  onSalvar,
  onCancelar,
  foto,
  fotoInicial,
  lerFoto,
  orientacaoFoto,
}: {
  campos: CampoEd[];
  valores: Record<string, unknown>;
  onSalvar: (v: Record<string, string | null>, novaFoto?: File | null) => void;
  onCancelar: () => void;
  foto?: { path: string | null };
  fotoInicial?: File;
  lerFoto?: (f: File) => Promise<Record<string, string> | null>;
  orientacaoFoto?: string;
}) {
  const [inicial] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.chave, paraTexto(valores[c.chave])])),
  );
  const [v, setV] = useState<Record<string, string>>(inicial);
  // undefined = não mexeu; File = trocou; null = removeu
  const [novaFoto, setNovaFoto] = useState<File | null | undefined>(undefined);
  const [previa, setPrevia] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<"lendo" | "ok" | "falhou" | null>(null);
  const [ultimaFoto, setUltimaFoto] = useState<File | null>(null);

  useEffect(() => {
    let vivo = true;
    if (foto?.path && navigator.onLine)
      urlAssinada(foto.path).then((u) => vivo && u && setPrevia(u));
    return () => {
      vivo = false;
    };
  }, [foto?.path]);

  async function escolher(f: File) {
    setNovaFoto(f);
    if (!lerFoto) return;
    setUltimaFoto(f);
    await ler(f);
  }

  /** Tenta ler a foto e pré-preencher os campos; guarda a foto para "Tentar de novo". */
  async function ler(f: File) {
    if (!lerFoto) return;
    setLeitura("lendo");
    try {
      const r = await lerFoto(f);
      if (r && Object.keys(r).length) {
        setV((atual) => ({ ...atual, ...r }));
        setLeitura("ok");
      } else setLeitura("falhou");
    } catch {
      setLeitura("falhou");
    }
  }

  useEffect(() => {
    if (fotoInicial) escolher(fotoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function salvar() {
    const mudou: Record<string, string | null> = {};
    for (const c of campos) {
      const a = (inicial[c.chave] ?? "").trim();
      const n = (v[c.chave] ?? "").trim();
      if (a !== n) mudou[c.chave] = n === "" ? null : n;
    }
    onSalvar(mudou, novaFoto);
  }

  const urlNova = useMemo(() => (novaFoto ? previaDe(novaFoto) : null), [novaFoto]);
  const mostraFoto = novaFoto === null ? null : novaFoto ? urlNova : previa;

  return (
    <div className="space-y-3">
      {foto && (
        <div className="space-y-2">
          <span className="text-base font-bold text-foreground">Foto</span>
          {orientacaoFoto && (
            <p className="rounded-xl border border-border bg-muted p-3 text-base text-foreground">
              {orientacaoFoto}
            </p>
          )}
          {mostraFoto ? (
            mostraFoto === "pdf" || /\.pdf(\?|$)/i.test(mostraFoto) ? (
              <Miniatura src="pdf" className="h-24 w-full rounded-xl" />
            ) : (
              <img
                src={mostraFoto}
                alt="Foto do documento"
                className="w-full rounded-xl border border-border"
              />
            )
          ) : (
            <p className="text-base text-muted-foreground">
              {novaFoto === null
                ? "Foto será removida ao salvar."
                : foto.path
                  ? "Foto guardada (abre com internet)."
                  : "Sem foto."}
            </p>
          )}
          {leitura === "lendo" && (
            <p
              className="flex items-center gap-2 rounded-xl bg-muted p-3 text-base font-bold text-foreground"
              role="status"
            >
              <Loader2 size={24} strokeWidth={2.2} className="animate-spin" aria-hidden />
              Lendo a foto… pode levar alguns segundos.
            </p>
          )}
          {leitura === "ok" && (
            <p
              className="flex items-center gap-2 rounded-xl bg-ok/10 p-3 text-base font-bold text-ok"
              role="status"
            >
              <Check size={24} strokeWidth={2.2} aria-hidden />
              Lemos a foto · confira os campos e toque Salvar
            </p>
          )}
          {leitura === "falhou" && (
            <div className="space-y-2 rounded-xl bg-warn/10 p-3" role="alert">
              <p className="text-base font-bold text-warn">
                Não deu para ler a foto. Você pode preencher à mão ou tentar de novo.
              </p>
              {ultimaFoto && (
                <button
                  type="button"
                  onClick={() => ler(ultimaFoto)}
                  className="tap flex w-full items-center justify-center gap-2 rounded-xl border-2 border-warn text-base font-bold text-warn"
                >
                  <RefreshCw size={24} strokeWidth={2.2} aria-hidden />
                  Tentar ler de novo
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <ZonaArquivo
              colar
              onArquivo={escolher}
              className="tap flex w-full flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border py-2 text-base font-bold text-foreground"
            >
              <span className="flex items-center gap-2">
                <Camera size={24} strokeWidth={2.2} />
                {foto.path || novaFoto ? "Trocar foto" : "Pôr foto"}
              </span>
              <DicaArrastar />
            </ZonaArquivo>
            <TirarFoto onFoto={escolher} className="flex-1" />
            {(foto.path || novaFoto) && novaFoto !== null && (
              <button
                type="button"
                onClick={() => setNovaFoto(null)}
                className="tap flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-destructive text-base font-bold text-destructive"
              >
                <Trash2 size={24} strokeWidth={2.2} />
                Remover foto
              </button>
            )}
            {novaFoto !== undefined && (
              <button
                type="button"
                onClick={() => {
                  setNovaFoto(undefined);
                  setLeitura(null);
                }}
                className="tap flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-border text-base font-bold text-foreground"
              >
                <X size={24} strokeWidth={2.2} />
                Manter a antiga
              </button>
            )}
          </div>
        </div>
      )}
      {campos.map((c) => (
        <label key={c.chave} className="block">
          <span className="text-base font-bold text-foreground">{c.rotulo}</span>
          {c.opcoes ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {c.opcoes.map(([k, r]) => (
                <button
                  type="button"
                  key={k}
                  aria-pressed={v[c.chave] === k}
                  onClick={() => setV({ ...v, [c.chave]: k })}
                  className={`tap rounded-full border-2 px-4 text-base font-bold ${
                    v[c.chave] === k
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          ) : c.tipo === "date" ? (
            <div className="mt-2">
              <CampoData
                ariaLabel={c.rotulo}
                value={v[c.chave] ?? ""}
                onChange={(x) => setV({ ...v, [c.chave]: x })}
                className={inputCls}
              />
            </div>
          ) : (
            <input
              type={c.tipo ?? "text"}
              value={v[c.chave] ?? ""}
              onChange={(e) => setV({ ...v, [c.chave]: e.target.value })}
              className={`${inputCls} mt-2`}
            />
          )}
        </label>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="tap flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-border text-lg font-bold text-foreground"
        >
          <X size={24} strokeWidth={2.2} />
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          className="tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground"
        >
          <Check size={24} strokeWidth={2.2} />
          Salvar
        </button>
      </div>
    </div>
  );
}

export function dataBR(d: string | null) {
  if (!d) return null;
  const [y, m, dia] = d.split("-");
  return `${dia}/${m}/${y}`;
}
