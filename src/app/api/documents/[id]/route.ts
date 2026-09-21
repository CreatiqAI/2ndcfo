import { NextResponse } from 'next/server';
import { failure, requestActor } from '@/server/http';
import { allowedDocuments } from '@/server/workspace';
import { assert } from '@/server/core';
import { readOriginal } from '@/server/ingestion/storage';
import { PDFDocument } from 'pdf-lib';
export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const url = new URL(request.url),
      actor = await requestActor(url.searchParams.get('company') || ''),
      { id } = await params;
    const doc = (await allowedDocuments(actor)).find((x) => x.id === id);
    assert(doc, 'Document not found.', 404);
    let data = await readOriginal(doc.storageKey);
    if (url.searchParams.has('start')) {
      assert(doc.mime === 'application/pdf', 'Page downloads require a PDF.');
      const start = Number(url.searchParams.get('start')),
        end = Number(url.searchParams.get('end'));
      const source = await PDFDocument.load(data);
      assert(
        Number.isInteger(start) &&
          Number.isInteger(end) &&
          start > 0 &&
          end >= start &&
          end <= source.getPageCount(),
        'Invalid page range.',
      );
      const out = await PDFDocument.create();
      const pages = await out.copyPages(
        source,
        Array.from({ length: end - start + 1 }, (_, i) => start + i - 1),
      );
      pages.forEach((p) => out.addPage(p));
      data = Buffer.from(await out.save());
    }
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': doc.mime,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
