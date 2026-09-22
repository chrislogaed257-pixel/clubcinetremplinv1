import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoData from "@/assets/logo-pdf.png?inline";

const BRAND = "CLUB CINÉ TREMPLIN";
const SLOGAN = "On apprend, on tourne, on décolle";

function header(doc: jsPDF, title: string, subtitle?: string) {
  const right = doc.internal.pageSize.getWidth() - 14;
  try {
    doc.addImage(logoData as unknown as string, "PNG", 14, 8, 22, 22);
  } catch {
    /* le logo reste facultatif */
  }
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(BRAND, 40, 15);
  doc.setFontSize(8);
  doc.text(SLOGAN, 40, 20);
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text(title, 14, 40);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(subtitle, 14, 47);
  }
  doc.setDrawColor(200);
  doc.line(14, 51, right, 51);
  return 58;
}

function slug(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "document"
  );
}

/** Document PDF simple : titre, sous-titre et paragraphes. */
export function downloadTextPdf(opts: {
  title: string;
  subtitle?: string;
  blocks: { label?: string; text: string }[];
  fileName?: string;
}) {
  const doc = new jsPDF();
  let y = header(doc, opts.title, opts.subtitle);
  for (const b of opts.blocks) {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    if (b.label) {
      doc.setFontSize(11);
      doc.setTextColor(20);
      doc.text(b.label, 14, y);
      y += 6;
    }
    doc.setFontSize(10);
    doc.setTextColor(60);
    const lines = doc.splitTextToSize(b.text || "—", 180) as string[];
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 14, y);
      y += 5;
    }
    y += 4;
  }
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    `Document généré le ${new Date().toLocaleString("fr-FR")} — ${BRAND}`,
    14,
    290,
  );
  doc.save(`${opts.fileName ?? slug(opts.title)}.pdf`);
}

/** Tableau PDF (liste de données). */
export function downloadTablePdf(opts: {
  title: string;
  subtitle?: string;
  head: string[];
  rows: (string | number)[][];
  fileName?: string;
}) {
  const doc = new jsPDF(opts.head.length > 5 ? "landscape" : "portrait");
  const y = header(doc, opts.title, opts.subtitle);
  autoTable(doc, {
    startY: y,
    head: [opts.head],
    body: opts.rows.map((r) => r.map((c) => String(c ?? ""))),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [35, 35, 40] },
  });
  doc.save(`${opts.fileName ?? slug(opts.title)}.pdf`);
}

/** Fichier CSV lisible par Excel (séparateur point-virgule, BOM UTF-8). */
export function downloadCsv(
  fileName: string,
  head: string[],
  rows: (string | number | null | undefined)[][],
) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [head, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(fileName)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Construit un lien mailto prérempli. */
export function mailtoLink(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Ouvre le client mail avec un message prérempli. */
export function openMail(to: string, subject: string, body: string) {
  window.location.href = mailtoLink(to, subject, body);
}
