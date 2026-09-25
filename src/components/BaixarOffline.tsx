import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { baixarTudo } from "@/lib/offline";

/** Sem interface: baixa as viagens próximas ao abrir o app e quando a internet volta. */
export function BaixarOffline() {
  const qc = useQueryClient();
  useEffect(() => {
    const t = setTimeout(() => void baixarTudo(qc), 2500);
    const on = () => void baixarTudo(qc, true);
    window.addEventListener("online", on);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", on);
    };
  }, [qc]);
  return null;
}
