import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PdfTableOptions {
  title: string;
  subtitle?: string;
  fileName: string;
  summary?: { label: string; value: string }[];
  columns: string[];
  rows: (string | number | null | undefined)[][];
  notes?: string[];
  footer?: string;
}

const FOREST: [number, number, number] = [22, 101, 52];
const INK: [number, number, number] = [24, 40, 30];
const CREAM: [number, number, number] = [254, 252, 232];

/** Generate a clean, paginated PDF report. All numbers come from the caller. */
export function generateTablePdf(options: PdfTableOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFillColor(...CREAM);
  doc.rect(0, 0, pageWidth, 38, 'F');

  doc.setTextColor(...FOREST);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('FarmDesk', margin, 16);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(options.title, margin, 23);
  if (options.subtitle) {
    doc.setTextColor(80, 90, 82);
    doc.setFontSize(9);
    doc.text(options.subtitle, margin, 29);
  }

  doc.setFontSize(8);
  doc.setTextColor(80, 90, 82);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - margin, 16, { align: 'right' });

  let y = 46;

  if (options.summary?.length) {
    const gap = 4;
    const boxWidth = (pageWidth - margin * 2 - gap * (options.summary.length - 1)) / options.summary.length;
    options.summary.forEach((item, i) => {
      const x = margin + i * (boxWidth + gap);
      doc.setFillColor(245, 247, 243);
      doc.setDrawColor(224, 228, 222);
      doc.roundedRect(x, y, boxWidth, 18, 2, 2, 'FD');
      doc.setTextColor(90, 100, 92);
      doc.setFontSize(7.5);
      doc.text(item.label, x + 3, y + 6);
      doc.setTextColor(...INK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(item.value, x + 3, y + 13);
      doc.setFont('helvetica', 'normal');
    });
    y += 25;
  }

  autoTable(doc, {
    startY: y,
    head: [options.columns],
    body: options.rows.map((row) => row.map((cell) => (cell == null ? '—' : String(cell)))),
    margin: { left: margin, right: margin, bottom: 18 },
    styles: { fontSize: 8, cellPadding: 2.4, textColor: INK, lineColor: [230, 233, 228], lineWidth: 0.1 },
    headStyles: { fillColor: FOREST, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [249, 250, 247] },
    theme: 'grid',
  });

  let finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  if (options.notes?.length) {
    if (finalY > 250) {
      doc.addPage();
      finalY = 20;
    }
    doc.setFontSize(7.5);
    doc.setTextColor(100, 110, 102);
    finalY += 6;
    for (const note of options.notes) {
      const lines = doc.splitTextToSize(note, pageWidth - margin * 2);
      doc.text(lines, margin, finalY);
      finalY += lines.length * 3.5;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 128, 120);
    doc.text(
      options.footer ?? 'FarmDesk — planning support only, not a guarantee of yield, price or weather.',
      margin,
      doc.internal.pageSize.getHeight() - 8
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  doc.save(options.fileName.endsWith('.pdf') ? options.fileName : `${options.fileName}.pdf`);
}

export interface PdfSection {
  heading: string;
  columns: string[];
  rows: (string | number | null | undefined)[][];
}

/** Financial report PDF with several sections. */
export function generateReportPdf(args: {
  title: string;
  subtitle: string;
  fileName: string;
  summary: { label: string; value: string }[];
  sections: PdfSection[];
  notes?: string[];
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, pageWidth, 36, 'F');
  doc.setTextColor(...FOREST);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('FarmDesk', margin, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(args.title, margin, 22);
  doc.setFontSize(8);
  doc.setTextColor(90, 100, 92);
  doc.text(args.subtitle, margin, 28);
  doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, pageWidth - margin, 15, { align: 'right' });

  let y = 44;
  const boxWidth = (pageWidth - margin * 2 - 12) / Math.max(1, Math.min(4, args.summary.length));
  args.summary.slice(0, 4).forEach((item, i) => {
    const x = margin + (i % 4) * (boxWidth + 4);
    const row = Math.floor(i / 4);
    const yy = y + row * 20;
    doc.setFillColor(246, 248, 244);
    doc.setDrawColor(226, 230, 224);
    doc.roundedRect(x, yy, boxWidth, 17, 2, 2, 'FD');
    doc.setTextColor(90, 100, 92);
    doc.setFontSize(7);
    doc.text(item.label, x + 2.5, yy + 5.5);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(item.value, x + 2.5, yy + 12);
    doc.setFont('helvetica', 'normal');
  });
  y += 24 + Math.ceil(args.summary.length / 4) * 20;

  for (const section of args.sections) {
    if (y > 255) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(...FOREST);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(section.heading, margin, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [section.columns],
      body: section.rows.map((r) => r.map((c) => (c == null ? '—' : String(c)))),
      margin: { left: margin, right: margin, bottom: 18 },
      styles: { fontSize: 8, cellPadding: 2.2, textColor: INK, lineColor: [230, 233, 228], lineWidth: 0.1 },
      headStyles: { fillColor: FOREST, textColor: [255, 255, 255], fontSize: 8 },
      alternateRowStyles: { fillColor: [249, 250, 247] },
      theme: 'grid',
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 9;
  }

  if (args.notes?.length) {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFontSize(7.5);
    doc.setTextColor(100, 110, 102);
    for (const note of args.notes) {
      const lines = doc.splitTextToSize(note, pageWidth - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 3.5;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 128, 120);
    doc.text('FarmDesk — figures are based on your recorded data and cited sources. Not a guarantee.', margin, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  doc.save(args.fileName.endsWith('.pdf') ? args.fileName : `${args.fileName}.pdf`);
}
