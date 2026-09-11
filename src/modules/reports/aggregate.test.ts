import { expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  csvCell,
  localDay,
  parseReportFilters,
  reportCsv,
  reportTable,
  type AggregateReport,
} from "./aggregate";
import { generateAggregatePdf } from "./aggregate-pdf";

const filters = parseReportFilters(new URLSearchParams("from=2026-09-01&until=2026-09-12"));
const report: AggregateReport = {
  generated_at: "2026-09-11T09:00:00Z",
  from: filters.from,
  until: filters.until,
  group: "day",
  own: false,
  stations: [{ id: "s", name: "Roșiori" }],
  consumption: [],
  stock: [],
  warehouse: [],
  closed: [],
  pending: [],
  holders: [],
  vehicles: [],
};
it("validates real calendar dates, bounded intervals and UUID filters", () => {
  for (const q of [
    "from=2026-02-30",
    "from=2026-09-12&until=2026-09-11",
    "from=2025-01-01&until=2026-09-11",
    "group=__proto__",
    "holder=wrong",
    "scope=other",
    "own=true",
  ])
    expect(() => parseReportFilters(new URLSearchParams(q))).toThrow();
  expect(localDay(new Date("2026-09-10T21:05:00Z"))).toBe("2026-09-11");
  expect(parseReportFilters(new URLSearchParams(), new Date("2026-12-31T23:00:00Z"))).toMatchObject(
    { from: "2027-01-01", until: "2027-01-02" },
  );
});
it("CSV protects spreadsheet formula cells and retains quotes, newlines and exact quantities", () => {
  expect(csvCell('=HYPERLINK("evil")')).toBe('"\'=HYPERLINK(""evil"")"');
  expect(csvCell("\t+1")).toBe('"\'\t+1"');
  const r = structuredClone(report);
  r.consumption = [
    {
      substation_id: "s",
      station: "Roșiori",
      product_id: "p",
      product: 'Soluție, "A"\nsterilă',
      unit: "ml",
      bucket: "2026-09-11",
      label: null,
      consumed: "999999999999999.123",
    },
  ];
  expect(reportCsv(r, "consumption", filters)).toContain('"999999999999999.123"');
  expect(reportCsv(r, "consumption", filters)).toContain('"Soluție, ""A""\nsterilă"');
  expect(reportTable(r, "consumption").rows[0][4]).toBe("999999999999999.123");
});
it("aggregate PDFs preserve Romanian text, long cells and every row across pages", async () => {
  const r = structuredClone(report);
  r.warehouse = Array.from({ length: 80 }, (_, i) => ({
    substation_id: "s",
    station: "Roșiori",
    product_id: `p${i}`,
    product: `Material ${String(i).padStart(3, "0")} · ȘțĂâÎî ${i === 0 ? "Denumire lungă fără pierderea conținutului ".repeat(12) : "steril"}`,
    unit: "buc",
    opening: "0",
    received: "100.125",
    issued: "12.125",
    returned: "0",
    closing: "88",
  }));
  const bytes = await generateAggregatePdf(r, "warehouse", filters);
  await mkdir(".verification/pdfs", { recursive: true });
  await writeFile(".verification/pdfs/raport-m09.pdf", bytes);
  const task = getDocument({ data: bytes });
  const pdf = await task.promise;
  expect(pdf.numPages).toBeGreaterThan(2);
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    const items = content.items.filter((x) => "str" in x);
    const pageText = items.map((x) => x.str).join(" ");
    expect(pageText).toContain(`${i} / ${pdf.numPages}`);
    for (const item of items) {
      expect(item.transform[4]).toBeGreaterThanOrEqual(39);
      expect(item.transform[4] + item.width).toBeLessThanOrEqual(803);
      expect(item.transform[5]).toBeGreaterThanOrEqual(25);
    }
    text += pageText + " ";
  }
  for (let i = 0; i < 80; i++) expect(text).toContain(`Material ${String(i).padStart(3, "0")}`);
  expect(text).toContain("ȘțĂâÎî");
  expect(text).toContain("100.125");
  await task.destroy();
});
