import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { validateEvidence, MAX_FILE_SIZE } from "./validation";

describe("validarea reală a dovezilor", () => {
  it("refuză fișiere goale, prea mari, extensii false și formate incompatibile", async () => {
    for (const bytes of [Buffer.alloc(0), Buffer.alloc(MAX_FILE_SIZE + 1)])
      await expect(validateEvidence(bytes, "x.pdf", "application/pdf")).rejects.toThrow();
    await expect(
      validateEvidence(Buffer.from("html"), "x.pdf", "application/pdf"),
    ).rejects.toThrow();
    await expect(validateEvidence(Buffer.from("x"), "x.heic", "image/heic")).rejects.toThrow(
      /HEIC/,
    );
    await expect(validateEvidence(Buffer.from("x"), "x.jpg", "image/png")).rejects.toThrow();
  });
  it("decodează imaginile și elimină metadatele", async () => {
    const jpg = await sharp({ create: { width: 40, height: 40, channels: 3, background: "red" } })
      .withExif({ IFD0: { Copyright: "test" } })
      .jpeg()
      .toBuffer();
    const checked = await validateEvidence(jpg, "foto.jpg", "image/jpeg");
    expect((await sharp(checked.bytes).metadata()).exif).toBeUndefined();
    expect(checked.hash).toMatch(/^[a-f0-9]{64}$/);
    await expect(
      validateEvidence(jpg.subarray(0, jpg.length / 2), "foto.jpg", "image/jpeg"),
    ).rejects.toThrow();
    await expect(validateEvidence(jpg, "foto.png", "image/png")).rejects.toThrow();
  });
  it("refuză semnăturile albe, transparente și punctele; acceptă un traseu", async () => {
    for (const background of ["white", { r: 0, g: 0, b: 0, alpha: 0 }]) {
      const blank = await sharp({ create: { width: 800, height: 280, channels: 4, background } })
        .png()
        .toBuffer();
      await expect(validateEvidence(blank, "semnatura.png", "image/png", true)).rejects.toThrow(
        /goală/,
      );
    }
    const pixels = Buffer.alloc(800 * 280 * 3, 255);
    for (let x = 40; x < 200; x++)
      for (let d = 0; d < 3; d++) {
        const y = 50 + Math.floor(Math.sin(x / 15) * 20) + d;
        pixels.fill(20, (y * 800 + x) * 3, (y * 800 + x) * 3 + 3);
      }
    const drawn = await sharp(pixels, { raw: { width: 800, height: 280, channels: 3 } })
      .png()
      .toBuffer();
    expect((await validateEvidence(drawn, "semnatura.png", "image/png", true)).hash).toHaveLength(
      64,
    );
  });
  it("parsează PDF-ul și refuză JavaScript chiar în obiecte comprimate", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = Buffer.from(await pdf.save());
    expect((await validateEvidence(bytes, "doc.pdf", "application/pdf")).bytes).toEqual(bytes);
    pdf.catalog.set(
      PDFName.of("OpenAction"),
      pdf.context.obj({ S: PDFName.of("JavaScript"), JS: PDFString.of("app.alert('test')") }),
    );
    await expect(
      validateEvidence(Buffer.from(await pdf.save()), "doc.pdf", "application/pdf"),
    ).rejects.toThrow(/acțiuni/);
  });
});
