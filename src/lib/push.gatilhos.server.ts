/**
 * Gatilhos de aviso push. Todos rodam no servidor e terminam em enviarAviso,
 * que aplica preferências, silêncio, dedupe e push_log.
 */
import { contasDasPessoas, enviarAviso } from "./push.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const horaCurta = (iso: string | null, tz: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz ?? "America/Sao_Paulo" }) : "";

/** (a) Status do voo mudou: atraso ≥15 min, portão, cancelado, embarque. */
export async function gatilhoVoo(ticketId: string, antes: Record<string, unknown> | null, depois: Record<string, unknown>, simular = false) {
  const db = await admin();
  const { data: t } = await db.from("ticket").select("id,trip_id,companhia,numero,partida_utc,partida_tz,destino_cidade,destino_iata").eq("id", ticketId).maybeSingle();
  if (!t) return;

  const nomeVoo = [t.companhia, t.numero].filter(Boolean).join(" ").trim() || "Seu voo";
  const mudancas: string[] = [];
  const atrasoAntes = Number(antes?.atraso_partida_min ?? 0);
  const atrasoDepois = Number(depois.atraso_partida_min ?? 0);
  if (atrasoDepois >= 15 && atrasoDepois - atrasoAntes >= 15) mudancas.push(`atrasou ${atrasoDepois} min`);
  if (depois.portao_partida && depois.portao_partida !== antes?.portao_partida) mudancas.push(`portão ${depois.portao_partida}`);
  const st = String(depois.status ?? "").toLowerCase();
  if (st !== String(antes?.status ?? "").toLowerCase()) {
    if (st.includes("cancel")) mudancas.push("foi cancelado");
    else if (st.includes("board")) mudancas.push("embarque começou");
  }
  if (!mudancas.length) return;

  const { data: passageiros } = await db.from("ticket_passenger").select("person_id").eq("ticket_id", ticketId).is("deleted_at", null);
  const contas = await contasDasPessoas(db, (passageiros ?? []).map((p: { person_id: string }) => p.person_id));
  const partidaEm24h = Date.parse(t.partida_utc) - Date.now() < 24 * 3600_000;
  const novaPartida = (depois.partida_revista_utc as string) ?? (depois.partida_prevista_utc as string) ?? null;

  for (const accountId of contas) {
    await enviarAviso({
      accountId, tipo: "voo",
      titulo: `${nomeVoo}: ${mudancas[0]}`,
      corpo: [mudancas.slice(1).join(" · "), novaPartida ? `Saída ${horaCurta(novaPartida, t.partida_tz)}` : ""].filter(Boolean).join(" · ") || "Abra o app para ver o voo.",
      url: `/trip/${t.trip_id}`,
      refId: `${ticketId}:${mudancas.join("|")}`,
      furarSilencio: partidaEm24h,
      simular,
    });
  }
}

/** (b) Organizador mandou aviso na viagem (trip_notice). */
export async function gatilhoAvisoOrganizador(noticeId: string, simular = false) {
  const db = await admin();
  const { data: n } = await db.from("trip_notice").select("id,trip_id,person_id,mensagem,tipo").eq("id", noticeId).maybeSingle();
  if (!n || n.tipo !== "aviso" || !n.person_id) return;
  const { data: trip } = await db.from("trip").select("nome").eq("id", n.trip_id).maybeSingle();
  const contas = await contasDasPessoas(db, [n.person_id]);
  for (const accountId of contas) {
    await enviarAviso({
      accountId, tipo: "aviso",
      titulo: `Aviso da viagem ${trip?.nome ?? ""}`.trim(),
      corpo: String(n.mensagem).slice(0, 120),
      url: `/trip/${n.trip_id}`,
      refId: n.id,
      simular,
    });
  }
}

/** (c) Convite para viagem chegando para quem já tem conta. */
export async function gatilhoConvite(memberId: string, simular = false) {
  const db = await admin();
  const { data: m } = await db.from("trip_member").select("id,trip_id,person_id,status").eq("id", memberId).maybeSingle();
  if (!m || m.status !== "convidado") return;
  const { data: trip } = await db.from("trip").select("nome,owner_id").eq("id", m.trip_id).maybeSingle();
  if (!trip) return;
  const { data: org } = await db.from("person").select("nome,apelido").eq("account_id", trip.owner_id).eq("kind", "self").is("deleted_at", null).order("created_at").limit(1).maybeSingle();
  const contas = await contasDasPessoas(db, [m.person_id]);
  for (const accountId of contas) {
    if (accountId === trip.owner_id) continue;
    await enviarAviso({
      accountId, tipo: "convite",
      titulo: "Convite para viagem",
      corpo: `${org?.apelido ?? org?.nome ?? "Alguém"} te incluiu em ${trip.nome}. Toque para ver.`,
      url: "/viagens",
      refId: m.id,
      simular,
    });
  }
}

