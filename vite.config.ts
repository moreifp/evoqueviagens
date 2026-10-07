// Configuração do Vite (TanStack Start + React + Tailwind + nitro para Cloudflare Workers).
// Antes vinha pronta do @lovable.dev/vite-tanstack-config; agora está explícita aqui.
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

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
      // Primeira instalação leve: arquivos pesados e da landing ficam para o cache em tempo de uso.
      // index.es-* (canvg + polyfills do gerador de PDF) e o drawer (vaul) carregam sob demanda.
      const pesado = /(index\.es-|polyfill|drawer-|vaul|pdf\.worker|pdf[.-]|exceljs|jspdf|html2canvas|purify|og-|marketing|Marketing|Landing|landing|coast-editorial|train-editorial|\.woff2$.*marketing)/;
      const lista = [...new Set([...arquivos, ...publicos, "/manifest.webmanifest"])].filter((f) => !pesado.test(f)).sort();
      const versao = createHash("sha256").update(lista.join("\n")).update(String(Date.now())).digest("hex").slice(0, 12);
      this.emitFile({
        type: "asset",
        fileName: "sw-precache.js",
        source: `self.__EVOQUE_VERSAO=${JSON.stringify(versao)};\nself.__EVOQUE_PRECACHE=${JSON.stringify(lista)};\n`,
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  // Variáveis VITE_* do .env/.env.local e do painel do Cloudflare (Build variables) entram no código do navegador.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine = Object.fromEntries(Object.entries(env).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]));
  return {
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // O servidor começa em src/server.ts (página de erro amigável no SSR).
        server: { entry: "server" },
        importProtection: { behavior: "error", client: { files: ["**/server/**"], specifiers: ["server-only"] } },
      }),
      ...(command === "build"
        ? [nitro({ preset: "cloudflare-module", cloudflare: { nodeCompat: true, deployConfig: true } })]
        : []),
      viteReact(),
      preCacheOffline(),
    ],
    // Carimbo de data/hora de cada build — mostrado no fim da tela "Eu" para
    // confirmar no aparelho se a versão publicada é a mais recente.
    define: { ...envDefine, __EVOQUE_BUILD__: JSON.stringify(new Date().toISOString()) },
    resolve: {
      alias: {
        "@": join(process.cwd(), "src"),
        "entities/lib/decode.js": join(process.cwd(), "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": join(process.cwd(), "node_modules/entities/lib/encode.js"),
        entities: join(process.cwd(), "node_modules/entities"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
    optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"] },
    server: { host: "::", port: 8080 },
  };
});
