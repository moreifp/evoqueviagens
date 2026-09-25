import { supabase } from "@/integrations/supabase/client";
import { mutar } from "@/lib/outbox";
import { novoId } from "@/lib/itens";

type Importado = { nome: string; mime: string; data: string };

/** Converte a data lida (ISO com segundos, Z, fuso ou espaço) no formato do campo datetime-local. */
export function dataLocal(v: string | null | undefined): string {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(v?.trim() ?? "");
  if (m) return `${m[1]}T${m[2]}`;
  const d = /^(\d{4}-\d{2}-\d{2})$/.exec(v?.trim() ?? "");
  return d ? `${d[1]}T12:00` : "";
}

/** Só a data (YYYY-MM-DD). */
export function soData(v: string | null | undefined): string {
  return /^(\d{4}-\d{2}-\d{2})/.exec(v?.trim() ?? "")?.[1] ?? "";
}

/** Anexa ao item o arquivo usado na leitura, somente depois da confirmação do formulário. */
export async function anexarImportado(tripId: string, itemTipo: "ticket" | "lodging" | "reservation", itemId: string) {
  const chave = `evoque-anexo-${tripId}`;
  const raw = sessionStorage.getItem(chave);
  if (!raw || !navigator.onLine) return;
  sessionStorage.removeItem(chave); // nunca anexar o mesmo arquivo a dois itens
  const a = JSON.parse(raw) as Importado;
  const resposta = await fetch(a.data);
  const blob = await resposta.blob();
  const id = novoId();
  const limpo = a.nome.replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `trip/${tripId}/${itemId}/${id}-${limpo}`;
  const up = await supabase.storage.from("documentos").upload(path, blob, { contentType: a.mime || blob.type || "application/octet-stream" });
  if (up.error) throw new Error(up.error.message);
  await mutar({ tipo: "insert", tabela: "item_attachment", valores: { id, item_tipo: itemTipo, item_id: itemId, storage_path: path, nome: a.nome, content_type: a.mime || blob.type, size_bytes: blob.size } });
}
