/** Renderiza as 2 primeiras páginas de um PDF como uma única imagem JPEG (no aparelho, com pdf.js). */
export async function pdfParaImagem(arquivo: Blob, maxPaginas = 2, largura = 2000): Promise<Blob> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const paginas: HTMLCanvasElement[] = [];
  for (let n = 1; n <= Math.min(maxPaginas, doc.numPages); n++) {
    const p = await doc.getPage(n);
    const base = p.getViewport({ scale: 1 });
    const vp = p.getViewport({ scale: Math.min(4, largura / base.width) });
    const c = document.createElement("canvas");
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await p.render({ canvasContext: ctx, viewport: vp }).promise;
    paginas.push(c);
  }
  const w = Math.max(...paginas.map((c) => c.width));
  const h = paginas.reduce((s, c) => s + c.height, 0);
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  let y = 0;
  for (const c of paginas) { ctx.drawImage(c, 0, y); y += c.height; }
  void doc.destroy();
  return await new Promise<Blob>((ok, erro) => out.toBlob((b) => (b ? ok(b) : erro(new Error("toBlob"))), "image/jpeg", 0.92));
}
