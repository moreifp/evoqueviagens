import { useEffect, useState } from "react";
import { Camera, Eye, EyeOff, Image as ImageIcon, Pencil, Trash2, Check, X } from "lucide-react";
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
          <button onClick={onEditar} aria-label={`Editar ${titulo}`} className="tap flex flex-col items-center justify-center rounded-xl text-foreground">
            <Pencil size={24} strokeWidth={2.2} />
            <span className="text-sm font-bold">Editar</span>
          </button>
        )}
        {onApagar && (
          <button onClick={onApagar} aria-label={`Apagar ${titulo}`} className="tap flex flex-col items-center justify-center rounded-xl text-destructive">
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
  return (
    <div className="mt-2">
      {url ? (
        <img src={url} alt="Foto do documento" className="w-full rounded-xl border border-border" onError={() => setUrl(null)} />
      ) : (
        <button
          onClick={async () => {
            if (!navigator.onLine) return toast.error("A foto só abre com internet.");
            const u = await urlAssinada(path);
            if (u) setUrl(u);
          }}
          className="tap flex items-center gap-2 rounded-xl border-2 border-border px-4 text-base font-bold text-foreground"
        >
          <ImageIcon size={24} strokeWidth={2.2} />
          {rotulo}
        </button>
      )}
    </div>
  );
}

export type CampoEd = { chave: string; rotulo: string; tipo?: "text" | "date" | "tel" | "email"; opcoes?: [string, string][] };

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
 */
export function Editor({
  campos,
  valores,
  onSalvar,
  onCancelar,
  foto,
}: {
  campos: CampoEd[];
  valores: Record<string, unknown>;
  onSalvar: (v: Record<string, string | null>, novaFoto?: File | null) => void;
  onCancelar: () => void;
  foto?: { path: string | null };
}) {
  const [inicial] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.chave, paraTexto(valores[c.chave])])),
  );
  const [v, setV] = useState<Record<string, string>>(inicial);
  // undefined = não mexeu; File = trocou; null = removeu
  const [novaFoto, setNovaFoto] = useState<File | null | undefined>(undefined);
  const [previa, setPrevia] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    if (foto?.path && navigator.onLine) urlAssinada(foto.path).then((u) => vivo && u && setPrevia(u));
    return () => {
      vivo = false;
    };
  }, [foto?.path]);

  function salvar() {
    const mudou: Record<string, string | null> = {};
    for (const c of campos) {
      const a = (inicial[c.chave] ?? "").trim();
      const n = (v[c.chave] ?? "").trim();
      if (a !== n) mudou[c.chave] = n === "" ? null : n;
    }
    onSalvar(mudou, novaFoto);
  }

  const mostraFoto = novaFoto === null ? null : novaFoto ? URL.createObjectURL(novaFoto) : previa;

  return (
    <div className="space-y-3">
      {foto && (
        <div className="space-y-2">
          <span className="text-base font-bold text-foreground">Foto</span>
          {mostraFoto ? (
            <img src={mostraFoto} alt="Foto do documento" className="w-full rounded-xl border border-border" />
          ) : (
            <p className="text-base text-muted-foreground">
              {novaFoto === null ? "Foto será removida ao salvar." : foto.path ? "Foto guardada (abre com internet)." : "Sem foto."}
            </p>
          )}
          <div className="flex gap-2">
            <label className="tap flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-border text-base font-bold text-foreground">
              <Camera size={24} strokeWidth={2.2} />
              {foto.path || novaFoto ? "Trocar foto" : "Pôr foto"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setNovaFoto(f);
                }}
              />
            </label>
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
                onClick={() => setNovaFoto(undefined)}
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
                    v[c.chave] === k ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
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
