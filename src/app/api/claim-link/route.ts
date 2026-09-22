import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { checkOrigin } from '@/server/auth';
import { failure } from '@/server/http';
import { claimLinkContext, claimPortalState, redeemClaimLink } from '@/server/claim-links';
import { uploadDocument } from '@/server/ingestion/service';
import { processOne } from '@/server/extraction/worker';
import { changeClaim } from '@/server/claims/service';
import { getDb } from '@/server/db';
import { claims, claimLinks } from '@/server/db/schema';
import { tokenHash } from '@/server/auth';
import { assert, audit, lockCompany, openPeriod } from '@/server/core';
export const runtime = 'nodejs';
export const maxDuration = 120;
const cookieName = 'claim_portal';
export async function GET() {
  try {
    return NextResponse.json(await claimPortalState((await cookies()).get(cookieName)?.value), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const jar = await cookies();
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const { actor, claim } = await claimLinkContext(jar.get(cookieName)?.value);
      assert(
        Number(request.headers.get('content-length') || 0) <= 21 * 1024 * 1024,
        'Upload exceeds 20 MB.',
        413,
      );
      const form = await request.formData(),
        file = form.get('file');
      assert(
        file instanceof File && file.size <= 20 * 1024 * 1024,
        'Choose a receipt up to 20 MB.',
      );
      await uploadDocument(
        actor,
        { name: file.name, data: Buffer.from(await file.arrayBuffer()) },
        { claimId: claim.id },
      );
      return NextResponse.json({ ok: true });
    }
    const input = await request.json();
    if (input.action === 'redeem') {
      const session = await redeemClaimLink(z.string().parse(input.token));
      jar.set(cookieName, session, {
        httpOnly: true,
        secure: process.env.APP_ORIGIN?.startsWith('https:'),
        sameSite: 'strict',
        path: '/api/claim-link',
        maxAge: 86400,
      });
      return NextResponse.json({ ok: true });
    }
    const { actor, claim } = await claimLinkContext(jar.get(cookieName)?.value);
    assert(
      ['Draft', 'Needs Review'].includes(claim.status),
      'This claim has already been submitted.',
      409,
    );
    if (input.action === 'process') await processOne(claim.companyId, claim.id);
    else if (input.action === 'submit') {
      await changeClaim(actor, { id: claim.id, action: 'submit' });
      await (
        await getDb()
      )
        .update(claimLinks)
        .set({ sessionExpiresAt: new Date() })
        .where(eq(claimLinks.sessionHash, tokenHash(jar.get(cookieName)!.value)));
      jar.set(cookieName, '', { httpOnly: true, path: '/api/claim-link', maxAge: 0 });
    } else if (input.action === 'details') {
      const title = z.string().trim().min(2).max(160).parse(input.title);
      await (
        await getDb()
      ).transaction(async (tx) => {
        await lockCompany(tx, actor);
        const [current] = await tx.select().from(claims).where(eq(claims.id, claim.id));
        assert(['Draft', 'Needs Review'].includes(current.status), 'Claim is locked.', 409);
        await openPeriod(tx, actor.companyId, current.month);
        await tx.update(claims).set({ title }).where(eq(claims.id, claim.id));
        await audit(
          tx,
          actor,
          claim.id,
          'claim.portal_details',
          { title: current.title },
          { title },
        );
      });
    } else assert(false, 'Unsupported claim operation.');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
