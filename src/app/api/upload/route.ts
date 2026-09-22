import { NextResponse } from 'next/server';
import { checkOrigin } from '@/server/auth';
import { assert } from '@/server/core';
import { failure, requestActor } from '@/server/http';
import { uploadDocument } from '@/server/ingestion/service';
import { uploadStatement } from '@/server/banking/service';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    assert(
      Number(request.headers.get('content-length') || 0) <= 21 * 1024 * 1024,
      'Upload exceeds 20 MB.',
      413,
    );
    const url = new URL(request.url),
      actor = await requestActor(url.searchParams.get('company') || '');
    const body = await request.formData(),
      file = body.get('file');
    assert(file instanceof File, 'Select a file.');
    assert(file.size <= 20 * 1024 * 1024, 'File exceeds 20 MB.', 413);
    const input = { name: file.name, data: Buffer.from(await file.arrayBuffer()) };
    const result =
      body.get('purpose') === 'statement'
        ? await uploadStatement(actor, input, {
            accountId: body.get('accountId'),
            month: body.get('month'),
          })
        : await uploadDocument(actor, input, {
            batchId: String(body.get('batchId') || ''),
            claimId: body.get('claimId') ? String(body.get('claimId')) : undefined,
            uploadCurrency: String(body.get('uploadCurrency') || 'MYR'),
            defaultPaymentTermDays: body.get('defaultPaymentTermDays')
              ? Number(body.get('defaultPaymentTermDays'))
              : undefined,
          });
    return NextResponse.json(result);
  } catch (e) {
    return failure(e);
  }
}
