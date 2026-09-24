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

/** Reduz a foto no aparelho antes de enviar (JPEG, lado maior ≤ max). Aceita HEIC quando o navegador sabe abrir. */
export async function comprimir(arquivo: File, max = 1600, qualidade = 0.85): Promise<Blob> {
  const img = await decodificar(arquivo);
  const esc = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * esc);
  c.height = Math.round(img.height * esc);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return await new Promise<Blob>((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error("toBlob"))), "image/jpeg", qualidade));
}

/** Melhora contraste e nitidez de documentos fotografados antes da leitura OCR. */
export async function melhorarDocumentoParaOcr(arquivo: Blob): Promise<Blob> {
  const img = await decodificar(arquivo);
  const escala = Math.min(1.6, 2200 / Math.max(img.width, img.height));
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
  return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b ?? arquivo), "image/jpeg", 0.92));
}

export type Ext = "jpg" | "pdf" | "heic";

export function ehPdf(f: File) {
  return f.type === "application/pdf" || /\.pdf$/i.test(f.name);
}

/** Foto → JPEG comprimido; PDF vai como está; HEIC que o navegador não abre vai original. */
export async function prepararArquivo(f: File, max = 1600): Promise<{ blob: Blob; ext: Ext; contentType: string }> {
  if (ehPdf(f)) return { blob: f, ext: "pdf", contentType: "application/pdf" };
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
