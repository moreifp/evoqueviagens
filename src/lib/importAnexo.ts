import { supabase } from "@/integrations/supabase/client";
import { mutar } from "@/lib/outbox";
import { novoId } from "@/lib/itens";

type Importado = { nome: string; mime: string; data: string };

/** Anexa ao item o arquivo usado na leitura, somente depois da confirmação do formulário. */
export async function anexarImportado(tripId: string, itemTipo: "ticket" | "lodging" | "reservation", itemId: string) {
  const chave = `evoque-anexo-${tripId}`;
  const raw = sessionStorage.getItem(chave);
  if (!raw || !navigator.onLine) return;
  const a = JSON.parse(raw) as Importado;
  const resposta = await fetch(a.data);
  const blob = await resposta.blob();
  const id = novoId();
  const limpo = a.nome.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `trip/${tripId}/${itemId}/${id}-${limpo}`;
  const up = await supabase.storage.from("documentos").upload(path, blob, { contentType: a.mime || blob.type || "application/octet-stream" });
  if (up.error) throw new Error(up.error.message);
  await mutar({ tipo: "insert", tabela: "item_attachment", valores: { id, item_tipo: itemTipo, item_id: itemId, storage_path: path, nome: a.nome, content_type: a.mime || blob.type, size_bytes: blob.size } });
  sessionStorage.removeItem(chave);
}