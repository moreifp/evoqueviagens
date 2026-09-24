import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminClient, contatoDoLink, validarToken, type Admin } from "./cadastro.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extrairLinhas, lerMrz } from "./mrz";
import type { CadastroDTO, Secao } from "./cadastro-tipos";

const tokenSchema = z.string().min(20).max(100);

const PERSON_COLS =
  "id, nome, apelido, cpf, telefone, email, foto_url, sexo, data_nascimento, nacionalidades, nome_como_no_documento, endereco, emergencia_nome, emergencia_parentesco, emergencia_telefone, visto_negado, visto_negado_detalhe, status, passo_atual, modo, idioma, consentimento_em";
const DOC_COLS = "id, tipo, numero, pais_emissor, validade, emissao, nome_no_documento, sexo, detalhe, arquivo_path";

async function carregar(db: Admin, pid: string): Promise<CadastroDTO> {
  const [p, d, c, pr, r] = await Promise.all([
    db.from("person").select(PERSON_COLS).eq("id", pid).single(),
    db.from("traveler_document").select(DOC_COLS).eq("person_id", pid).is("deleted_at", null),
    db.from("loyalty_account").select("id, programa, numero, tipo, categoria").eq("person_id", pid).is("deleted_at", null),
    db.from("person_preferences").select("assento, quarto, bebe_alcool, restricoes, refeicao_voo").eq("person_id", pid).maybeSingle(),
    db.from("person_section_review").select("secao, status, recado").eq("person_id", pid).is("deleted_at", null),
  ]);
  if (p.error) throw new Error("LINK_INVALIDO");
  const paths = [p.data.foto_url, ...(d.data ?? []).map((x: { arquivo_path: string | null }) => x.arquivo_path)].filter(
    (x): x is string => !!x,
  );
  const fotos: Record<string, string> = {};
  if (paths.length) {
    const { data: s } = await db.storage.from("documentos").createSignedUrls(paths, 600);
    for (const it of s ?? []) if (it.path && it.signedUrl) fotos[it.path] = it.signedUrl;
  }
  return {
    person: p.data,
    docs: d.data ?? [],
    contas: c.data ?? [],
    prefs: pr.data ?? null,
    revisoes: r.data ?? [],
    fotos,
  } as CadastroDTO;
}

export const abrirCadastro = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const db = await adminClient();
    try {
      const pid = await validarToken(db, data.token);
      return { ok: true as const, cadastro: await carregar(db, pid) };
    } catch (e) {
      const erro = (e as Error).message;
      const contato = erro === "LINK_REVOGADO" || erro === "LINK_EXPIRADO" ? await contatoDoLink(db, data.token).catch(() => null) : null;
      return { ok: false as const, erro, contato };
    }
  });

export const iniciarCadastro = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: tokenSchema, modo: z.enum(["rapido", "completo"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await adminClient();
    const pid = await validarToken(db, data.token);
    const { data: p } = await db.from("person").select("status, consentimento_em").eq("id", pid).single();
    const upd: Record<string, unknown> = { modo: data.modo, atualizado_em: new Date().toISOString() };
    if (!p?.consentimento_em) upd.consentimento_em = new Date().toISOString();
    if (p?.status === "convidado") upd.status = "em_andamento";
    await db.from("person").update(upd).eq("id", pid);
    return { ok: true };
  });

export const urlUpload = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, ext: z.enum(["jpg", "pdf", "heic"]).optional() }).parse(d))
  .handler(async ({ data }) => {
    const db = await adminClient();
    const pid = await validarToken(db, data.token);
    const path = `${pid}/${crypto.randomUUID()}.${data.ext ?? "jpg"}`;
    const { data: u, error } = await db.storage.from("documentos").createSignedUploadUrl(path);
    if (error || !u) throw new Error("Falha ao preparar envio");
    return { path, token: u.token };
  });

/** Data de emissão lida da zona visual; só aceita se for coerente (nunca adivinha). */
function dataEmissao(texto: string, nasc: string | null, validade: string | null): string | null {
  const m = /ISSUE:\s*(\d{4})-(\d{2})-(\d{2})/i.exec(texto);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  if (d.getTime() > Date.now()) return null;
  if (nasc && iso <= nasc) return null;
  if (validade) {
    if (iso >= validade) return null;
    const anos = (new Date(`${validade}T12:00:00Z`).getTime() - d.getTime()) / (365.25 * 86400000);
    if (anos > 11) return null;
  }
  return iso;
}

