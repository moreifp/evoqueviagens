async function decodificar(arquivo: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  const url = URL.createObjectURL(arquivo);
  try {
    return await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = erro;
      i.src = url;
    });
  } catch {
    return await createImageBitmap(arquivo);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Lado maior das imagens que vão para a leitura por IA. A Anthropic reduz tudo acima de ~1568 px
 * (e recusa imagem acima de 5 MB), então mandar maior só gasta rede e arrisca recusa.
 */
export const LADO_IA = 1568;
/** Documentos (passaporte/MRZ): um pouco mais de folga para as linhas de baixo continuarem nítidas. */
export const LADO_DOC_IA = 2000;
/** Teto de tamanho do JPEG enviado à IA (bem abaixo dos 5 MB da Anthropic). */
const MAX_BYTES_IA = 3_500_000;

/** Reduz a foto no aparelho antes de enviar (JPEG, lado maior ≤ max, nunca amplia). Aceita HEIC quando o navegador sabe abrir. */
export async function comprimir(arquivo: Blob, max = 1600, qualidade = 0.85): Promise<Blob> {
  const img = await decodificar(arquivo);
  const esc = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * esc);
  c.height = Math.round(img.height * esc);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return await new Promise<Blob>((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error("toBlob"))), "image/jpeg", qualidade));
}

/** Foto pronta para a leitura por IA: JPEG ~0,85, lado maior ≤ 1568 px, nunca ampliada. */
export async function imagemParaIA(arquivo: Blob, max = LADO_IA): Promise<Blob> {
  const b = await comprimir(arquivo, max, 0.85);
  return b.size > MAX_BYTES_IA ? comprimir(arquivo, Math.round(max * 0.75), 0.75) : b;
}

/** Melhora contraste e nitidez de documentos fotografados antes da leitura OCR (nunca amplia). */
export async function melhorarDocumentoParaOcr(arquivo: Blob, maxLado = LADO_DOC_IA): Promise<Blob> {
  const img = await decodificar(arquivo);
  const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * escala));
  c.height = Math.max(1, Math.round(img.height * escala));
  const ctx = c.getContext("2d");
  if (!ctx) return arquivo;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);

  const pixels = ctx.getImageData(0, 0, c.width, c.height);
  const hist = new Uint32Array(256);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const y = Math.round(0.2126 * (pixels.data[i] ?? 0) + 0.7152 * (pixels.data[i + 1] ?? 0) + 0.0722 * (pixels.data[i + 2] ?? 0));
    hist[y] = (hist[y] ?? 0) + 1;
  }
  const total = c.width * c.height;
  const limiteBaixo = total * 0.02;
  const limiteAlto = total * 0.98;
  let soma = 0;
  let baixo = 0;
  let alto = 255;
  for (let i = 0; i < 256; i += 1) {
    soma += hist[i] ?? 0;
    if (soma >= limiteBaixo) { baixo = i; break; }
  }
  soma = 0;
  for (let i = 0; i < 256; i += 1) {
    soma += hist[i] ?? 0;
    if (soma >= limiteAlto) { alto = i; break; }
  }
  const faixa = Math.max(48, alto - baixo);
  for (let i = 0; i < pixels.data.length; i += 4) {
    for (let canal = 0; canal < 3; canal += 1) {
      const ajustado = (((pixels.data[i + canal] ?? 0) - baixo) * 255) / faixa;
      pixels.data[i + canal] = Math.max(0, Math.min(255, ajustado));
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const jpeg = (q: number) => new Promise<Blob | null>((ok) => c.toBlob((b) => ok(b), "image/jpeg", q));
  const b = (await jpeg(0.85)) ?? arquivo;
  return b.size > MAX_BYTES_IA ? ((await jpeg(0.7)) ?? b) : b;
}

export type Ext = string;

export function ehPdf(f: File) {
  return f.type === "application/pdf" || /\.pdf$/i.test(f.name);
}

function ehImagem(f: File) {
  return f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name);
}

function extensaoDe(nome: string): string {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(nome);
  return m ? m[1]!.toLowerCase() : "bin";
}

/** Foto → JPEG comprimido; PDF e qualquer outro arquivo (eml, doc, xls…) vão como estão. */
export async function prepararArquivo(f: File, max = 1600): Promise<{ blob: Blob; ext: Ext; contentType: string }> {
  if (ehPdf(f)) return { blob: f, ext: "pdf", contentType: "application/pdf" };
  if (!ehImagem(f)) return { blob: f, ext: extensaoDe(f.name), contentType: f.type || "application/octet-stream" };
  try {
    return { blob: await comprimir(f, max), ext: "jpg", contentType: "image/jpeg" };
  } catch {
    if (/heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)) return { blob: f, ext: "heic", contentType: "image/heic" };
    throw new Error("Não deu para abrir essa imagem.");
  }
}

export function blobParaDataUrl(b: Blob): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = erro;
    r.readAsDataURL(b);
  });
}

/** Data URL da foto reduzida para a leitura por IA, ou null se o navegador não conseguiu abrir. */
export async function dataUrlParaIA(f: Blob): Promise<string | null> {
  try {
    return await blobParaDataUrl(await imagemParaIA(f));
  } catch {
    return null;
  }
}
