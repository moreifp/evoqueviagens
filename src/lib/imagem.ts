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
