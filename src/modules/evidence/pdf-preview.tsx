"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/primitives";

function PdfPages({ id, filename }: { id: string; filename: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [renderedPage, setRenderedPage] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let task: PDFDocumentLoadingTask | undefined;
    let disposed = false;
    async function load() {
      const pdfjs = await import("pdfjs-dist");
      if (disposed) return;
      const assets = `/pdfjs/${pdfjs.version}/`;
      pdfjs.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`;
      const response = await fetch(`/api/evidence/${id}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Dovada nu este accesibilă.");
      const bytes = await response.arrayBuffer();
      if (disposed) return;
      task = pdfjs.getDocument({
        data: new Uint8Array(bytes),
        cMapUrl: `${assets}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${assets}standard_fonts/`,
        wasmUrl: `${assets}wasm/`,
        enableXfa: false,
        maxImageSize: 20_000_000,
      });
      const loaded = await task.promise;
      if (!disposed) setDocument(loaded);
    }
    void load().catch(() => {
      if (!disposed)
        setError(
          "Previzualizarea nu a putut fi încărcată. Poți deschide dovada privată din linkul de mai sus.",
        );
    });
    return () => {
      disposed = true;
      controller.abort();
      void task?.destroy();
    };
  }, [id]);
  useEffect(() => {
    if (!document || !canvas.current) return;
    let disposed = false;
    let rendering: RenderTask | undefined;
    async function render() {
      const page = await document!.getPage(pageNumber);
      if (disposed || !canvas.current) return;
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(1.5, 1800 / Math.max(original.width, original.height)),
      });
      canvas.current.width = Math.ceil(viewport.width);
      canvas.current.height = Math.ceil(viewport.height);
      rendering = page.render({ canvas: canvas.current, viewport });
      await rendering.promise;
      if (!disposed) setRenderedPage(pageNumber);
    }
    void render().catch(() => {
      if (!disposed) setError("Pagina PDF nu poate fi afișată.");
    });
    return () => {
      disposed = true;
      rendering?.cancel();
    };
  }, [document, pageNumber]);
  return (
    <div className="pdf-preview">
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : (
        <>
          <p role="status">
            {renderedPage === pageNumber
              ? `Pagina ${pageNumber} din ${document?.numPages}`
              : "Se încarcă pagina PDF…"}
          </p>
          <canvas
            ref={canvas}
            role="img"
            aria-label={`PDF: ${filename} — pagina ${pageNumber}`}
            data-rendered={renderedPage === pageNumber ? "true" : "false"}
            style={{ visibility: renderedPage === pageNumber ? "visible" : "hidden" }}
          />
          {document && document.numPages > 1 && (
            <div className="station-links">
              <Button
                variant="secondary"
                disabled={pageNumber <= 1 || renderedPage !== pageNumber}
                onClick={() => setPageNumber((n) => n - 1)}
              >
                Pagina anterioară
              </Button>
              <Button
                variant="secondary"
                disabled={pageNumber >= document.numPages || renderedPage !== pageNumber}
                onClick={() => setPageNumber((n) => n + 1)}
              >
                Pagina următoare
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export function PdfPreview({ id, filename }: { id: string; filename: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Închide previzualizarea PDF" : "Previzualizare PDF"}
      </Button>
      {open && <PdfPages id={id} filename={filename} />}
    </div>
  );
}