async function lerMrzDaImagem(imagem: string) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { ok: false as const };
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "This is a passport data page. 1) Transcribe the two machine-readable zone (MRZ) lines at the bottom, exactly as printed, each 44 characters using A-Z, 0-9 and '<', one per line. If you cannot read them, output NONE instead. 2) Then add one last line 'ISSUE: YYYY-MM-DD' with the DATE OF ISSUE printed in the visual zone (labels such as 'Data de emissão', 'Date of issue', 'Data di rilascio', 'Date de délivrance', 'Fecha de expedición'). Only if it is clearly legible; never guess, never use the expiry or birth date. If not clearly legible, output 'ISSUE: NONE'. Output nothing else.",
              },
              { type: "image_url", image_url: { url: imagem } },
            ],
          },
        ],
      }),
    });
    if (!r.ok) return { ok: false as const };
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const linhas = extrairLinhas(j.choices?.[0]?.message?.content ?? "");
    if (!linhas) return { ok: false as const };
    const res = lerMrz(linhas[0], linhas[1]);
    if (!res) return { ok: false as const };
    return { ok: true as const, mrz: res, emissao: dataEmissao(j.choices?.[0]?.message?.content ?? "", res.nascimento, res.validade) };
  } catch {
    return { ok: false as const };
  }
}

export const lerPassaporte = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: tokenSchema, imagem: z.string().max(8_000_000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await adminClient();
    await validarToken(db, data.token);
    return lerMrzDaImagem(data.imagem);
  });

/** Mesma leitura, para o administrador na ficha. */
export const lerPassaporteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ imagem: z.string().max(8_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();
    const { data: adm } = await context.supabase.from("app_admin").select("email").ilike("email", email).maybeSingle();
    if (!adm) throw new Error("NAO_ADMIN");
    return lerMrzDaImagem(data.imagem);
  });

const docSchema = z.object({
  id: z.string().uuid().optional(),
  tipo: z.string().max(30),
  numero: z.string().max(60).nullish(),
  pais_emissor: z.string().max(60).nullish(),
  validade: z.string().max(10).nullish(),
  emissao: z.string().max(10).nullish(),
  nome_no_documento: z.string().max(200).nullish(),
  sexo: z.string().max(2).nullish(),
  detalhe: z.string().max(300).nullish(),
  arquivo_path: z.string().max(200).nullish(),
});

const salvarSchema = z.object({
  token: tokenSchema,
  secao: z.enum(["voce", "passaporte", "extras", "vistos", "fidelidade", "preferencias", "emergencia"]),
  passo: z.number().int().min(0).max(8),
  pulou: z.boolean().optional(),
  person: z.record(z.string(), z.unknown()).optional(),
  docs: z.array(docSchema).max(20).optional(),
  tiposDaSecao: z.array(z.string()).max(20).optional(),
  contas: z
    .array(z.object({ id: z.string().uuid().optional(), programa: z.string().max(60), numero: z.string().max(60).nullish(), tipo: z.string().max(20) }))
    .max(20)
    .optional(),
  prefs: z
    .object({
      assento: z.string().nullish(),
      quarto: z.string().nullish(),
      bebe_alcool: z.boolean().nullish(),
      restricoes: z.array(z.string().max(40)).max(10),
      refeicao_voo: z.string().max(80).nullish(),
    })
    .optional(),
});

const CAMPOS_PERSON = new Set([
  "apelido", "cpf", "telefone", "email", "foto_url", "sexo", "data_nascimento", "nacionalidades",
  "nome_como_no_documento", "endereco", "emergencia_nome", "emergencia_parentesco", "emergencia_telefone",
  "visto_negado", "visto_negado_detalhe",
]);

type Mudanca = { campo: string; antigo: unknown; novo: unknown; arquivo?: boolean };

function str(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return Array.isArray(v) ? v.join(", ") : String(v);
}

