import { describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { generateShiftPdf } from "./pdf";
import { reportLines, type ShiftReport } from "./shift-report";

const fixture: ShiftReport = {
  id: "00000000-0000-4000-8000-000000000001",
  closed_at: "2026-09-11T09:00:00Z",
  version: 2,
  content_hash: "a".repeat(64),
  content: {
    holder_name: "Ștefan Țăranu · exemplu fictiv",
    vehicle: "DEMO-01",
    started_at: "2026-09-11T05:00:00Z",
    planned_end: "2026-09-11T17:00:00Z",
    operational_date: "2026-09-11",
    lines: [
      {
        allocation_id: "a",
        product_code: "P1",
        product_name: "Soluție pentru îngrijire",
        lot_code: "intern",
        base_unit: "ml",
        quantity_precision: 3,
        issued: 0.3,
        consumed: 0.1,
        returned: 0,
      },
    ],
  },
};

describe("final shift PDF", () => {
  it("groups immutable product snapshots with exact thousandths and keeps renamed snapshots distinct", () => {
    const line = fixture.content.lines[0];
    const report = {
      ...fixture,
      content: { ...fixture.content, lines: [line, { ...line, allocation_id: "b" }] },
    };
    expect(reportLines(report)[0]).toMatchObject({ issued: 0.6, consumed: 0.2, remaining: 0.4 });
    report.content.lines.push({ ...line, product_name: "Altă denumire" });
    expect(reportLines(report)).toHaveLength(2);
    expect(line).not.toHaveProperty("remaining");
  });
  it("embeds Romanian text, paginates long labels, preserves every product and repeats table headings", async () => {
    const report = structuredClone(fixture);
    report.content.lines = Array.from({ length: 65 }, (_, index) => ({
      ...fixture.content.lines[0],
      allocation_id: String(index),
      product_code: `P${index}`,
      product_name: `Material ${String(index).padStart(3, "0")} · ȘțĂâÎî ${index === 0 ? "Denumire foarte lungă pentru verificarea rândurilor multiple ".repeat(4) : "Soluție de îngrijire"}`,
      issued: 15,
      consumed: 7,
      remaining: 8,
    }));
    const bytes = await generateShiftPdf(report);
    await mkdir(".verification/pdfs", { recursive: true });
    await writeFile(".verification/pdfs/raport-m08.pdf", bytes);
    const task = getDocument({ data: bytes, useSystemFonts: false });
    const pdf = await task.promise;
    expect(pdf.numPages).toBeGreaterThan(2);
    let text = "";
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const items = content.items.filter((item) => "str" in item);
      const pageText = items.map((item) => item.str).join(" ");
      expect(pageText).toContain(`${number} / ${pdf.numPages}`);
      for (const item of items) {
        expect(item.transform[4]).toBeGreaterThanOrEqual(47);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(548);
        expect(item.transform[5]).toBeGreaterThanOrEqual(38);
      }
      text += pageText + " ";
    }
    expect(text).toContain("Ștefan Țăranu");
    expect(text).toContain("Închidere anticipată");
    expect(text).toContain("12:00");
    for (let index = 0; index < 65; index++)
      expect(text).toContain(`Material ${String(index).padStart(3, "0")}`);
    expect(text).not.toContain("intern");
    expect(text).not.toContain("Returnat");
    await task.destroy();
  });
  it("includes confirmed legacy returns and never loses fractional quantities", async () => {
    const report = structuredClone(fixture);
    report.content.lines[0].returned = 0.1;
    const task = getDocument({ data: await generateShiftPdf(report) });
    const pdf = await task.promise;
    const content = await (await pdf.getPage(1)).getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    expect(text).toContain("Returnat");
    expect(text).toContain("0,3");
    expect(text.match(/0,1/g)).toHaveLength(3);
    await task.destroy();
  });
});
