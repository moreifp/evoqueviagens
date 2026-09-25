import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminClient, cifrar, decifrar, sha256Hex } from "./cadastro.server";

export const BLOCOS = ["basico", "documentos", "fidelidade", "preferencias", "dependentes", "viagens"] as const;
const blocosSchema = z.array(z.enum(BLOCOS)).max(6);
const tripsSchema = z.array(z.string().uuid()).max(500).nullable().optional();
const TRINTA_DIAS = 30 * 86400_000;

function tokenNovo() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string; claims: any };

function nomeDe(ctx: Ctx, self: { apelido?: string | null; nome?: string | null } | null) {
  return self?.apelido || self?.nome?.split(" ")[0] || String(ctx.claims?.email ?? "").split("@")[0] || "Alguém";
}

/** Garante que a conta tem a própria ficha ("Eu"). */
export const garantirMinhaFicha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    const { data: eu } = await db
      .from("person")
      .select("id")
      .eq("account_id", context.userId)
      .eq("kind", "self")
      .is("deleted_at", null)
      .maybeSingle();
    if (eu) return { id: eu.id as string };
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();
    const meta = (context.claims as { user_metadata?: { full_name?: string; name?: string } }).user_metadata;
    const nome = meta?.full_name || meta?.name || email.split("@")[0] || "Eu";
    const { data, error } = await db
      .from("person")
      .insert({
        nome,
        apelido: nome.split(" ")[0],
        email: email || null,
        account_id: context.userId,
        owner_id: context.userId,
        kind: "self",
        status: "em_andamento",
      })
      .select("id")
      .single();
    if (error) throw new Error("FALHA");
    return { id: data.id as string };
  });

/** Cria (ou reaproveita) um convite. pedido = quero ver seus dados; oferta = compartilho os meus. */
export const criarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ direcao: z.enum(["pedido", "oferta"]), blocos: blocosSchema, tripIds: tripsSchema, personId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const db = await adminClient();
    if (data.personId) {
      const { data: p } = await db.from("person").select("account_id, kind").eq("id", data.personId).maybeSingle();
      if (!p || p.account_id !== ctx.userId) throw new Error("Forbidden");
      // um link estável por pré-cadastro
      const { data: velho } = await db
        .from("share_invite")
        .select("id, token_cifrado")
        .eq("person_id", data.personId)
        .eq("from_id", ctx.userId)
        .is("usado_em", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (velho?.token_cifrado) {
        const t = await decifrar(velho.token_cifrado).catch(() => null);
        if (t) {
          await db.from("share_invite").update({ expira_em: new Date(Date.now() + TRINTA_DIAS).toISOString() }).eq("id", velho.id);
          return { token: t };
        }
      }
    }
    const { data: self } = await db
      .from("person")
      .select("nome, apelido")
      .eq("account_id", ctx.userId)
      .eq("kind", "self")
      .is("deleted_at", null)
      .maybeSingle();
    const token = tokenNovo();
    const { error } = await db.from("share_invite").insert({
      from_id: ctx.userId,
      from_nome: nomeDe(ctx, self),
      direcao: data.direcao,
      blocos: data.blocos,
      trip_ids: await tripsDoDono(db, ctx.userId, data.tripIds),
      person_id: data.personId ?? null,
      token_hash: await sha256Hex(token),
      token_cifrado: await cifrar(token),
    });
    if (error) throw new Error("FALHA");
    return { token };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tripsDoDono(db: any, owner: string, ids: string[] | null | undefined) {
  if (ids == null) return null; // todas
  if (!ids.length) return [];
  const { data } = await db.from("trip").select("id").eq("owner_id", owner).in("id", ids);
  return ((data ?? []) as { id: string }[]).map((t) => t.id);
}

async function acharConvite(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const db = await adminClient();
  const { data } = await db.from("share_invite").select("*").eq("token_hash", await sha256Hex(token)).maybeSingle();
  return data;
}

export const verConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await acharConvite(data.token);
    if (!c) return { ok: false as const, erro: "INVALIDO" };
    if (c.usado_em && c.usado_por !== context.userId) return { ok: false as const, erro: "USADO" };
    if (new Date(c.expira_em).getTime() < Date.now()) return { ok: false as const, erro: "VENCIDO" };
    if (c.from_id === context.userId) return { ok: false as const, erro: "PROPRIO" };
    return {
      ok: true as const,
      usado: !!c.usado_em,
      deNome: c.from_nome as string,
      direcao: c.direcao as "pedido" | "oferta",
      blocos: c.blocos as string[],
      temFicha: !!c.person_id,
    };
  });

