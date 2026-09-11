import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { units, type Unit } from "@/modules/catalog/rules";
import { reportLines, type ShiftReport } from "./shift-report";

const ink = rgb(0.08, 0.19, 0.25);
const muted = rgb(0.32, 0.39, 0.43);
const accent = rgb(0.02, 0.4, 0.45);
const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("ro-RO", {
        timeZone: "Europe/Bucharest",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "Nespecificat";
const quantity = (value: number) =>
  new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 3 }).format(value);

export function wrap(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of value.replace(/[\u0000-\u001f\u007f]/g, " ").split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const char of word) {
      if (font.widthOfTextAtSize(line + char, size) > width && line) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function generateShiftPdf(report: ShiftReport) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts");
  const [regular, bold] = await Promise.all([
    readFile(join(fonts, "LiberationSans-Regular.ttf")),
    readFile(join(fonts, "LiberationSans-Bold.ttf")),
  ]);
  const font = await doc.embedFont(regular, { subset: true });
  const strong = await doc.embedFont(bold, { subset: true });
  doc.setTitle("Raport final de tură");
  doc.setAuthor("Gestiune substații");
  doc.setCreationDate(new Date(report.closed_at));
  doc.setModificationDate(new Date(report.closed_at));
  let page = doc.addPage([595.28, 841.89]);
  let y = 790;
  function nextPage() {
    page = doc.addPage([595.28, 841.89]);
    y = 790;
  }
  function text(value: string, size = 11, heavy = false) {
    const face = heavy ? strong : font;
    for (const line of wrap(value, face, size, 499)) {
      if (y < 72) nextPage();
      page.drawText(line, { x: 48, y, size, font: face, color: ink });
      y -= size + 6;
    }
  }
  text("SAJ · GESTIUNE SUBSTAȚII", 10, true);
  y -= 10;
  text("Raport final de tură", 23, true);
  y -= 8;
  text(`Titular: ${report.content.holder_name}`);
  text(`Mașină: ${report.content.vehicle}`);
  text(`Data operațională: ${report.content.operational_date ?? "Nespecificată"}`);
  text(`Tură pornită: ${date(report.content.started_at)}`);
  text(`Sfârșit planificat: ${date(report.content.planned_end)}`);
  text(`Închisă: ${date(report.closed_at)} (Europe/Bucharest)`);
  if (
    report.content.planned_end &&
    new Date(report.closed_at) < new Date(report.content.planned_end)
  )
    text("Închidere anticipată", 11, true);
  y -= 18;
  text("Materiale la închiderea turei", 15, true);
  const rows = reportLines(report);
  const hasReturns = rows.some((row) => Number(row.returned) > 0);
  const columns = hasReturns ? [317, 385, 458, 532] : [347, 440, 532];
  function heading() {
    if (y < 115) nextPage();
    page.drawRectangle({ x: 48, y: y - 10, width: 499, height: 29, color: rgb(0.91, 0.96, 0.96) });
    page.drawText("Produs / unitate", { x: 56, y, size: 10, font: strong, color: accent });
    const titles = hasReturns
      ? ["Preluat", "Consumat", "Returnat", "Rămas"]
      : ["Preluat", "Consumat", "Rămas"];
    titles.forEach((title, index) =>
      page.drawText(title, {
        x: columns[index] - strong.widthOfTextAtSize(title, 9),
        y,
        size: 9,
        font: strong,
        color: accent,
      }),
    );
    y -= 32;
  }
  heading();
  for (const row of rows) {
    const label = wrap(
      `${row.product_name} · ${units[row.base_unit as Unit] ?? row.base_unit}`,
      font,
      10,
      hasReturns ? 201 : 232,
    );
    let offset = 0;
    while (offset < label.length) {
      if (y < 100) {
        nextPage();
        heading();
      }
      const count = Math.min(label.length - offset, Math.max(1, Math.floor((y - 85) / 15)));
      label
        .slice(offset, offset + count)
        .forEach((line, index) =>
          page.drawText(line, { x: 56, y: y - index * 15, size: 10, font, color: ink }),
        );
      if (offset === 0) {
        const values = hasReturns
          ? [row.issued, row.consumed, row.returned, row.remaining!]
          : [row.issued, row.consumed, row.remaining!];
        values.forEach((value, index) => {
          const label = quantity(Number(value));
          const size = Math.min(10, (hasReturns ? 58 : 80) / strong.widthOfTextAtSize(label, 1));
          page.drawText(label, {
            x: columns[index] - strong.widthOfTextAtSize(label, size),
            y,
            size,
            font: strong,
            color: ink,
          });
        });
      }
      y -= count * 15 + 12;
      offset += count;
    }
    page.drawLine({
      start: { x: 48, y: y + 13 },
      end: { x: 547, y: y + 13 },
      thickness: 0.5,
      color: rgb(0.8, 0.86, 0.88),
    });
  }
  y -= 12;
  text("Rămas = cantitatea păstrată în mașină pentru tura următoare.", 10);
  if (hasReturns) text("Returnat = cantitatea primită în magazie prin retur confirmat.", 10);
  text("Raport generat din declarația finală. Descărcarea nu modifică stocul.", 10);
  y -= 10;
  text(`Declarație v${report.version} · SHA-256`, 9, true);
  text(report.content_hash, 8);
  const pages = doc.getPages();
  pages.forEach((p, index) => {
    p.drawText(`Tură ${report.id}`, { x: 48, y: 39, size: 8, font, color: muted });
    p.drawText(`${index + 1} / ${pages.length}`, { x: 512, y: 39, size: 9, font, color: muted });
  });
  return doc.save();
}