/** (d) Chegou item pelo Claude — agrupado por conta. */
export async function gatilhoClaude(accountId: string, simular = false) {
  const db = await admin();
  const { count } = await db.from("agent_inbox").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("status", "pendente");
  if (!count) return;
  await enviarAviso({
    accountId, tipo: "claude",
    titulo: "Chegou pelo Claude",
    corpo: count === 1 ? "1 item novo esperando sua confirmação." : `${count} itens esperando sua confirmação.`,
    url: "/claude",
    refId: `caixa:${count}`,
    simular,
  });
}

/** (e) Documento vencendo antes de uma viagem marcada. Job diário. */
export async function gatilhoDocumentos(simular = false) {
  const db = await admin();
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: viagens } = await db.from("trip").select("id,nome,data_fim").is("deleted_at", null).is("arquivada_em", null).gte("data_fim", hoje);
  if (!viagens?.length) return { avisos: 0 };
  const fimPorViagem = new Map<string, string>((viagens as { id: string; data_fim: string }[]).map((v) => [v.id, v.data_fim]));

  const { data: membros } = await db.from("trip_member").select("trip_id,person_id").in("trip_id", [...fimPorViagem.keys()]).is("deleted_at", null).eq("status", "aceito");
  const pessoaViagem = new Map<string, string>();
  for (const m of (membros ?? []) as { trip_id: string; person_id: string }[]) {
    const fim = fimPorViagem.get(m.trip_id);
    if (fim && (!pessoaViagem.has(m.person_id) || fim < pessoaViagem.get(m.person_id)!)) pessoaViagem.set(m.person_id, fim);
  }
  if (!pessoaViagem.size) return { avisos: 0 };

  const { data: docs } = await db.from("traveler_document").select("id,person_id,tipo,validade")
    .in("person_id", [...pessoaViagem.keys()]).is("deleted_at", null)
    .in("tipo", ["passaporte", "visto", "esta", "eta_canada", "eta_uk", "etias", "k_eta", "outro_visto"])
    .not("validade", "is", null);

  let avisos = 0;
  for (const d of (docs ?? []) as { id: string; person_id: string; tipo: string; validade: string }[]) {
    const fim = pessoaViagem.get(d.person_id)!;
    // Avisa quando o documento vence antes do fim da viagem ou em até 6 meses depois dela.
    const limite = new Date(new Date(fim).getTime() + 183 * 864e5).toISOString().slice(0, 10);
    if (d.validade > limite) continue;
    const contas = await contasDasPessoas(db, [d.person_id]);
    const nomeDoc = d.tipo === "passaporte" ? "Passaporte" : "Visto/autorização";
    for (const accountId of contas) {
      const r = await enviarAviso({
        accountId, tipo: "documento",
        titulo: `${nomeDoc} vencendo`,
        corpo: `Vence em ${d.validade.split("-").reverse().join("/")} e você tem viagem marcada. Confira na tela Eu.`,
        url: "/",
        refId: d.id,
        simular,
      });
      if (r.status === "enviado" || r.status === "simulado") avisos++;
    }
  }
  return { avisos };
}

/**
 * (f) Lembrete de check-in — desligado por padrão (push_pref.checkin).
 * O job (avisos-diarios) roda UMA vez por dia, então a janela cobre todos os voos que saem nas
 * próximas 24h (o check-in já abriu). O dedupe por refId impede repetir o aviso do mesmo bilhete.
 */
export async function gatilhoCheckin(simular = false) {
  const db = await admin();
  const agora = new Date().toISOString();
  const em24h = new Date(Date.now() + 24 * 3600_000).toISOString();
  const { data: tickets } = await db.from("ticket").select("id,trip_id,companhia,numero,partida_tz").eq("tipo", "voo").is("deleted_at", null).gt("partida_utc", agora).lte("partida_utc", em24h);
  let avisos = 0;
  for (const t of (tickets ?? []) as { id: string; trip_id: string; companhia: string | null; numero: string | null; partida_tz: string }[]) {
    const { data: passageiros } = await db.from("ticket_passenger").select("person_id").eq("ticket_id", t.id).is("deleted_at", null);
    const contas = await contasDasPessoas(db, (passageiros ?? []).map((p: { person_id: string }) => p.person_id));
    const nomeVoo = [t.companhia, t.numero].filter(Boolean).join(" ").trim() || "Seu voo";
    for (const accountId of contas) {
      const r = await enviarAviso({
        accountId, tipo: "checkin",
        titulo: "Hora do check-in",
        corpo: `${nomeVoo} sai em menos de 24h. Já fez o check-in?`,
        url: `/trip/${t.trip_id}`,
        refId: t.id,
        furarSilencio: true,
        simular,
      });
      if (r.status === "enviado" || r.status === "simulado") avisos++;
    }
  }
  return { avisos };
}
