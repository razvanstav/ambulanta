import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { wrap } from "./pdf";
import {
  reportKinds,
  reportNotes,
  reportTable,
  type AggregateReport,
  type ReportFilters,
  type ReportKind,
} from "./aggregate";

export async function generateAggregatePdf(
  report: AggregateReport,
  kind: ReportKind,
  filters: ReportFilters,
) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(
    await readFile(
      join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"),
    ),
    { subset: true },
  );
  doc.setTitle(reportKinds[kind]);
  doc.setAuthor("Gestiune substații");
  doc.setCreationDate(new Date(report.generated_at));
  doc.setModificationDate(new Date(report.generated_at));
  const table = reportTable(report, kind);
  const widths =
    kind === "warehouse"
      ? [103, 158, 56, 85, 85, 85, 85, 105]
      : kind === "closed"
        ? [100, 148, 96, 100, 112, 206]
        : kind === "pending"
          ? [106, 156, 98, 116, 118, 168]
          : [130, 205, 220, 60, 147];
  const ink = rgb(0.08, 0.19, 0.25);
  let page = doc.addPage([842, 595]),
    y = 552;
  function text(value: string, size = 10) {
    for (const line of wrap(value, font, size, 762)) {
      if (y < 55) next();
      page.drawText(line, { x: 40, y, font, size, color: ink });
      y -= size + 5;
    }
  }
  function next() {
    page = doc.addPage([842, 595]);
    y = 552;
  }
  function heading() {
    const lines = table.headers.map((h, i) => wrap(h, font, 9, widths[i] - 12));
    const height = Math.max(...lines.map((l) => l.length)) * 13 + 12;
    page.drawRectangle({
      x: 40,
      y: y - height + 13,
      width: 762,
      height,
      color: rgb(0.91, 0.96, 0.96),
    });
    let x = 46;
    lines.forEach((ls, i) => {
      ls.forEach((l, j) => page.drawText(l, { x, y: y - j * 13, font, size: 9, color: ink }));
      x += widths[i];
    });
    y -= height;
  }
  text(`SAJ · ${reportKinds[kind]}`, 20);
  y -= 6;
  for (const note of reportNotes(report, kind, filters)) text(note, 9);
  y -= 12;
  if (y < 120) next();
  heading();
  if (!table.rows.length) text("Nu există înregistrări pentru selecția curentă.");
  for (const row of table.rows) {
    const cells = row.map((value, i) => wrap(value, font, 9, widths[i] - 12));
    const length = Math.max(...cells.map((c) => c.length));
    let offset = 0;
    while (offset < length) {
      if (y < 80) {
        next();
        heading();
      }
      const count = Math.min(length - offset, Math.max(1, Math.floor((y - 60) / 13)));
      let x = 46;
      cells.forEach((lines, i) => {
        lines
          .slice(offset, offset + count)
          .forEach((l, j) => page.drawText(l, { x, y: y - j * 13, font, size: 9, color: ink }));
        x += widths[i];
      });
      y -= count * 13 + 10;
      offset += count;
    }
    page.drawLine({
      start: { x: 40, y: y + 12 },
      end: { x: 802, y: y + 12 },
      thickness: 0.4,
      color: rgb(0.8, 0.86, 0.88),
    });
  }
  doc.getPages().forEach((p, i) =>
    p.drawText(`Gestiune substații · ${i + 1} / ${doc.getPageCount()}`, {
      x: 40,
      y: 26,
      font,
      size: 8,
      color: ink,
    }),
  );
  return doc.save();
}
