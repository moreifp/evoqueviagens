import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { autoriaQuery } from "@/lib/data";

/** "Adicionado por …" e, só para quem pode editar, as ações do item. */
export function Autoria({ tipo, id, children }: { tipo: string; id: string; children?: ReactNode }) {
  const { data } = useQuery(autoriaQuery(tipo, id));
  if (!data) return null;
  return (
    <>
      <p className="text-base text-muted-foreground">Adicionado por {data.sou_eu ? "você" : data.autor}{data.editar ? " · você pode editar" : " · só quem adicionou ou organiza edita"}</p>
      {data.editar && children}
    </>
  );
}
