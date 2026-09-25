// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

/** Arquivos de /public que entram no pré-cache (anexos grandes e o próprio SW ficam de fora). */
function listarPublic(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    const rel = `${base}/${nome}`;
    if (statSync(caminho).isDirectory()) out.push(...listarPublic(caminho, rel));
    else if (!["/sw.js", "/robots.txt"].includes(rel)) out.push(rel);
  }
  return out;
}

/**
 * Gera /sw-precache.js no build do navegador: a lista de TODOS os arquivos do app
 * e uma versão que muda a cada build (o service worker usa para trocar o cache).
 */
function preCacheOffline(): Plugin {
  return {
    name: "evoque-sw-precache",
    apply: "build",
    generateBundle(_opts, bundle) {
      const env = (this as unknown as { environment?: { name: string } }).environment;
      if (env && env.name !== "client") return;
      const arquivos = Object.keys(bundle)
        .filter((f) => !f.endsWith(".map") && f !== "sw-precache.js")
        .map((f) => `/${f}`);
      let publicos: string[] = [];
      try {
        publicos = listarPublic(join(process.cwd(), "public"));
      } catch {
        publicos = [];
      }
      const lista = [...new Set([...arquivos, ...publicos])].sort();
      const versao = createHash("sha256").update(lista.join("\n")).update(String(Date.now())).digest("hex").slice(0, 12);
      this.emitFile({
        type: "asset",
        fileName: "sw-precache.js",
        source: `self.__EVOQUE_VERSAO=${JSON.stringify(versao)};\nself.__EVOQUE_PRECACHE=${JSON.stringify(lista)};\n`,
      });
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  plugins: [preCacheOffline(), mcpPlugin()],
});
