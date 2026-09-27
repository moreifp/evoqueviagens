import type { Acerto, Expense, Membro } from "./data";
import { CATEGORIAS } from "./categorias";
import { centavos, saldosDaViagem } from "./divisao";

/** Tabela no formato do Splitwise: cada coluna de pessoa = quanto pagou − sua parte (positivo = tem a receber). */
export function montarTabela(nomeViagem: string, despesas: Expense[], acertos: Acerto[], membros: Membro[], moeda: string) {
  const ordem = [...new Set([...membros.map((m) => m.person_id), ...Object.keys(saldosDaViagem(despesas, acertos))])];
  const nome = (p: string) => membros.find((m) => m.person_id === p)?.nome ?? "Alguém";
  const cabecalho = ["Data", "Descrição", "Categoria", "Custo", "Moeda", ...ordem.map(nome)];
  type Linha = { data: string; desc: string; cat: string; custo: number; efeito: Record<string, number> };
  const linhas: Linha[] = [];
  for (const d of despesas) {
    const ef: Record<string, number> = {};
    if (!d.pessoal) {
      for (const p of d.pagadores) ef[p.person_id] = (ef[p.person_id] ?? 0) + centavos(p.valor_moeda_base);
      for (const p of d.partes) ef[p.person_id] = (ef[p.person_id] ?? 0) - centavos(p.valor_moeda_base);
    }
    const cat = CATEGORIAS.find((c) => c.id === d.categoria)?.rotulo ?? d.categoria;
    linhas.push({ data: d.data, desc: d.descricao, cat: d.pessoal ? `Pessoal · ${nome(d.pessoal_de ?? "")}` : cat, custo: centavos(d.valor_moeda_base), efeito: ef });
  }
  for (const a of acertos) {
    const c = centavos(a.valor_moeda_base);
    linhas.push({ data: a.data, desc: `${nome(a.de_person_id)} pagou ${nome(a.para_person_id)}`, cat: "Pagamento", custo: c, efeito: { [a.de_person_id]: c, [a.para_person_id]: -c } });
  }
  linhas.sort((a, b) => a.data.localeCompare(b.data));
  const saldos = saldosDaViagem(despesas, acertos);
  const corpo = linhas.map((l) => [l.data, l.desc, l.cat, l.custo / 100, moeda, ...ordem.map((p) => (l.efeito[p] ?? 0) / 100)]);
  const hoje = new Date().toISOString().slice(0, 10);
  const total = [hoje, "Saldo total", "", "", moeda, ...ordem.map((p) => (saldos[p] ?? 0) / 100)];
  const arquivo = `${nomeViagem.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}_${hoje}_despesas`;
  return { titulo: nomeViagem, cabecalho, corpo, total, arquivo };
}

type Tabela = ReturnType<typeof montarTabela>;

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function baixarExcel(t: Tabela) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(t.titulo.slice(0, 31) || "Despesas");
  ws.addRow([t.titulo]).font = { bold: true, size: 14 };
  const cab = ws.addRow(t.cabecalho); cab.font = { bold: true };
  ws.addRow([]);
  t.corpo.forEach((r) => ws.addRow(r));
  ws.addRow([]);
  ws.addRow(t.total).font = { bold: true };
  ws.columns.forEach((c, i) => { c.width = i === 1 ? 36 : i === 2 ? 20 : 14; if (i === 3 || i >= 5) c.numFmt = "#,##0.00"; });
  const buf = await wb.xlsx.writeBuffer();
  baixar(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${t.arquivo}.xlsx`);
}

export async function baixarPdf(t: Tabela) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v ?? ""));
  doc.setFontSize(16); doc.text(t.titulo, 40, 40);
  autoTable(doc, {
    startY: 56,
    head: [t.cabecalho],
    body: t.corpo.map((r) => r.map(n)),
    foot: [t.total.map(n)],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [12, 28, 44] },
    footStyles: { fillColor: [37, 96, 106] },
    columnStyles: Object.fromEntries(t.cabecalho.map((_, i) => [i, { halign: i === 3 || i >= 5 ? "right" : "left" }])),
  });
  doc.save(`${t.arquivo}.pdf`);
}
