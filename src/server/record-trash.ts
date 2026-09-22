import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from './db';
import { claims, invoices, recordTrash } from './db/schema';
import { type Actor, requireRole, lockCompany, assert, audit } from './core';

export async function trashRecord(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin', 'Finance']);
  const data = z
    .object({
      id: z.uuid(),
      type: z.enum(['invoice', 'claim']),
      deleted: z.boolean(),
      reason: z.string().trim().min(3).max(1000),
    })
    .parse(input);
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    const table = data.type === 'invoice' ? invoices : claims;
    const [record] = await tx
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, data.id), eq(table.companyId, actor.companyId)));
    assert(record, 'Record not found.', 404);
    const column = data.type === 'invoice' ? recordTrash.invoiceId : recordTrash.claimId;
    await tx
      .insert(recordTrash)
      .values({
        companyId: actor.companyId,
        [data.type === 'invoice' ? 'invoiceId' : 'claimId']: data.id,
        deleted: data.deleted,
      })
      .onConflictDoUpdate({ target: column, set: { deleted: data.deleted } });
    await audit(
      tx,
      actor,
      data.id,
      data.deleted ? 'record.trashed' : 'record.restored',
      null,
      { type: data.type },
      data.reason,
    );
    return { ok: true };
  });
}
