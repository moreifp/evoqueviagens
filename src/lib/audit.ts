import { compararNomes } from "./nomes";
/**
 * Auditor de consistência — determinístico, funções puras, sem IA.
 * Roda local (offline) a cada gravação e ao abrir a viagem.
 */
import { chaveDia, dataBRCurta, somaDias } from "./format";

export type Severidade = "resolver" | "conferir" | "sugestao";

export type ItemRef = {
  id: string;
  tipo: "bilhete" | "hospedagem" | "viagem";
  titulo: string;
  linha1: string;
  linha2?: string;
};

export type Achado = {
  regra_id: string;
  severidade: Severidade;
  mensagem: string;
  itens_envolvidos: string[];
  itens: ItemRef[];
  hash_dos_dados: string;
  correcao?: { rotulo: string; alvo: "bilhetes" | "hospedagem" | "viagem" };
};

export type TripLite = {
  id: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
};

export type TicketLite = {
  id: string;
  tipo: string;
  companhia: string | null;
  numero: string | null;
  origem_iata: string | null;
  destino_iata: string | null;
  origem_cidade: string | null;
  destino_cidade: string | null;
  partida_utc: string;
  partida_tz: string;
  chegada_utc: string;
  chegada_tz: string;
};

export type LodgingLite = {
  id: string;
  nome: string;
  cidade: string | null;
  checkin: string;
  checkout: string;
};

