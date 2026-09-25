import { useState } from "react";
import type { LucideIcon } from "lucide-react";

/** Logo pequeno; se não houver ou falhar, mostra o ícone padrão. */
export function Logo({ url, Icone, nome, tamanho = 32, className = "" }: { url: string | null; Icone: LucideIcon; nome: string; tamanho?: number; className?: string }) {
  const [erro, setErro] = useState(false);
  if (!url || erro) return <Icone size={tamanho} strokeWidth={2.2} className={className} aria-hidden />;
  return <img src={url} alt={`Logo ${nome}`} width={tamanho} height={tamanho} loading="lazy" onError={() => setErro(true)} className={`rounded-md bg-card object-contain ${className}`} style={{ width: tamanho, height: tamanho }} />;
}
