"use client";
/* eslint-disable @next/next/no-img-element -- Local preview and authenticated private images cannot use a public image optimizer. */
import { useRef, useState, type FormEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { MAX_FILE_MB, MAX_FILE_SIZE, FILE_SIZE_MESSAGE } from "./limits";

const confirmation =
  "Confirm cantitățile afișate în această versiune a ciornei declarației de închidere.";
export function EvidenceUpload({
  versionId,
  signature = false,
  signerName,
}: {
  versionId: string;
  signature?: boolean;
  signerName: string;
}) {
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<number | null>(null);
  const key = useRef<string>("");
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const changed = () => {
    key.current = "";
    setMessage("");
    setSuccess(false);
  };
  function reset() {
    canvas.current?.getContext("2d")?.clearRect(0, 0, 800, 280);
    pointer.current = null;
    setInk(false);
    changed();
  }
  function draw(event: PointerEvent<HTMLCanvasElement>, start = false) {
    if (busy || (!start && pointer.current !== event.pointerId)) return;
    const surface = canvas.current!;
    const rect = surface.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * surface.width) / rect.width;
    const y = ((event.clientY - rect.top) * surface.height) / rect.height;
    const context = surface.getContext("2d")!;
    if (start) {
      pointer.current = event.pointerId;
      surface.setPointerCapture(event.pointerId);
      context.beginPath();
      context.moveTo(x, y);
      changed();
    } else {
      context.lineWidth = 3;
      context.lineCap = "round";
      context.strokeStyle = "#17243e";
      context.lineTo(x, y);
      context.stroke();
      setInk(true);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(false);
    setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (signature) {
      if (!ink) {
        setMessage("Semnătura este goală. Desenează semnătura înainte de salvare.");
        return;
      }
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.current!.toBlob(resolve, "image/png"),
      );
      if (!blob) {
        setMessage("Semnătura nu a putut fi capturată.");
        return;
      }
      form.set("file", blob, "semnatura.png");
    }
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_FILE_SIZE) {
      setMessage(FILE_SIZE_MESSAGE);
      return;
    }
    form.set("version", versionId);
    form.set("kind", signature ? "signature" : "document");
    key.current ||= crypto.randomUUID();
    form.set("request_key", key.current);
    setBusy(true);
    try {
      const response = await fetch("/api/evidence", { method: "POST", body: form });
      const result = await response.json();
      setSuccess(Boolean(result.success));
      setMessage(result.message ?? "Încărcarea a eșuat.");
      if (result.success) {
        router.refresh();
      }
    } catch {
      setMessage("Conexiunea a fost întreruptă. Reîncearcă; aceeași dovadă nu se dublează.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="identity-form evidence-upload"
      onSubmit={submit}
      onChange={changed}
      aria-busy={busy}
    >
      <fieldset disabled={busy || success}>
        {signature ? (
          <>
            <p className="identity-note">
              Semnează cu degetul, stylusul sau mouse-ul. Semnatarul trebuie să verifice cantitățile
              de mai sus.
            </p>
            <label>
              Numele semnatarului
              <input
                name="signer"
                required
                minLength={2}
                maxLength={120}
                defaultValue={signerName}
              />
            </label>
            <canvas
              ref={canvas}
              width={800}
              height={280}
              className="signature-canvas"
              aria-label="Zonă pentru semnătură"
              onPointerDown={(e) => draw(e, true)}
              onPointerMove={(e) => draw(e)}
              onPointerUp={() => {
                pointer.current = null;
              }}
              onPointerCancel={() => {
                pointer.current = null;
              }}
            />
            <Button type="button" variant="secondary" onClick={reset}>
              Șterge și refă semnătura
            </Button>
            <label className="check-label">
              <input name="confirmed" type="checkbox" value="true" required />
              {confirmation}
            </label>
          </>
        ) : (
          <>
            <label>
              Document sau fotografie
              <input
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                required
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (preview) URL.revokeObjectURL(preview);
                  setPreview(
                    file && ["image/jpeg", "image/png"].includes(file.type)
                      ? URL.createObjectURL(file)
                      : null,
                  );
                }}
              />
            </label>
            <p className="identity-note">
              PDF, JPEG sau PNG · maximum {MAX_FILE_MB} MB/fișier · 5 documente per versiune. Pentru
              HEIC, exportă JPEG. Fotografii și documente fictive pentru demo.
            </p>
            {preview && (
              <img
                src={preview}
                className="evidence-preview"
                alt="Previzualizare fotografie selectată"
              />
            )}
          </>
        )}
      </fieldset>
      {message && (
        <p role={success ? "status" : "alert"} className={success ? "form-success" : "form-error"}>
          {message}
        </p>
      )}
      <Button type="submit" disabled={busy || success}>
        {busy ? "Se validează…" : signature ? "Salvează semnătura" : "Încarcă dovada"}
      </Button>
    </form>
  );
}
