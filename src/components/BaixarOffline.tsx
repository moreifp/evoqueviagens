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
    // Depois de enviar as edições guardadas, busca de novo para a tela bater com o servidor.
    const sinc = () => void qc.invalidateQueries();
    window.addEventListener("evoque-sincronizado", sinc);
    return () => {
      window.removeEventListener("evoque-sincronizado", sinc);
      clearTimeout(t);
      window.removeEventListener("online", on);
    };
  }, [qc]);
  return null;
}
