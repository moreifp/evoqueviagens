import { useEffect, useState } from "react";
import { iniciais, urlAssinada, type Nivel } from "@/lib/pessoas";

export function AvatarPessoa({ nome, foto, tamanho = 56 }: { nome: string; foto: string | null; tamanho?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!foto || !navigator.onLine) return;
    let vivo = true;
    urlAssinada(foto).then((u) => vivo && setUrl(u));
    return () => {
      vivo = false;
    };
  }, [foto]);
  return (
    <span
      style={{ width: tamanho, height: tamanho }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-lg font-bold text-secondary-foreground"
      aria-hidden
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" onError={() => setUrl(null)} /> : iniciais(nome)}
    </span>
  );
}

const COR: Record<Nivel, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  muted: "bg-muted-foreground",
};
const TXT: Record<Nivel, string> = {
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  muted: "text-muted-foreground",
};

export function LinhaStatus({ nivel, texto }: { nivel: Nivel; texto: string }) {
  return (
    <span className={`flex items-center gap-2 text-base font-semibold ${TXT[nivel]}`}>
      <span className={`h-3 w-3 shrink-0 rounded-full ${COR[nivel]}`} aria-hidden />
      {texto}
    </span>
  );
}
