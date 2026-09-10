import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/identity/policy";
import { createEvidenceStorageClient } from "@/modules/evidence/storage-server";
import { MAX_FILE_SIZE, validateEvidence } from "@/modules/evidence/validation";
import { hasSameOrigin } from "@/modules/evidence/request-origin";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const fail = (message: string, status = 400) => NextResponse.json({ message }, { status });
  // Next's internal URL can use localhost behind a proxy; compare the actual HTTP host.
  if (!hasSameOrigin(request.headers.get("origin"), request.headers.get("host")))
    return fail("Origine nepermisă.", 403);
  if (Number(request.headers.get("content-length")) > MAX_FILE_SIZE + 100_000)
    return fail("Fișier prea mare: maximum 10 MB.", 413);
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return fail("Autentificarea este necesară.", 401);
  let form: FormData;
  try {
    // Bound chunked requests too; Content-Length is not trusted as the sole limit.
    const reader = request.body?.getReader();
    if (!reader) return fail("Încărcare incompletă.");
    const chunks: Buffer[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_FILE_SIZE + 100_000) {
        await reader.cancel();
        return fail("Fișier prea mare: maximum 10 MB.", 413);
      }
      chunks.push(Buffer.from(part.value));
    }
    form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return fail("Încărcare incompletă.");
  }
  const file = form.get("file");
  const version = String(form.get("version") ?? "");
  const key = String(form.get("request_key") ?? "");
  const kind = String(form.get("kind") ?? "document");
  if (
    !(file instanceof File) ||
    !isUuid(version) ||
    !isUuid(key) ||
    !["document", "signature"].includes(kind)
  )
    return fail("Dovadă nevalidă.");
  if (!file.size || file.size > MAX_FILE_SIZE)
    return fail("Fișierul trebuie să aibă între 1 octet și 10 MB.", 413);
  const { data: draft } = await client
    .from("closeout_versions")
    .select("id")
    .eq("id", version)
    .maybeSingle();
  if (!draft) return fail("Versiunea nu este accesibilă.", 404);
  let validated;
  try {
    validated = await validateEvidence(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      file.type,
      kind === "signature",
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Fișier nevalid.");
  }
  try {
    const storage = createEvidenceStorageClient();
    const filename = file.name.replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 150) || "dovada";
    const { data: evidence, error } = await storage.rpc("reserve_validated_evidence", {
      p_actor: user.id,
      p_version: version,
      p_key: key,
      p_kind: kind,
      p_filename: filename,
      p_mime: file.type,
      p_size: validated.bytes.length,
      p_hash: validated.hash,
      p_signer: String(form.get("signer") ?? ""),
      p_confirm: form.get("confirmed") === "true",
    });
    if (error || !evidence)
      return fail(
        "Dovada nu poate fi salvată. Verifică versiunea, drepturile, numele semnatarului și limita de 5 documente / o semnătură.",
        409,
      );
    if (evidence.state !== "validated") {
      const bucket = storage.storage.from("shift-evidence");
      const upload = await bucket.upload(evidence.object_path, validated.bytes, {
        contentType: file.type,
        upsert: false,
      });
      if (upload.error) {
        // A timeout may have stored the object. Retry only after verifying the exact bytes.
        const previous = await bucket.download(evidence.object_path);
        if (
          !previous.data ||
          createHash("sha256")
            .update(Buffer.from(await previous.data.arrayBuffer()))
            .digest("hex") !== validated.hash
        )
          return fail(
            "Încărcarea a eșuat. Reîncearcă aceeași dovadă sau elimină încărcarea incompletă.",
            503,
          );
      }
    }
    const completed = await storage.rpc("finalize_validated_evidence", {
      p_actor: user.id,
      p_evidence: evidence.id,
    });
    if (completed.error)
      return fail(
        "Versiunea sau drepturile s-au schimbat. Dovada nu a fost validată; reîncarcă pagina.",
        409,
      );
    return NextResponse.json({
      success: true,
      message: "Dovada a fost validată și salvată privat.",
      id: evidence.id,
    });
  } catch {
    return fail("Serviciul de dovezi nu este disponibil. Verifică configurarea serverului.", 503);
  }
}
