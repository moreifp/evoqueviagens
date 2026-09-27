/** Erro com o passo que falhou, para mostrar um motivo curto na tela. */
export class ErroLeitura extends Error {
  constructor(public passo: string, public motivo: string, public causa?: unknown) {
    super(motivo);
  }
}

type PdfJs = typeof import("pdfjs-dist");
let carregado: Promise<PdfJs> | null = null;

/** Build "legacy" do pdf.js (funciona em Safari/iOS mais antigos); worker com fallback sem worker. */
async function carregarPdfJs(): Promise<PdfJs> {
  const P = Promise as unknown as { withResolvers?: unknown };
  if (typeof P.withResolvers !== "function") {
    P.withResolvers = function <T>() {
      let resolve!: (v: T) => void; let reject!: (e: unknown) => void;
      const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
      return { promise, resolve, reject };
    };
  }
  carregado ??= (async () => {
    const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJs;
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
    } catch (e) {
      console.warn("PDF_WORKER_URL", e);
    }
    return pdfjs;
  })();
  return carregado;
}

async function abrir(arquivo: Blob) {
  const pdfjs = await carregarPdfJs().catch((e) => { carregado = null; throw new ErroLeitura("carregar pdf.js", "O leitor de PDF não abriu", e); });
  const data = new Uint8Array(await arquivo.arrayBuffer());
  try {
    return await pdfjs.getDocument({ data: data.slice() }).promise;
  } catch (e) {
    console.warn("PDF_COM_WORKER_FALHOU · tentando sem worker", e);
    try {
      return await pdfjs.getDocument({ data, disableWorker: true } as Parameters<PdfJs["getDocument"]>[0]).promise;
    } catch (e2) {
      throw new ErroLeitura("abrir pdf", "O PDF não abriu", e2);
    }
  }
}

function paraBlob(c: HTMLCanvasElement, q = 0.9) {
  return new Promise<Blob>((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error("toBlob"))), "image/jpeg", q));
}

/** Corta a margem branca; devolve null se quase não houver margem. */
export function recortarConteudo(c: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const { width: w, height: h } = c;
  const px = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  const passo = 2;
  for (let y = 0; y < h; y += passo) for (let x = 0; x < w; x += passo) {
    const i = (y * w + x) * 4;
    if ((px[i]! + px[i + 1]! + px[i + 2]!) < 705) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const pad = Math.round(Math.min(w, h) * 0.02);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad);
  const cw = x1 - x0, ch = y1 - y0;
  if (cw * ch > w * h * 0.85) return null;
  const out = document.createElement("canvas");
  out.width = cw; out.height = ch;
  out.getContext("2d")!.drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
  return out;
}

function limitar(c: HTMLCanvasElement, max: number) {
  const esc = Math.min(1, max / Math.max(c.width, c.height));
  if (esc === 1) return c;
  const out = document.createElement("canvas");
  out.width = Math.round(c.width * esc); out.height = Math.round(c.height * esc);
  const ctx = out.getContext("2d")!; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(c, 0, 0, out.width, out.height);
  return out;
}

export type PaginaPdf = { pagina: number; total: number; imagem: Blob };

/**
 * Renderiza UMA página (sem empilhar), em alta resolução, com margem branca cortada.
 * Largura final de pelo menos ~2000 px para a MRZ continuar legível.
 */
export async function pdfPagina(arquivo: Blob, n = 1): Promise<PaginaPdf> {
  const doc = await abrir(arquivo);
  try {
    if (n > doc.numPages) throw new ErroLeitura("renderizar", "O PDF não tem essa página");
    const p = await doc.getPage(n);
    const base = p.getViewport({ scale: 1 });
    // ~3000 px no lado menor, sem passar de ~14 Mpx (limite do Safari).
    let escala = 3000 / Math.min(base.width, base.height);
    escala = Math.min(escala, Math.sqrt(14_000_000 / (base.width * base.height)));
    const vp = p.getViewport({ scale: escala });
    const c = document.createElement("canvas");
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext("2d");
    if (!ctx) throw new ErroLeitura("renderizar", "A página do PDF é grande demais para este aparelho");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    try { await p.render({ canvasContext: ctx, viewport: vp }).promise; }
    catch (e) { throw new ErroLeitura("renderizar", "Não deu para desenhar a página do PDF", e); }
    const final = limitar(recortarConteudo(c) ?? c, 3000);
    return { pagina: n, total: doc.numPages, imagem: await paraBlob(final) };
  } finally {
    void doc.destroy();
  }
}

/** Compatibilidade: primeira página como imagem. */
export async function pdfParaImagem(arquivo: Blob): Promise<Blob> {
  return (await pdfPagina(arquivo, 1)).imagem;
}