function hash(...partes: (string | number | null | undefined)[]) {
  const s = partes.map((p) => String(p ?? "")).join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function rotaBilhete(t: TicketLite) {
  const o = t.origem_iata || t.origem_cidade || "?";
  const d = t.destino_iata || t.destino_cidade || "?";
  return `${o} → ${d}`;
}

function refBilhete(t: TicketLite): ItemRef {
  const via = [t.companhia, t.numero].filter(Boolean).join(" ");
  return {
    id: t.id,
    tipo: "bilhete",
    titulo: rotaBilhete(t),
    linha1: `${dataBRCurta(chaveDia(t.partida_utc, t.partida_tz))} · ${horaSimples(t.partida_utc, t.partida_tz)}`,
    ...(via ? { linha2: via } : {}),
  };
}

function refHotel(l: LodgingLite): ItemRef {
  return {
    id: l.id,
    tipo: "hospedagem",
    titulo: l.nome,
    linha1: `Entra ${dataBRCurta(chaveDia(l.checkin))}`,
    linha2: `Sai ${dataBRCurta(chaveDia(l.checkout))}`,
  };
}

function horaSimples(iso: string, tz?: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(new Date(iso));
}

function noitesEntre(inicio: string, fim: string): string[] {
  const out: string[] = [];
  let cur = inicio;
  let guard = 0;
  while (cur < fim && guard < 400) {
    out.push(cur);
    cur = somaDias(cur, 1);
    guard++;
  }
  return out;
}

function dentroDaJanela(dia: string, trip: TripLite) {
  return dia >= trip.data_inicio && dia <= trip.data_fim;
}

function trocaDiaMes(dia: string): string | null {
  const [a, m, d] = dia.split("-");
  if (!a || !m || !d) return null;
  const dn = Number(d);
  const mn = Number(m);
  if (dn > 12 || dn < 1) return null;
  return `${a}-${d.padStart(2, "0")}-${m.padStart(2, "0")}`;
}

/** Quem está em cada item — para as regras por pessoa. */
export type PessoasCtx = {
  membros: { person_id: string; nome: string; nome_como_no_documento: string | null }[];
  passageiros: Record<string, { person_id: string; nome_no_bilhete?: string | null }[]>;
  hospedes: Record<string, string[]>;
};


export function rodarAuditor(
  trip: TripLite,
  bilhetes: TicketLite[],
  hospedagens: LodgingLite[],
  ctx?: PessoasCtx,
): Achado[] {
  const achados: Achado[] = [];
  const tks = [...bilhetes].sort((a, b) => a.partida_utc.localeCompare(b.partida_utc));
  const hos = [...hospedagens].sort((a, b) => a.checkin.localeCompare(b.checkin));

  const refViagem: ItemRef = {
    id: trip.id,
    tipo: "viagem",
    titulo: trip.nome,
    linha1: `De ${dataBRCurta(trip.data_inicio)}`,
    linha2: `Até ${dataBRCurta(trip.data_fim)}`,
  };

  /* ---------- Grupo A: buracos no tempo ---------- */

  const primeiro = tks[0];
  const ultimo = tks[tks.length - 1];

  if (hos.length > 0) {
    const inicioNoites = primeiro ? chaveDia(primeiro.chegada_utc, primeiro.chegada_tz) : trip.data_inicio;
    const fimNoites = ultimo ? chaveDia(ultimo.partida_utc, ultimo.partida_tz) : trip.data_fim;

    const porPessoa = !!ctx && Object.values(ctx.hospedes).some((h) => h.length > 0) && Object.values(ctx.passageiros).some((p) => p.length > 0);
    // P1 — noite sem cama por pessoa: entre o voo que traz e o que leva, ela está em algum quarto?
    if (porPessoa && ctx) {
      const nomes = new Map(ctx.membros.map((m) => [m.person_id, m.nome]));
      const pessoas = new Set(Object.values(ctx.passageiros).flat().map((p) => p.person_id));
      for (const pid of pessoas) {
        const seus = tks.filter((t) => (ctx.passageiros[t.id] ?? []).some((p) => p.person_id === pid));
        if (!seus.length) continue;
        const chega = seus[0]!;
        const sai = seus.length > 1 ? seus[seus.length - 1]! : null;
        const ini = chaveDia(chega.chegada_utc, chega.chegada_tz);
        const fim = sai ? chaveDia(sai.partida_utc, sai.partida_tz) : trip.data_fim;
        const suas = hos.filter((l) => (ctx.hospedes[l.id] ?? []).includes(pid));
        const nome = nomes.get(pid) ?? "Alguém";
        for (const noite of noitesEntre(ini, fim)) {
          const ok = suas.some((l) => chaveDia(l.checkin) <= noite && chaveDia(l.checkout) >= somaDias(noite, 1));
          if (ok) continue;
          achados.push({
            regra_id: "P1",
            severidade: "resolver",
            mensagem: `${nome} está sem quarto na noite de ${dataBRCurta(noite)}.`,
            itens_envolvidos: [trip.id, pid],
            itens: [
              { id: `${pid}-${noite}`, tipo: "viagem", titulo: nome, linha1: dataBRCurta(noite), linha2: "Sem quarto" },
              refViagem,
            ],
            hash_dos_dados: hash("P1", pid, noite, ...suas.map((l) => `${l.id}${l.checkin}${l.checkout}`)),
            correcao: { rotulo: "Pôr num quarto", alvo: "hospedagem" },
          });
        }
      }
    }

    // A1 — noite sem cama (quando ainda não há quartos com hóspedes)
    if (!porPessoa) for (const noite of noitesEntre(inicioNoites, fimNoites)) {
      const coberta = hos.some(
        (l) => chaveDia(l.checkin) <= noite && chaveDia(l.checkout) >= somaDias(noite, 1),
      );
      if (!coberta) {
        achados.push({
          regra_id: "A1",
          severidade: "resolver",
          mensagem: `A noite de ${dataBRCurta(noite)} não tem hospedagem cadastrada.`,
          itens_envolvidos: [trip.id],
          itens: [
            { id: noite, tipo: "viagem", titulo: "Noite", linha1: dataBRCurta(noite), linha2: "Sem cama" },
            refViagem,
          ],
          hash_dos_dados: hash("A1", noite, ...hos.map((l) => `${l.id}${l.checkin}${l.checkout}`)),
          correcao: { rotulo: "Adicionar hospedagem", alvo: "hospedagem" },
        });
      }
    }

    // A2 — hotel termina antes do voo de volta
    const saidas = tks.filter((t) => t.partida_utc >= (primeiro?.chegada_utc ?? ""));
    const voltaFinal = saidas[saidas.length - 1] ?? ultimo;
    const maxCheckout = [...hos].sort((x, y) => (x.checkout < y.checkout ? 1 : -1))[0];
    if (voltaFinal && maxCheckout && maxCheckout.checkout < voltaFinal.partida_utc) {
      const diff = chaveDia(maxCheckout.checkout) !== chaveDia(voltaFinal.partida_utc, voltaFinal.partida_tz);
      if (diff) {
        achados.push({
          regra_id: "A2",
          severidade: "resolver",
          mensagem: `O hotel termina dia ${dataBRCurta(chaveDia(maxCheckout.checkout))} e seu bilhete de saída é dia ${dataBRCurta(chaveDia(voltaFinal.partida_utc, voltaFinal.partida_tz))}`,
          itens_envolvidos: [maxCheckout.id, voltaFinal.id],
          itens: [refHotel(maxCheckout), refBilhete(voltaFinal)],
          hash_dos_dados: hash("A2", maxCheckout.id, maxCheckout.checkout, voltaFinal.id, voltaFinal.partida_utc),
          correcao: { rotulo: "Editar hotel", alvo: "hospedagem" },
        });
      }
    }

    // A3 — hotel começa depois da chegada
    const minCheckin = hos[0];
    if (primeiro && minCheckin && chaveDia(minCheckin.checkin) > chaveDia(primeiro.chegada_utc, primeiro.chegada_tz)) {
      achados.push({
        regra_id: "A3",
        severidade: "resolver",
        mensagem: `Você chega dia ${dataBRCurta(chaveDia(primeiro.chegada_utc, primeiro.chegada_tz))} e o hotel só começa dia ${dataBRCurta(chaveDia(minCheckin.checkin))}`,
        itens_envolvidos: [primeiro.id, minCheckin.id],
        itens: [refBilhete(primeiro), refHotel(minCheckin)],
        hash_dos_dados: hash("A3", primeiro.id, primeiro.chegada_utc, minCheckin.id, minCheckin.checkin),
        correcao: { rotulo: "Editar hotel", alvo: "hospedagem" },
      });
    }
  }

  // A4 — hospedagem fora da janela da viagem
  for (const l of hos) {
    const ci = chaveDia(l.checkin);
    const co = chaveDia(l.checkout);
    if (!dentroDaJanela(ci, trip) || !dentroDaJanela(co, trip)) {
      achados.push({
        regra_id: "A4",
        severidade: "conferir",
        mensagem: `${l.nome} vai de ${dataBRCurta(ci)} a ${dataBRCurta(co)} e a viagem vai de ${dataBRCurta(trip.data_inicio)} a ${dataBRCurta(trip.data_fim)}`,
        itens_envolvidos: [l.id, trip.id],
        itens: [refHotel(l), refViagem],
        hash_dos_dados: hash("A4", l.id, l.checkin, l.checkout, trip.data_inicio, trip.data_fim),
        correcao: { rotulo: "Editar hotel", alvo: "hospedagem" },
      });
    }
  }

  // A5 — dois hotéis na mesma noite
  for (let i = 0; i < hos.length; i++) {
    for (let j = i + 1; j < hos.length; j++) {
      const a = hos[i]!;
      const b = hos[j]!;
      if (a.checkin < b.checkout && b.checkin < a.checkout) {
        achados.push({
          regra_id: "A5",
          severidade: "conferir",
          mensagem: `${a.nome} e ${b.nome} cobrem a mesma noite.`,
          itens_envolvidos: [a.id, b.id],
          itens: [refHotel(a), refHotel(b)],
          hash_dos_dados: hash("A5", a.id, a.checkin, a.checkout, b.id, b.checkin, b.checkout),
          correcao: { rotulo: "Editar hotel", alvo: "hospedagem" },
        });
      }
    }
  }

  // P2 — nome no bilhete diferente do nome no documento
  if (ctx) {
    for (const t of tks) {
      for (const p of ctx.passageiros[t.id] ?? []) {
        const m = ctx.membros.find((x) => x.person_id === p.person_id);
        if (!p.nome_no_bilhete || !m?.nome_como_no_documento) continue;
        const nivelNome = compararNomes(m.nome_como_no_documento, p.nome_no_bilhete);
        if (nivelNome === "ok") continue;
        achados.push({
          regra_id: "P2",
          severidade: nivelNome,
          mensagem: `No bilhete está “${p.nome_no_bilhete}” e no documento de ${m.nome} está “${m.nome_como_no_documento}”.`,
          itens_envolvidos: [t.id, p.person_id],
          itens: [refBilhete(t)],
          hash_dos_dados: hash("P2", t.id, p.person_id, p.nome_no_bilhete, m.nome_como_no_documento),
          correcao: { rotulo: "Editar bilhete", alvo: "bilhetes" },
        });
      }
    }
  }

  /* ---------- Grupo D: datas implausíveis ---------- */

  const anoViagem = trip.data_inicio.slice(0, 4);
  const anoFim = trip.data_fim.slice(0, 4);

  const itens: { id: string; ref: ItemRef; dias: string[]; alvo: "bilhetes" | "hospedagem"; rotulo: string }[] = [
    ...tks.map((t) => ({
      id: t.id,
      ref: refBilhete(t),
      dias: [chaveDia(t.partida_utc, t.partida_tz), chaveDia(t.chegada_utc, t.chegada_tz)],
      alvo: "bilhetes" as const,
      rotulo: "Editar bilhete",
    })),
    ...hos.map((l) => ({
      id: l.id,
      ref: refHotel(l),
      dias: [chaveDia(l.checkin), chaveDia(l.checkout)],
      alvo: "hospedagem" as const,
      rotulo: "Editar hotel",
    })),
  ];

  for (const it of itens) {
    for (const dia of it.dias) {
      const ano = dia.slice(0, 4);
      // D1 — ano errado
      if (ano !== anoViagem && ano !== anoFim) {
        achados.push({
          regra_id: "D1",
          severidade: "resolver",
          mensagem: `Este item está em ${ano} e a viagem é em ${anoViagem}.`,
          itens_envolvidos: [it.id, trip.id],
          itens: [it.ref, refViagem],
          hash_dos_dados: hash("D1", it.id, dia, anoViagem),
          correcao: { rotulo: it.rotulo, alvo: it.alvo },
        });
        continue;
      }
      if (!dentroDaJanela(dia, trip)) {
        const trocado = trocaDiaMes(dia);
        if (trocado && dentroDaJanela(trocado, trip)) {
          // D2 — dia/mês trocados
          achados.push({
            regra_id: "D2",
            severidade: "resolver",
            mensagem: `A data ${dataBRCurta(dia)} fica fora da viagem; ${dataBRCurta(trocado)} fica dentro.`,
            itens_envolvidos: [it.id, trip.id],
            itens: [it.ref, refViagem],
            hash_dos_dados: hash("D2", it.id, dia, trip.data_inicio, trip.data_fim),
            correcao: { rotulo: it.rotulo, alvo: it.alvo },
          });
        } else {
          // D5 — item fora da janela
          achados.push({
            regra_id: "D5",
            severidade: "conferir",
            mensagem: `Este item cai em ${dataBRCurta(dia)}, fora dos dias da viagem.`,
            itens_envolvidos: [it.id, trip.id],
            itens: [it.ref, refViagem],
            hash_dos_dados: hash("D5", it.id, dia, trip.data_inicio, trip.data_fim),
            correcao: { rotulo: it.rotulo, alvo: it.alvo },
          });
        }
      }
    }
  }

  for (const t of tks) {
    const dur = (new Date(t.chegada_utc).getTime() - new Date(t.partida_utc).getTime()) / 60000;
    // D4 — chega antes de sair
    if (dur <= 0) {
      achados.push({
        regra_id: "D4",
        severidade: "resolver",
        mensagem: `A chegada deste trecho está antes da partida.`,
        itens_envolvidos: [t.id],
        itens: [refBilhete(t)],
        hash_dos_dados: hash("D4", t.id, t.partida_utc, t.chegada_utc),
        correcao: { rotulo: "Editar bilhete", alvo: "bilhetes" },
      });
      continue;
    }
    // D3 — duração implausível
    if (dur < 30 || dur > 20 * 60) {
      const h = Math.floor(dur / 60);
      const m = Math.round(dur % 60);
      achados.push({
        regra_id: "D3",
        severidade: "conferir",
        mensagem: `Este trecho dura ${h > 0 ? `${h}h` : ""}${m > 0 ? `${m}min` : ""}.`,
        itens_envolvidos: [t.id],
        itens: [refBilhete(t)],
        hash_dos_dados: hash("D3", t.id, t.partida_utc, t.chegada_utc),
        correcao: { rotulo: "Editar bilhete", alvo: "bilhetes" },
      });
    }
  }

  return achados;
}

export const PESO: Record<Severidade, number> = { resolver: 0, conferir: 1, sugestao: 2 };

export function ordenar(a: Achado[]) {
  return [...a].sort((x, y) => PESO[x.severidade] - PESO[y.severidade]);
}
