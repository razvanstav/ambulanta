import { createHash } from "node:crypto";
import sharp from "sharp";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const CONFIRMATION =
  "Confirm cantitățile afișate în această versiune a ciornei declarației de închidere.";

export async function validateEvidence(
  bytes: Buffer,
  filename: string,
  mime: string,
  signature = false,
) {
  if (!bytes.length || bytes.length > MAX_FILE_SIZE)
    throw new Error("Fișierul trebuie să aibă între 1 octet și 10 MB.");
  if (signature && mime !== "image/png") throw new Error("Semnătura trebuie să fie PNG.");
  const ext = filename.toLowerCase().split(".").pop();
  if (
    !(mime === "application/pdf" && ext === "pdf") &&
    !(mime === "image/jpeg" && ["jpg", "jpeg"].includes(ext ?? "")) &&
    !(mime === "image/png" && ext === "png")
  )
    throw new Error(
      "Acceptăm PDF, JPEG și PNG. Convertește fotografiile HEIC înainte de încărcare.",
    );
  let stored = bytes;
  if (mime === "application/pdf") {
    if (
      bytes.subarray(0, 5).toString() !== "%PDF-" ||
      !bytes.subarray(-1024).includes(Buffer.from("%%EOF"))
    )
      throw new Error("PDF incomplet sau nevalid.");
    let pdf;
    try {
      pdf = await PDFDocument.load(bytes, { throwOnInvalidObject: true, updateMetadata: false });
    } catch {
      throw new Error("PDF nevalid sau protejat cu parolă. Exportă un PDF simplu.");
    }
    if (!pdf.getPageCount() || pdf.getPageCount() > 100)
      throw new Error("PDF-ul trebuie să conțină între 1 și 100 de pagini.");
    // Walk parsed dictionaries, including compressed objects; do not trust a text-only scan.
    const seen = new Set<unknown>();
    const inspect = (object: unknown) => {
      if (!object || seen.has(object)) return;
      seen.add(object);
      if (object instanceof PDFRawStream) inspect(object.dict);
      if (object instanceof PDFArray)
        for (let i = 0; i < object.size(); i++) inspect(object.get(i));
      if (
        object instanceof PDFName &&
        [
          "JavaScript",
          "JS",
          "Launch",
          "EmbeddedFile",
          "RichMedia",
          "XFA",
          "SubmitForm",
          "ImportData",
          "GoToR",
          "URI",
        ].includes(object.decodeText())
      )
        throw new Error(
          "PDF-ul conține acțiuni sau fișiere încorporate. Exportă o copie simplă pentru dovadă.",
        );
      if (object instanceof PDFDict)
        for (const [key, value] of object.entries()) {
          if (["OpenAction", "AA", "AcroForm", "EmbeddedFiles"].includes(key.decodeText()))
            throw new Error(
              "PDF-ul conține formulare sau acțiuni. Exportă o copie simplă pentru dovadă.",
            );
          inspect(key);
          inspect(value);
        }
    };
    for (const [, object] of pdf.context.enumerateIndirectObjects()) inspect(object);
  } else {
    const metadata = await sharp(bytes, { limitInputPixels: 20_000_000, failOn: "warning" })
      .metadata()
      .catch(() => null);
    if (
      !metadata ||
      metadata.format !== (mime === "image/png" ? "png" : "jpeg") ||
      (metadata.pages ?? 1) !== 1
    )
      throw new Error("Imagine nevalidă. Folosește o fotografie JPEG sau PNG simplă.");
    if (signature) {
      if ((metadata.width ?? 0) > 2000 || (metadata.height ?? 0) > 1000)
        throw new Error("Dimensiuni nevalide pentru semnătură.");
      const { data, info } = await sharp(bytes)
        .flatten({ background: "white" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let ink = 0,
        minX = info.width,
        maxX = 0,
        minY = info.height,
        maxY = 0;
      for (let y = 0; y < info.height; y++)
        for (let x = 0; x < info.width; x++) {
          const i = (y * info.width + x) * info.channels;
          if (data[i] < 180 && data[i + 1] < 180 && data[i + 2] < 180) {
            ink++;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      if (ink < 40 || maxX - minX < 15 || maxY - minY < 5 || ink > info.width * info.height * 0.65)
        throw new Error("Semnătura este goală sau insuficient desenată. Semnează din nou.");
    }
    // Fully decode and re-encode: reject truncated images and discard EXIF/private metadata.
    const pipeline = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "warning" }).rotate();
    stored = await (
      mime === "image/png" ? pipeline.png() : pipeline.jpeg({ quality: 90 })
    ).toBuffer();
  }
  if (stored.length > MAX_FILE_SIZE) throw new Error("Fișierul procesat depășește 10 MB.");
  return { bytes: stored, hash: createHash("sha256").update(stored).digest("hex") };
}