export const salvarPasso = createServerFn({ method: "POST" })
  .inputValidator((d) => salvarSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await adminClient();
    const pid = await validarToken(db, data.token);
    // Só aceita arquivos da pasta da própria pessoa (impede apontar para fotos de outra ficha).
    const checar = (v: unknown): void => {
      if (Array.isArray(v)) return v.forEach(checar);
      if (v && typeof v === "object")
        for (const [k, x] of Object.entries(v)) {
          if ((k === "arquivo_path" || k === "foto_url") && typeof x === "string" && x && !x.startsWith(`${pid}/`))
            throw new Error("ARQUIVO_INVALIDO");
          checar(x);
        }
    };
    checar(data);
    const secao = data.secao as Secao;
    const { data: rev } = await db
      .from("person_section_review")
      .select("status")
      .eq("person_id", pid)
      .eq("secao", secao)
      .maybeSingle();
    const { data: pessoa } = await db.from("person").select("*").eq("id", pid).single();
    const jaAprovada = rev?.status === "aprovado";
    const mudancas: Mudanca[] = [];

    // Campos da pessoa
    if (data.person) {
      const upd: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data.person)) {
        if (!CAMPOS_PERSON.has(k)) continue;
        const novo = v === "" ? null : v;
        if (str(pessoa[k]) !== str(novo)) {
          upd[k] = novo;
          mudancas.push({ campo: `person:${pid}:${k}`, antigo: pessoa[k], novo, arquivo: k === "foto_url" });
        }
      }
      if (Object.keys(upd).length) await db.from("person").update(upd).eq("id", pid);
    }

    // Documentos: substitui o conjunto dos tipos desta seção
    if (data.docs && data.tiposDaSecao) {
      const { data: atuais } = await db
        .from("traveler_document")
        .select("*")
        .eq("person_id", pid)
        .in("tipo", data.tiposDaSecao)
        .is("deleted_at", null);
      // Idempotência: um documento sem id (ex.: nova tentativa depois de uma resposta perdida)
      // é casado com o que já existe — passaporte pelo número, demais tipos únicos pelo tipo.
      const norm = (s: unknown) => String(s ?? "").replace(/\s/g, "").toUpperCase();
      const usados = new Set<string>();
      const resolvidos = data.docs.map((d) => {
        if (d.id && (atuais ?? []).some((a: { id: string }) => a.id === d.id)) {
          usados.add(d.id);
          return d;
        }
        const cand = (atuais ?? []).find((a: { id: string; tipo: string; numero: string | null; detalhe: string | null }) => {
          if (usados.has(a.id) || a.tipo !== d.tipo) return false;
          if (d.tipo === "passaporte") return !!d.numero && norm(a.numero) === norm(d.numero);
          if (d.tipo === "outro_visto") return false;
          if (d.tipo === "outra_vacina") return !!d.detalhe && norm(a.detalhe) === norm(d.detalhe);
          return true;
        });
        if (cand) {
          usados.add(cand.id);
          return { ...d, id: cand.id };
        }
        return { ...d, id: undefined };
      });
      const idsMantidos = new Set(resolvidos.map((d) => d.id).filter(Boolean));
      for (const a of atuais ?? []) {
        if (!idsMantidos.has(a.id)) {
          await db.from("traveler_document").update({ deleted_at: new Date().toISOString() }).eq("id", a.id);
          mudancas.push({ campo: `traveler_document:${a.id}:deleted_at`, antigo: null, novo: "removido" });
        }
      }
      for (const d of resolvidos) {
        const { id, ...vals } = d;
        const limpo = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, v === "" ? null : v]));
        const atual = id ? (atuais ?? []).find((a: { id: string }) => a.id === id) : null;
        if (atual) {
          const upd: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(limpo)) {
            if (str(atual[k]) !== str(v)) {
              upd[k] = v;
              mudancas.push({ campo: `traveler_document:${id}:${k}`, antigo: atual[k], novo: v, arquivo: k === "arquivo_path" });
            }
          }
          if (Object.keys(upd).length) await db.from("traveler_document").update(upd).eq("id", id!);
        } else {
          const { data: novo } = await db
            .from("traveler_document")
            .insert({ ...limpo, person_id: pid, owner_id: pessoa.owner_id })
            .select("id")
            .single();
          if (novo) mudancas.push({ campo: `traveler_document:${novo.id}:tipo`, antigo: null, novo: limpo.tipo });
        }
      }
      // Passaporte alimenta nome/nascimento/sexo/nacionalidades da pessoa
      if (secao === "passaporte" && data.docs[0]) {
        const p0 = data.docs[0];
        const nacs = Array.from(new Set(data.docs.map((d) => d.pais_emissor).filter((x): x is string => !!x)));
        await db
          .from("person")
          .update({
            nome_como_no_documento: p0.nome_no_documento ?? pessoa.nome_como_no_documento,
            sexo: p0.sexo ?? pessoa.sexo,
            nacionalidades: nacs.length ? nacs : pessoa.nacionalidades,
            ...(data.person?.data_nascimento ? {} : {}),
          })
          .eq("id", pid);
      }
    }

    if (data.contas) {
      const { data: atuais } = await db.from("loyalty_account").select("*").eq("person_id", pid).is("deleted_at", null);
      const porProg = new Map((atuais ?? []).map((a: { programa: string }) => [a.programa, a]));
      const novos = new Set(data.contas.map((c) => c.programa));
      for (const a of atuais ?? []) {
        if (!novos.has(a.programa)) {
          await db.from("loyalty_account").update({ deleted_at: new Date().toISOString() }).eq("id", a.id);
          mudancas.push({ campo: `loyalty_account:${a.id}:deleted_at`, antigo: a.programa, novo: "removido" });
        }
      }
      for (const c of data.contas) {
        const a = porProg.get(c.programa) as { id: string; numero: string | null } | undefined;
        if (a) {
          if (str(a.numero) !== str(c.numero)) {
            await db.from("loyalty_account").update({ numero: c.numero ?? null }).eq("id", a.id);
            mudancas.push({ campo: `loyalty_account:${a.id}:numero`, antigo: a.numero, novo: c.numero });
          }
        } else {
          const { data: n } = await db
            .from("loyalty_account")
            .insert({ person_id: pid, owner_id: pessoa.owner_id, programa: c.programa, numero: c.numero ?? null, tipo: c.tipo })
            .select("id")
            .single();
          if (n) mudancas.push({ campo: `loyalty_account:${n.id}:programa`, antigo: null, novo: c.programa });
        }
      }
    }

    if (data.prefs) {
      const { data: atual } = await db.from("person_preferences").select("*").eq("person_id", pid).maybeSingle();
      for (const k of ["assento", "quarto", "bebe_alcool", "restricoes", "refeicao_voo"] as const) {
        if (str(atual?.[k]) !== str(data.prefs[k])) {
          mudancas.push({ campo: `person_preferences:${pid}:${k}`, antigo: atual?.[k] ?? null, novo: data.prefs[k] });
        }
      }
      await db.from("person_preferences").upsert({ person_id: pid, ...data.prefs }, { onConflict: "person_id" });
    }

    // Revisão da seção
    if (!rev) {
      await db.from("person_section_review").insert({ person_id: pid, secao, status: "pendente" });
    } else if (mudancas.length && rev.status !== "pendente") {
      await db.from("person_section_review").update({ status: "pendente" }).eq("person_id", pid).eq("secao", secao);
    }

    if (jaAprovada && mudancas.length) {
      await db.from("person_change").insert(
        mudancas.map((m) => ({
          person_id: pid,
          secao,
          campo: m.campo,
          valor_antigo: m.arquivo ? null : str(m.antigo),
          valor_novo: m.arquivo ? null : str(m.novo),
          arquivo_antigo: m.arquivo ? str(m.antigo) : null,
          arquivo_novo: m.arquivo ? str(m.novo) : null,
        })),
      );
    }

    const upd: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
    if (data.passo > (pessoa.passo_atual ?? 0)) upd.passo_atual = data.passo;
    if (pessoa.status === "convidado") upd.status = "em_andamento";
    await db.from("person").update(upd).eq("id", pid);

    // Tudo já foi gravado: uma falha ao recarregar não pode virar "erro" no aparelho.
    try {
      return { ok: true, cadastro: await carregar(db, pid) };
    } catch (e) {
      console.error("[salvarPasso] recarregar falhou", secao, e);
      return { ok: true, cadastro: null };
    }
  });

