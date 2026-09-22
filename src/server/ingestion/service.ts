import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '../db';
import { claims, documents, jobs } from '../db/schema';
import {
  type Actor,
  assert,
  audit,
  lockCompany,
  openPeriod,
  requireRole,
  currencies,
} from '../core';
import { inspectFile, imageFingerprint, sha256, storeOriginal } from './storage';
export async function uploadDocument(
  actor: Actor,
  file: { name: string; data: Buffer },
  input: {
    batchId?: string;
    claimId?: string;
    defaultPaymentTermDays?: number;
    uploadCurrency?: string;
    payslip?: boolean;
  },
) {
  if (!input.claimId) requireRole(actor, ['Admin', 'Finance']);
  assert(
    !input.payslip || !input.claimId,
    'Payslips must be uploaded as salary expenses, not claim receipts.',
  );
  const batchId = z.uuid().parse(input.batchId || randomUUID());
  const uploadCurrency = z.enum(currencies).parse(input.uploadCurrency || 'MYR');
  const defaultPaymentTermDays = z
    .number()
    .int()
    .min(0)
    .max(365)
    .optional()
    .parse(input.defaultPaymentTermDays);
  assert(
    !input.claimId || defaultPaymentTermDays === undefined,
    'Payment terms apply to invoice uploads only.',
  );
  if (input.claimId) z.uuid().parse(input.claimId);
  const db = await getDb();
  // Authorise before reading pixels or writing objects.
  if (input.claimId) {
    const [claim] = await db
      .select()
      .from(claims)
      .where(and(eq(claims.id, input.claimId), eq(claims.companyId, actor.companyId)));
    assert(claim, 'Claim not found.', 404);
    assert(
      claim.employeeId === actor.userId || ['Admin', 'Finance'].includes(actor.role),
      'This claim belongs to another employee.',
      403,
    );
    assert(
      ['Draft', 'Needs Review'].includes(claim.status),
      'Receipts cannot be added after submission.',
      409,
    );
  }
  const mime = inspectFile(file.data, file.name),
    hash = sha256(file.data),
    imageHash = await imageFingerprint(file.data, mime);
  const key = await storeOriginal(actor.companyId, file.data, mime);
  return db.transaction(async (tx) => {
    await lockCompany(tx, actor);
    if (input.claimId) {
      const [claim] = await tx
        .select()
        .from(claims)
        .where(and(eq(claims.id, input.claimId), eq(claims.companyId, actor.companyId)));
      assert(
        claim && ['Draft', 'Needs Review'].includes(claim.status),
        'Claim is no longer editable.',
        409,
      );
      await openPeriod(tx, actor.companyId, claim.month);
    }
    const count = await tx.execute(
      sql`SELECT count(*)::int AS count FROM documents WHERE company_id=${actor.companyId} AND batch_id=${batchId}`,
    );
    assert(Number(count.rows[0].count) < 200, 'A batch supports at most 200 files.');
    const [doc] = await tx
      .insert(documents)
      .values({
        companyId: actor.companyId,
        uploaderId: actor.userId,
        claimId: input.claimId,
        batchId,
        name: file.name.slice(0, 240),
        storageKey: key,
        mime,
        size: file.data.length,
        hash,
        imageHash,
        purpose: input.claimId ? 'claim' : input.payslip ? 'payslip' : 'invoice',
        defaultPaymentTermDays: input.payslip ? null : defaultPaymentTermDays,
        uploadCurrency,
      })
      .returning();
    await tx.insert(jobs).values({ companyId: actor.companyId, documentId: doc.id });
    await audit(tx, actor, doc.id, 'document.uploaded', null, {
      name: doc.name,
      hash,
      batchId,
      defaultPaymentTermDays,
      uploadCurrency,
    });
    return { id: doc.id, name: doc.name };
  });
}
