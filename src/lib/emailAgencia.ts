import { supabase } from "@/integrations/supabase/client";
import { mutar } from "@/lib/outbox";
import { novoId } from "@/lib/itens";

export type Original = { nome: string; mime: string; data: string };

function qp(s: string) {
  return s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}
function utf8(bin: string) {
  try { return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); } catch { return bin; }
}
function semHtml(h: string) {
  return h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
}

/** Extrai o texto legível de um .eml (partes text/plain ou text/html; base64 ou quoted-printable). */
export function textoDoEml(raw: string): string {
  const partes: string[] = [];
  const blocos = raw.split(/\r?\n--[^\r\n]+/);
  for (const b of blocos) {
    const i = b.search(/\r?\n\r?\n/);
    if (i < 0) continue;
    const cab = b.slice(0, i), corpo = b.slice(i).trim();
    const tipo = /content-type:\s*text\/(plain|html)/i.exec(cab)?.[1];
    if (!tipo) continue;
    let t = corpo;
    if (/content-transfer-encoding:\s*base64/i.test(cab)) { try { t = utf8(atob(corpo.replace(/\s+/g, ""))); } catch { /* segue */ } }
    else if (/content-transfer-encoding:\s*quoted-printable/i.test(cab)) t = utf8(qp(corpo));
    partes.push(tipo === "html" ? semHtml(t) : t);
  }
  if (!partes.length) { const i = raw.search(/\r?\n\r?\n/); return semHtml(i >= 0 ? raw.slice(i) : raw).trim(); }
  // Prefere o texto simples; se só houver HTML, usa ele.
  return (partes.find((p) => p.trim().length > 40) ?? partes[0] ?? "").slice(0, 90_000).trim();
}

/** Guarda o e-mail/arquivo original como anexo PRIVADO (só o organizador vê) de cada bilhete criado. */
export async function anexarPrivado(tripId: string, ticketIds: string[], o: Original) {
  if (!ticketIds.length || !navigator.onLine) return;
  const blob = await (await fetch(o.data)).blob();
  const limpo = o.nome.replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `trip/${tripId}/${ticketIds[0]}/${novoId()}-privado-${limpo}`;
  const up = await supabase.storage.from("documentos").upload(path, blob, { contentType: o.mime || blob.type || "application/octet-stream" });
  if (up.error) throw new Error(up.error.message);
  for (const itemId of ticketIds) {
    await mutar({ tipo: "insert", tabela: "item_attachment", valores: { id: novoId(), item_tipo: "ticket", item_id: itemId, storage_path: path, nome: `E-mail da agência · ${o.nome}`, content_type: o.mime || blob.type, size_bytes: blob.size, privado: true } });
  }
}

export function textoParaOriginal(texto: string): Original {
  const b64 = btoa(unescape(encodeURIComponent(texto)));
  return { nome: "email-agencia.txt", mime: "text/plain", data: `data:text/plain;base64,${b64}` };
}
