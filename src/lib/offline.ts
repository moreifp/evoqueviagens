import type { QueryClient } from "@tanstack/react-query";
import { get, set } from "idb-keyval";
import { useEffect, useState } from "react";
import { anexosQuery, apiAlertaQuery, conferenciaNomesQuery, expensesQuery, settlementsQuery, tripMembrosQuery, reservasQuery, roteiroQuery, findingsQuery, flightStatusQuery, lodgingsQuery, membersQuery, peopleQuery, ticketsQuery, tripQuery, tripsQuery, type Trip, convitesQuery, confiancaQuery, autoriaQuery, pedidosQuery, conferirQuery, entryRulesQuery, caixaClaudeQuery, avisosMeusQuery, pedidosRecebidosQuery, pontosQuery } from "./data";
import { logoCia, logoSite } from "./logos";
import { documentoQuery, euQuery, minhaPessoaQuery, type EuDados } from "./eu";
import { pessoasQuery } from "./pessoas";
import { guardarAnexo, limparAnexos } from "./anexosOffline";

/** "Baixar viagem": guarda no aparelho tudo das viagens próximas e a ficha Eu + dependentes. */
const CHAVE = "evoque-baixado";
const INTERVALO_MIN = 30 * 60 * 1000;
export const DIAS_A_FRENTE = 90;

type Estado = { baixando: string[]; em: Record<string, number> };
let estado: Estado = { baixando: [], em: {} };
const ouvintes = new Set<(e: Estado) => void>();
function emitir(e: Estado) {
  estado = e;
  ouvintes.forEach((f) => f(e));
}

const hojeISO = () => new Date().toISOString().slice(0, 10);

/** Viagens não arquivadas, em andamento ou que começam em até 90 dias. */
export function viagensParaBaixar(trips: Trip[]) {
  const hoje = hojeISO();
  const limite = new Date(Date.now() + DIAS_A_FRENTE * 864e5).toISOString().slice(0, 10);
  return trips.filter((t) => !t.arquivada_em && t.data_fim >= hoje && t.data_inicio <= limite);
}

