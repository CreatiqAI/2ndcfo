import { randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb } from './db';
import { claimLinks, claims, users, recordTrash, documents, invoices, jobs } from './db/schema';
import { type Actor, assert, requireRole, audit, lockCompany } from './core';
import { tokenHash, actorFor } from './auth';
import { createClaim, claimSummary } from './claims/service';

export async function createClaimLink(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin', 'Finance']);
  const claim = await createClaim(actor, { ...(input as object), claimed: '0', autoTotal: true });
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await (
    await getDb()
  ).transaction(async (tx) => {
    await lockCompany(tx, actor);
    await tx
      .insert(claimLinks)
      .values({
        companyId: actor.companyId,
        claimId: claim.id,
        createdBy: actor.userId,
        tokenHash: tokenHash(token),
        expiresAt,
      });
    await audit(tx, actor, claim.id, 'claim.link_created', null, { expiresAt });
  });
  return { token, claimId: claim.id, expiresAt };
}

export async function redeemClaimLink(token: string) {
  assert(/^[A-Za-z0-9_-]{43}$/.test(token), 'Invalid claim link.', 403);
  const session = randomBytes(32).toString('base64url');
  const [link] = await (
    await getDb()
  )
    .update(claimLinks)
    .set({
      redeemedAt: new Date(),
      sessionHash: tokenHash(session),
      sessionExpiresAt: new Date(Date.now() + 86400000),
    })
    .where(
      and(
        eq(claimLinks.tokenHash, tokenHash(token)),
        isNull(claimLinks.redeemedAt),
        gt(claimLinks.expiresAt, new Date()),
      ),
    )
    .returning({ id: claimLinks.id });
  assert(link, 'This link has expired or has already been used. Ask for a new link.', 403);
  return session;
}

export async function claimLinkContext(session?: string) {
  assert(
    session && /^[A-Za-z0-9_-]{43}$/.test(session),
    'Open your employee claim link first.',
    401,
  );
  const db = await getDb();
  const [link] = await db
    .select()
    .from(claimLinks)
    .where(
      and(
        eq(claimLinks.sessionHash, tokenHash(session)),
        gt(claimLinks.sessionExpiresAt, new Date()),
      ),
    );
  assert(link, 'Your claim session expired. Ask for a new link.', 401);
  const [claim] = await db
    .select()
    .from(claims)
    .where(and(eq(claims.id, link.claimId), eq(claims.companyId, link.companyId)));
  assert(claim, 'Claim not found.', 404);
  const [trashed] = await db
    .select()
    .from(recordTrash)
    .where(and(eq(recordTrash.claimId, claim.id), eq(recordTrash.deleted, true)));
  assert(!trashed, 'This claim has been deleted. Contact your finance team.', 403);
  const member = await actorFor(claim.employeeId, claim.companyId);
  // The dedicated endpoint exposes only employee operations for this one claim.
  const [employee] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, claim.employeeId));
  return { actor: member, claim, employee };
}

export async function claimPortalState(session?: string) {
  const { claim, employee } = await claimLinkContext(session);
  const db = await getDb();
  const receipts = await db.select().from(invoices).where(eq(invoices.claimId, claim.id));
  const files = await db
    .select({ id: documents.id, name: documents.name, status: jobs.status })
    .from(documents)
    .leftJoin(jobs, eq(jobs.documentId, documents.id))
    .where(eq(documents.claimId, claim.id));
  const summary = claimSummary(claim, receipts);
  return {
    id: claim.id,
    title: claim.title,
    month: claim.month,
    currency: claim.currency,
    status: claim.status,
    employee: employee.name,
    total: summary.effectiveClaimedMinor,
    needsReview: summary.needsReview,
    files,
    receipts: receipts.map((r) => ({
      id: r.id,
      party: r.party,
      totalMinor: r.totalMinor,
      currency: r.currency,
      invoiceDate: r.invoiceDate,
    })),
  };
}
