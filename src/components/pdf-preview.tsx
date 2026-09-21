'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

export function PdfPreview({ data, name }: { data: Uint8Array; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof import('pdfjs-dist').getDocument> | undefined;
    setPdf(null);
    setPage(1);
    setError('');
    setLoading(true);
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
        task = pdfjs.getDocument({
          data: data.slice(),
          cMapUrl: '/pdfjs/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/pdfjs/standard_fonts/',
          wasmUrl: '/pdfjs/wasm/',
        });
        const doc = await task.promise;
        if (!cancelled) setPdf(doc);
      } catch (error) {
        console.warn(
          'PDF preview could not load',
          error instanceof Error ? error.message : String(error),
        );
        if (!cancelled) {
          setError('Unable to display this PDF. Please download the original.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [data]);
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const source = await pdf.getPage(page);
        if (cancelled || !canvasRef.current) return;
        const base = source.getViewport({ scale: 1 });
        const viewport = source.getViewport({
          scale: Math.min(2, 1600 / Math.max(base.width, base.height)),
        });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        task = source.render({ canvas, viewport });
        await task.promise;
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Unable to display this page. Please download the original.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page]);
  return (
    <div>
      {pdf && (
        <div className="pdf-preview-controls">
          <button
            type="button"
            className="button secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous page
          </button>
          <span aria-live="polite">
            Page {page} of {pdf.numPages}
          </span>
          <button
            type="button"
            className="button secondary"
            disabled={page >= pdf.numPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next page
          </button>
        </div>
      )}
      {loading && (
        <p className="document-preview-message" role="status">
          Rendering document…
        </p>
      )}
      {error && (
        <p className="document-preview-message" role="alert">
          {error}
        </p>
      )}
      <div className="pdf-preview-page" hidden={loading || !!error}>
        <canvas ref={canvasRef} role="img" aria-label={`${name}, page ${page}`} />
      </div>
    </div>
  );
}
