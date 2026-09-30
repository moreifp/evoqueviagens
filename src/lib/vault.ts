import { del, get, set } from "idb-keyval";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mutar } from "@/lib/outbox";
import { conferir, criarCredencialFaceId } from "@/components/TravaFaceId";

const ITERATIONS = 600_000;
const VERIFIER = "evoque-vault-ok-v1";
const CACHE_PREFIX = "evoque-vault-cache:";
let active: { accountId: string; key: CryptoKey; expiresAt: number } | null = null;
let lockTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

/** Estado reativo: volta a false quando o cofre trava por tempo ou ao sair do app. */
export function useVaultUnlocked(accountId: string | undefined) {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return !!accountId && vaultIsUnlocked(accountId);
}

type VaultMeta = { account_id: string; kdf_salt: string; kdf_iterations: number; verifier_ciphertext: string; verifier_iv: string };
export type VaultItem = { id: string; account_id: string; loyalty_account_id: string; encrypted_payload: string; iv: string; created_at: string; updated_at: string };
export type VaultDocument = { id: string; person_id: string; account_id: string; encrypted_payload: string; iv: string; created_at: string; updated_at?: string; deleted_at: string | null };
export type VaultDocumentContents = { fields: Record<string, string>; file?: { name: string; type: string; data: string } };
const documentCache = (accountId: string, personId: string) => `${CACHE_PREFIX}docs:${accountId}:${personId}`;
const vaultDb = supabase as unknown as { from: (table: string) => any };

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => (value += String.fromCharCode(byte)));
  return btoa(value);
}

function base64ToBytes(value: string) {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations = ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const stableSalt = new Uint8Array(salt).buffer;
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: stableSalt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptText(key: CryptoKey, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return { ciphertext: bytesToBase64(new Uint8Array(cipher)), iv: bytesToBase64(iv) };
}

async function decryptText(key: CryptoKey, ciphertext: string, iv: string) {
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, key, base64ToBytes(ciphertext));
  return new TextDecoder().decode(clear);
}

function remember(accountId: string, key: CryptoKey) {
  active = { accountId, key, expiresAt: Date.now() + 5 * 60_000 };
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = setTimeout(lockVault, 5 * 60_000);
  notify();
}

export function lockVault() {
  const was = !!active;
  active = null;
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = null;
  if (was) notify();
}

export function vaultIsUnlocked(accountId: string) {
  if (!active || active.accountId !== accountId || active.expiresAt <= Date.now()) {
    lockVault();
    return false;
  }
  return true;
}