let rodando = false;
export async function baixarTudo(qc: QueryClient, forcar = false) {
  if (rodando || typeof navigator === "undefined" || !navigator.onLine) return;
  rodando = true;
  try {
    const salvo = ((await get(CHAVE)) as Record<string, number> | undefined) ?? {};
    emitir({ ...estado, em: salvo });
    const ultimo = salvo["__geral"] ?? 0;
    if (!forcar && Date.now() - ultimo < INTERVALO_MIN) return;

    const trips = await qc.fetchQuery({ ...tripsQuery(), staleTime: 0 });
    const alvo = viagensParaBaixar(trips);
    emitir({ ...estado, baixando: alvo.map((t) => t.id) });
    const manter = new Set<string>();

    // Ficha Eu + dependentes (documentos da própria conta).
    try {
      const eu = await qc.fetchQuery({ ...minhaPessoaQuery(), staleTime: 0 });
      await qc.fetchQuery({ ...pessoasQuery(), staleTime: 0 }).catch(() => null);
      const dados = await qc.fetchQuery({ ...euQuery(eu.id), staleTime: 0 });
      const fichas: EuDados[] = [dados];
      for (const d of dados.dependentes) fichas.push(await qc.fetchQuery({ ...euQuery(d.id), staleTime: 0 }));
      for (const f of fichas) {
        const refs = [f.pessoa.foto_url, ...f.documentos.map((d) => d.arquivo_path), ...f.anexos.map((a) => a.storage_path), ...f.fidelidades.map((l) => l.cartao_path)];
        for (const r of refs) if (r) manter.add(r);
        for (const d of f.documentos) await qc.fetchQuery({ ...euQueryDoc(f.pessoa.id, d.id), staleTime: 0 }).catch(() => null);
      }
      await Promise.all([...manter].map((r) => guardarAnexo(r)));
    } catch (e) {
      console.warn("Ficha não baixada", e);
    }

    await qc.fetchQuery({ ...peopleQuery(), staleTime: 0 }).catch(() => null);
    await qc.fetchQuery({ ...convitesQuery(), staleTime: 0 }).catch(() => null);
    await qc.fetchQuery({ ...confiancaQuery(), staleTime: 0 }).catch(() => null);
    await qc.fetchQuery({ ...avisosMeusQuery(), staleTime: 0 }).catch(() => null);
    await qc.fetchQuery({ ...pedidosRecebidosQuery(), staleTime: 0 }).catch(() => null);
    await qc.fetchQuery({ ...entryRulesQuery(), staleTime: 0 }).catch(() => null);
    await qc.fetchQuery({ ...caixaClaudeQuery(), staleTime: 0 }).catch(() => null);
    for (const t of alvo) {
      try {
        await Promise.all([
          qc.fetchQuery({ ...tripQuery(t.id), staleTime: 0 }),
          qc.fetchQuery({ ...lodgingsQuery(t.id), staleTime: 0 }),
          qc.fetchQuery({ ...expensesQuery(t.id), staleTime: 0 }),
          qc.fetchQuery({ ...tripMembrosQuery(t.id), staleTime: 0 }),
          qc.fetchQuery({ ...membersQuery(t.id), staleTime: 0 }),
          qc.fetchQuery({ ...findingsQuery(t.id), staleTime: 0 }),
          qc.fetchQuery({ ...flightStatusQuery(t.id), staleTime: 0 }),
          qc.fetchQuery({ ...apiAlertaQuery(t.id), staleTime: 0 }),
          qc.fetchQuery({ ...roteiroQuery(t.id), staleTime: 0 }),
          qc.fetchQuery({ ...reservasQuery(t.id), staleTime: 0 }),
          qc.fetchQuery({ ...pontosQuery(t.id), staleTime: 0 }).catch(() => []),
        ]);
        // Anexos dos itens que a pessoa pode ver (o banco já filtra).
        const anexos = await qc.fetchQuery({ ...anexosQuery(t.id), staleTime: 0 });
        anexos.forEach((a) => manter.add(a.storage_path));
        await Promise.all(anexos.map((a) => guardarAnexo(a.storage_path)));
        const bilhetes = await qc.fetchQuery({ ...ticketsQuery(t.id), staleTime: 0 });
        await Promise.all(bilhetes.map((b) => qc.fetchQuery({ ...conferenciaNomesQuery(b.id), staleTime: 0 }).catch(() => [])));
        const roteiroT = qc.getQueryData(roteiroQuery(t.id).queryKey) ?? [];
        await Promise.all(roteiroT.filter((r) => r.detalhe).map((r) => qc.fetchQuery({ ...autoriaQuery(r.item_tipo, r.item_id), staleTime: 0 }).catch(() => null)));
        await qc.fetchQuery({ ...pedidosQuery(t.id), staleTime: 0 }).catch(() => null);
        await qc.fetchQuery({ ...conferirQuery(t.id), staleTime: 0 }).catch(() => null);
        const hoteis = qc.getQueryData(lodgingsQuery(t.id).queryKey) ?? [];
        const refs = [...bilhetes.map((b) => b.anexo_url), ...hoteis.map((h) => h.anexo_url)].filter((r): r is string => !!r);
        refs.forEach((r) => manter.add(r));
        await Promise.all(refs.map((r) => guardarAnexo(r)));
        // Logos das companhias e hotéis (só quando o Logo.dev estiver ligado).
        const logos = [...bilhetes.map((b) => logoCia(b.companhia, b.numero)), ...hoteis.map((h) => logoSite(h.site))].filter((u): u is string => !!u);
        if ("caches" in window && logos.length) {
          const c = await caches.open("evoque-logos");
          await Promise.allSettled([...new Set(logos)].map(async (u) => { if (!(await c.match(u))) await c.put(u, await fetch(u, { mode: "no-cors" })); }));
        }
        salvo[t.id] = Date.now();
        emitir({ baixando: estado.baixando.filter((x) => x !== t.id), em: { ...salvo } });
      } catch (e) {
        console.warn("Viagem não baixada", t.id, e);
      }
    }
    salvo["__geral"] = Date.now();
    await set(CHAVE, salvo);
    await limparAnexos(manter);
  } catch (e) {
    console.warn("Download offline falhou", e);
  } finally {
    rodando = false;
    emitir({ ...estado, baixando: [] });
  }
}

function euQueryDoc(pid: string, did: string) {
  return documentoQuery(pid, did);
}

/** Selo da viagem: "Baixando…" ou há quanto tempo foi atualizada. */
export function useSeloOffline(tripId: string) {
  const [e, setE] = useState<Estado>(estado);
  const [, tick] = useState(0);
  useEffect(() => {
    ouvintes.add(setE);
    void get(CHAVE).then((s) => s && emitir({ ...estado, em: { ...(s as Record<string, number>), ...estado.em } }));
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => {
      ouvintes.delete(setE);
      clearInterval(t);
    };
  }, []);
  if (e.baixando.includes(tripId)) return { texto: "Baixando…", ok: false };
  const em = e.em[tripId];
  if (!em) return null;
  return { texto: `Disponível sem internet · atualizado ${haQuanto(em)}`, ok: true };
}

export function haQuanto(ts: number) {
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}
