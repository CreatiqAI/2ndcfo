import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db';
import { bankAccounts, bankTransactions, documents, extractions, statements } from '../db/schema';
import {
  type Actor,
  assert,
  audit,
  currencies,
  lockCompany,
  openPeriod,
  requireRole,
} from '../core';
import { inspectFile, sha256, storeOriginal } from '../ingestion/storage';
import { bankDraftSchema, ExtractionFailure, provider } from '../extraction/provider';
import { parseStructured, validateStatement } from './parser';
export async function createBankAccount(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin', 'Finance']);
  const data = z
    .object({ name: z.string().trim().min(2).max(100), currency: z.enum(currencies) })
    .parse(input);
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    const [row] = await tx
      .insert(bankAccounts)
      .values({ companyId: actor.companyId, ...data })
      .returning();
    await audit(tx, actor, row.id, 'bank_account.created', null, row);
    return row;
  });
}
export async function uploadStatement(
  actor: Actor,
  file: { name: string; data: Buffer },
  input: unknown,
) {
  requireRole(actor, ['Admin', 'Finance']);
  const { accountId, month } = z
    .object({ accountId: z.uuid(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
    .parse(input);
  const db = await getDb(),
    [account] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, accountId), eq(bankAccounts.companyId, actor.companyId)));
  assert(account, 'Bank account not found.', 404);
  const mime = inspectFile(file.data, file.name, true),
    hash = sha256(file.data),
    storageKey = await storeOriginal(actor.companyId, file.data, mime);
  let draft: ReturnType<typeof bankDraftSchema.parse>,
    raw: unknown,
    providerName = 'structured-parser',
    model: string | null = null;
  try {
    if (mime === 'application/pdf') {
      const p = provider(),
        result = await p.statement(file.data, file.name);
      draft = result.parsed;
      raw = result.raw;
      providerName = p.name;
      model = result.model;
    } else {
      draft = await parseStructured(file.data, mime);
      raw = draft;
    }
  } catch (error) {
    draft = {
      opening: null,
      closing: null,
      rows: [],
      notes: error instanceof Error ? error.message : 'Parsing failed.',
    };
    raw = error instanceof ExtractionFailure ? error.raw : { error: draft.notes };
    if (error instanceof ExtractionFailure) {
      providerName = provider().name;
      model = error.model;
    }
  }
  return db.transaction(async (tx) => {
    await lockCompany(tx, actor);
    await openPeriod(tx, actor.companyId, month);
    const [prior] = await tx
      .select({ id: statements.id })
      .from(statements)
      .innerJoin(documents, eq(documents.id, statements.documentId))
      .where(
        and(
          eq(statements.companyId, actor.companyId),
          eq(statements.accountId, accountId),
          eq(documents.hash, hash),
        ),
      );
    assert(
      !prior,
      'This statement file was already uploaded for this account. Review the existing import.',
      409,
    );
    const [doc] = await tx
      .insert(documents)
      .values({
        companyId: actor.companyId,
        uploaderId: actor.userId,
        batchId: randomUUID(),
        name: file.name.slice(0, 240),
        storageKey,
        mime,
        size: file.data.length,
        hash,
        purpose: 'statement',
      })
      .returning();
    await tx.insert(extractions).values({
      companyId: actor.companyId,
      documentId: doc.id,
      provider: providerName,
      model,
      raw,
    });
    const [statement] = await tx
      .insert(statements)
      .values({ companyId: actor.companyId, accountId, documentId: doc.id, month, draft })
      .returning();
    await audit(tx, actor, statement.id, 'statement.uploaded', null, {
      documentId: doc.id,
      accountId,
      month,
      hash,
    });
    return statement;
  });
}
export async function confirmStatement(actor: Actor, input: unknown) {
  requireRole(actor, ['Admin', 'Finance']);
  const data = z
    .object({
      id: z.uuid(),
      draft: bankDraftSchema,
      reason: z.string().trim().min(3).max(1000),
      allowDuplicates: z.boolean().default(false),
      action: z.enum(['save', 'import']).default('import'),
    })
    .parse(input);
  return (await getDb()).transaction(async (tx) => {
    await lockCompany(tx, actor);
    const [statement] = await tx
      .select()
      .from(statements)
      .where(and(eq(statements.id, data.id), eq(statements.companyId, actor.companyId)));
    assert(statement, 'Statement not found.', 404);
    assert(statement.status === 'Needs Review', 'This statement has already been finalised.', 409);
    await openPeriod(tx, actor.companyId, statement.month);
    const parsed = validateStatement(data.draft, statement.month);
    if (data.action === 'save') {
      await tx.update(statements).set({ draft: data.draft }).where(eq(statements.id, statement.id));
      await audit(
        tx,
        actor,
        statement.id,
        'statement.corrected',
        statement.draft,
        data.draft,
        data.reason,
      );
      return { saved: true };
    }
    assert(!parsed.errors.length, parsed.errors.slice(0, 5).join('; '));
    const [account] = await tx
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, statement.accountId));
    const existing = await tx
      .select()
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.companyId, actor.companyId),
          eq(bankTransactions.accountId, account.id),
        ),
      );
    const seen = new Set(existing.map((x) => x.fingerprint));
    for (const row of parsed.rows) {
      const fingerprint = sha256(
        [
          account.id,
          row.date,
          row.reference.toLowerCase(),
          row.description.toLowerCase(),
          row.direction,
          row.amountMinor,
          account.currency,
        ].join('|'),
      );
      if (seen.has(fingerprint))
        assert(
          data.allowDuplicates && data.reason.length >= 10,
          'Potential duplicate bank row found. Verify the repeated transaction and explicitly acknowledge it.',
        );
      seen.add(fingerprint);
      await tx.insert(bankTransactions).values({
        companyId: actor.companyId,
        accountId: account.id,
        statementId: statement.id,
        ...row,
        currency: account.currency,
        fingerprint,
      });
    }
    await tx
      .update(statements)
      .set({
        status: 'Imported',
        draft: data.draft,
        openingMinor: parsed.openingMinor,
        closingMinor: parsed.closingMinor,
      })
      .where(eq(statements.id, statement.id));
    await audit(
      tx,
      actor,
      statement.id,
      'statement.imported',
      statement.draft,
      { draft: data.draft, count: parsed.rows.length, allowDuplicates: data.allowDuplicates },
      data.reason,
    );
    return { imported: parsed.rows.length };
  });
}
