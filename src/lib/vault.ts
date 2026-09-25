import { del, get, set } from "idb-keyval";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mutar } from "@/lib/outbox";

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

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) lockVault();
  });
}