/** Aparelho do participante relata um erro para aparecer nos registros do servidor. */
export const relatarErro = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ onde: z.string().max(60), msg: z.string().max(1000), ua: z.string().max(300) }).parse(d))
  .handler(async ({ data }) => {
    console.error("[cliente]", data.onde, data.msg, data.ua);
    return { ok: true };
  });

export const enviarCadastro = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const db = await adminClient();
    const pid = await validarToken(db, data.token);
    const { data: p } = await db.from("person").select("status, apelido, telefone, emergencia_nome").eq("id", pid).single();
    const { count } = await db
      .from("traveler_document")
      .select("id", { count: "exact", head: true })
      .eq("person_id", pid)
      .eq("tipo", "passaporte")
      .is("deleted_at", null);
    if (!p?.emergencia_nome || !count) return { ok: false, erro: "FALTA_ESSENCIAL" };
    await db
      .from("person")
      .update({ status: p.status === "aprovado" ? "aprovado" : "enviado", atualizado_em: new Date().toISOString() })
      .eq("id", pid);
    return { ok: true, cadastro: await carregar(db, pid) };
  });

/** Cria a conta de login só para e-mails da lista de admins. */
export const cadastrarAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email().max(200), senha: z.string().min(6).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const db = await adminClient();
    const email = data.email.trim().toLowerCase();
    const { data: adm } = await db.from("app_admin").select("email").ilike("email", email).maybeSingle();
    if (!adm) return { ok: false as const, erro: "NAO_ADMIN" };
    const { error } = await db.auth.admin.createUser({ email, password: data.senha, email_confirm: true });
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("already")) return { ok: false as const, erro: "JA_EXISTE" };
      return { ok: false as const, erro: "FALHA" };
    }
    return { ok: true as const };
  });