async function metaFor(accountId: string) {
  const { data, error } = await supabase.from("vault_meta").select("*").eq("account_id", accountId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as VaultMeta | null;
}

export async function vaultExists(accountId: string) {
  if (!navigator.onLine) return !!(await get(`${CACHE_PREFIX}meta:${accountId}`));
  const meta = await metaFor(accountId);
  if (meta) await set(`${CACHE_PREFIX}meta:${accountId}`, meta);
  return !!meta;
}

export async function createVault(accountId: string, password: string) {
  if (!navigator.onLine) throw new Error("A primeira criação do cofre precisa de internet.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derive(password, salt);
  const verifier = await encryptText(key, VERIFIER);
  const meta: VaultMeta = {
    account_id: accountId,
    kdf_salt: bytesToBase64(salt),
    kdf_iterations: ITERATIONS,
    verifier_ciphertext: verifier.ciphertext,
    verifier_iv: verifier.iv,
  };
  const { error } = await supabase.from("vault_meta").insert(meta);
  if (error) throw new Error(error.message);
  await set(`${CACHE_PREFIX}meta:${accountId}`, meta);
  remember(accountId, key);
}

export async function unlockVault(accountId: string, password: string) {
  const meta = navigator.onLine ? await metaFor(accountId) : ((await get(`${CACHE_PREFIX}meta:${accountId}`)) as VaultMeta | undefined);
  if (!meta) throw new Error("Cofre ainda não criado.");
  await set(`${CACHE_PREFIX}meta:${accountId}`, meta);
  const key = await derive(password, base64ToBytes(meta.kdf_salt), meta.kdf_iterations);
  try {
    if ((await decryptText(key, meta.verifier_ciphertext, meta.verifier_iv)) !== VERIFIER) throw new Error("invalid");
  } catch {
    throw new Error("Senha do cofre incorreta.");
  }
  remember(accountId, key);
}

/* Face ID no cofre: a chave (não exportável) fica guardada só neste aparelho e só é usada após o rosto. */
const bioKey = (a: string) => `${CACHE_PREFIX}bio:${a}`;
export async function cofreFaceIdLigado(accountId: string) {
  return !!(await get(bioKey(accountId)));
}
export async function ligarFaceIdCofre(accountId: string) {
  if (!active || !vaultIsUnlocked(accountId)) throw new Error("Destrave o cofre primeiro.");
  const cred = await criarCredencialFaceId("Cofre Evoque");
  await set(bioKey(accountId), { cred, key: active.key });
}
export async function desligarFaceIdCofre(accountId: string) {
  await del(bioKey(accountId));
}
export async function unlockVaultFaceId(accountId: string) {
  const bio = (await get(bioKey(accountId))) as { cred: string; key: CryptoKey } | undefined;
  if (!bio) throw new Error("Face ID do cofre não está ligado.");
  await conferir(bio.cred);
  const meta = (await get(`${CACHE_PREFIX}meta:${accountId}`)) as VaultMeta | undefined;
  if (meta) {
    try {
      if ((await decryptText(bio.key, meta.verifier_ciphertext, meta.verifier_iv)) !== VERIFIER) throw new Error();
    } catch {
      await del(bioKey(accountId));
      throw new Error("Use a senha do cofre desta vez.");
    }
  }
  remember(accountId, bio.key);
}

export async function saveVaultItem(accountId: string, loyaltyAccountId: string, login: string, password: string) {
  if (!active || !vaultIsUnlocked(accountId)) throw new Error("Destrave o cofre primeiro.");
  const encrypted = await encryptText(active.key, JSON.stringify({ login, password }));
  const values = { account_id: accountId, loyalty_account_id: loyaltyAccountId, encrypted_payload: encrypted.ciphertext, iv: encrypted.iv, updated_at: new Date().toISOString() };
  const key = `${CACHE_PREFIX}item:${accountId}:${loyaltyAccountId}`;
  const prev = (await get(key)) as VaultItem | undefined;
  const cached = { ...values, id: prev?.id ?? crypto.randomUUID(), created_at: prev?.created_at ?? new Date().toISOString() } as VaultItem;
  await set(key, cached);
  // Fila offline: o ciphertext já cifrado sobe quando a internet voltar.
  const r = await mutar({ tipo: "upsert", tabela: "vault_item", valores: values, onConflict: "account_id,loyalty_account_id" });
  return { localOnly: r === "fila" };
}

export async function readVaultItem(accountId: string, loyaltyAccountId: string) {
  if (!active || !vaultIsUnlocked(accountId)) throw new Error("Destrave o cofre primeiro.");
  const key = `${CACHE_PREFIX}item:${accountId}:${loyaltyAccountId}`;
  const local = ((await get(key)) as VaultItem | undefined) ?? null;
  let item: VaultItem | null = local;
  if (navigator.onLine) {
    const { data, error } = await supabase.from("vault_item").select("*").eq("account_id", accountId).eq("loyalty_account_id", loyaltyAccountId).maybeSingle();
    if (error) throw new Error(error.message);
    const remote = data as VaultItem | null;
    if (local && (!remote || Date.parse(local.updated_at) > Date.parse(remote.updated_at))) {
      // O aparelho tem uma versão mais nova que não subiu: usa a local e reenvia.
      const { account_id, loyalty_account_id, encrypted_payload, iv, updated_at } = local;
      void mutar({ tipo: "upsert", tabela: "vault_item", valores: { account_id, loyalty_account_id, encrypted_payload, iv, updated_at }, onConflict: "account_id,loyalty_account_id" }).catch(() => {});
    } else {
      item = remote;
      if (remote) await set(key, remote);
    }
  }
  if (!item) return null;
  return JSON.parse(await decryptText(active.key, item.encrypted_payload, item.iv)) as { login: string; password: string };
}

export async function removeVaultItem(accountId: string, loyaltyAccountId: string) {
  await del(`${CACHE_PREFIX}item:${accountId}:${loyaltyAccountId}`);
  if (navigator.onLine) await supabase.from("vault_item").delete().eq("account_id", accountId).eq("loyalty_account_id", loyaltyAccountId);
}

/** O conteúdo inteiro, inclusive arquivo e nome, só sai do aparelho cifrado. */
export async function saveVaultDocument(accountId: string, personId: string, contents: VaultDocumentContents) {
  if (!active || !vaultIsUnlocked(accountId)) throw new Error("Destrave o cofre primeiro.");
  const encrypted = await encryptText(active.key, JSON.stringify(contents));
  const row: VaultDocument = { id: crypto.randomUUID(), account_id: accountId, person_id: personId, encrypted_payload: encrypted.ciphertext, iv: encrypted.iv, created_at: new Date().toISOString(), deleted_at: null };
  const cache = documentCache(accountId, personId);
  const previous = ((await get(cache)) as VaultDocument[] | undefined) ?? [];
  await set(cache, [...previous, row]);
  let result: "salvo" | "fila";
  try { result = await mutar({ tipo: "insert", tabela: "vault_document", valores: row }); }
  catch (error) { await set(cache, previous); throw error; }
  return { id: row.id, localOnly: result === "fila" };
}

export async function listVaultDocuments(accountId: string, personId: string) {
  if (!active || !vaultIsUnlocked(accountId)) throw new Error("Destrave o cofre primeiro.");
  const cache = documentCache(accountId, personId);
  const local = ((await get(cache)) as VaultDocument[] | undefined) ?? [];
  if (!navigator.onLine) return local.filter((row) => !row.deleted_at);
  // 1º só a lista leve (id, updated_at, deleted_at); o conteúdo cifrado só dos novos ou alterados em relação ao aparelho.
  const { data: meta, error } = await vaultDb.from("vault_document").select("id, updated_at, deleted_at").eq("account_id", accountId).eq("person_id", personId).is("deleted_at", null).order("created_at", { ascending: false });
  if (error) return local.filter((row) => !row.deleted_at);
  const lista = meta as Pick<VaultDocument, "id" | "updated_at" | "deleted_at">[];
  const iguais = new Map(local.filter((l) => !l.deleted_at).map((l) => [l.id, l]));
  const faltam = lista.filter((m) => iguais.get(m.id)?.updated_at !== m.updated_at).map((m) => m.id);
  let novos: VaultDocument[] = [];
  if (faltam.length) {
    const r = await vaultDb.from("vault_document").select("*").in("id", faltam);
    if (r.error) return local.filter((row) => !row.deleted_at);
    novos = r.data as VaultDocument[];
  }
  const remote = lista.map((m) => novos.find((n) => n.id === m.id) ?? iguais.get(m.id)).filter((x): x is VaultDocument => !!x);
  const merged = [...local.filter((row) => !remote.some((r) => r.id === row.id)), ...remote.filter((row) => !local.some((l) => l.id === row.id && l.deleted_at))];
  await set(cache, merged);
  return merged.filter((row) => !row.deleted_at);
}

export async function readVaultDocument(accountId: string, row: VaultDocument): Promise<VaultDocumentContents> {
  if (!active || !vaultIsUnlocked(accountId) || row.account_id !== accountId) throw new Error("Destrave o cofre primeiro.");
  return JSON.parse(await decryptText(active.key, row.encrypted_payload, row.iv)) as VaultDocumentContents;
}

export async function deleteVaultDocument(accountId: string, row: VaultDocument) {
  if (!active || !vaultIsUnlocked(accountId) || row.account_id !== accountId) throw new Error("Destrave o cofre primeiro.");
  const cache = documentCache(accountId, row.person_id);
  await set(cache, ((await get(cache)) as VaultDocument[] | undefined ?? []).map((item) => item.id === row.id ? { ...item, deleted_at: new Date().toISOString() } : item));
  await mutar({ tipo: "update", tabela: "vault_document", id: row.id, valores: { deleted_at: new Date().toISOString() } });
}

/** Enquanto a tela de guardar no cofre está aberta, sair para a câmera/galeria não tranca (o limite de 5 min continua). */
let segurando = 0;
export function segurarTravaAoSair() {
  segurando++;
  return () => {
    segurando = Math.max(0, segurando - 1);
  };
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !segurando) lockVault();
  });
}