export const listarCompartilhamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: grants, error } = await context.supabase.from("share_grant").select("*").eq("status", "ativo").order("created_at", { ascending: false });
    if (error) throw new Error("FALHA");
    const ids = [...new Set((grants ?? []).flatMap((grant) => grant.trip_ids ?? []))];
    let trips: { id: string; nome: string }[] = [];
    if (ids.length) {
      const { data } = await context.supabase.from("trip").select("id,nome").in("id", ids);
      trips = data ?? [];
    }
    return { grants: grants ?? [], trips, uid: context.userId };
  });

export const aceitarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().max(100), blocos: blocosSchema, tripIds: tripsSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const c = await acharConvite(data.token);
    if (!c || c.from_id === ctx.userId || new Date(c.expira_em).getTime() < Date.now()) throw new Error("INVALIDO");
    if (c.usado_em && c.usado_por !== ctx.userId) throw new Error("USADO");
    const db = await adminClient();

    // Assume o pré-cadastro: a ficha passa a ser da pessoa que aceitou.
    if (c.person_id) {
      const { data: pre } = await db.from("person").select("id, kind, account_id").eq("id", c.person_id).maybeSingle();
      if (pre && pre.kind === "precadastro" && pre.account_id === c.from_id) {
        const { data: eu } = await db
          .from("person")
          .select("id")
          .eq("account_id", ctx.userId)
          .eq("kind", "self")
          .is("deleted_at", null)
          .maybeSingle();
        let podeAssumir = true;
        if (eu) {
          const { count } = await db
            .from("traveler_document")
            .select("id", { count: "exact", head: true })
            .eq("person_id", eu.id)
            .is("deleted_at", null);
          if (count) podeAssumir = false;
          else await db.from("person").update({ deleted_at: new Date().toISOString() }).eq("id", eu.id);
        }
        await db
          .from("person")
          .update(podeAssumir ? { account_id: ctx.userId, owner_id: ctx.userId, kind: "self" } : { kind: "dependent" })
          .eq("id", pre.id);
      }
    }

    const { data: self } = await db
      .from("person")
      .select("nome, apelido")
      .eq("account_id", ctx.userId)
      .eq("kind", "self")
      .is("deleted_at", null)
      .maybeSingle();
    const meuNome = nomeDe(ctx, self);
    const [owner_id, grantee_id, owner_nome, grantee_nome] =
      c.direcao === "pedido" ? [ctx.userId, c.from_id, meuNome, c.from_nome] : [c.from_id, ctx.userId, c.from_nome, meuNome];
    const blocos = c.direcao === "pedido" ? data.blocos : (c.blocos as string[]);
    const trip_ids = c.direcao === "pedido" ? await tripsDoDono(db, ctx.userId, data.tripIds) : (c.trip_ids as string[] | null);
    await db
      .from("share_grant")
      .update({ status: "revogado", revogado_em: new Date().toISOString() })
      .eq("owner_id", owner_id)
      .eq("grantee_id", grantee_id)
      .eq("status", "ativo");
    if (blocos.length) {
      const { error } = await db.from("share_grant").insert({ owner_id, grantee_id, owner_nome, grantee_nome, blocos, trip_ids });
      if (error) throw new Error("FALHA");
    }
    await db.from("share_invite").update({ usado_em: new Date().toISOString(), usado_por: ctx.userId }).eq("id", c.id);
    return { ok: true };
  });

/** Dono muda os blocos de um compartilhamento que ele deu. */
export const mudarBlocos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), blocos: blocosSchema, tripIds: tripsSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const trip_ids = await tripsDoDono(context.supabase, context.userId, data.tripIds);
    const { error } = await context.supabase
      .from("share_grant")
      .update(data.blocos.length ? { blocos: data.blocos, trip_ids } : { status: "revogado", revogado_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error("FALHA");
    return { ok: true };
  });

/** Revogar: dono corta o acesso, ou quem recebeu deixa de ver. */
export const revogar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("share_grant")
      .update({ status: "revogado", revogado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error("FALHA");
    return { ok: true };
  });
