import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { documents, extractions, invoices, jobs } from '../db/schema';
import { assert, categories, currencies, minor, validDate } from '../core';
import { readOriginal } from '../ingestion/storage';
import { ExtractionFailure, provider } from './provider';
import { detectDuplicate } from '../duplicates/detector';
import { categorisationDecision } from '../categorisation/policy';
import { uploadPaymentTerms } from '../../lib/invoice-due-date';
export async function processOne(companyId?: string, claimId?: string): Promise<boolean> {
  const db = await getDb();
  const job = await db.transaction(async (tx) => {
    const scope = sql`${companyId ? sql`AND company_id=${companyId}` : sql``} ${claimId ? sql`AND document_id IN (SELECT id FROM documents WHERE claim_id=${claimId})` : sql``}`;
    await tx.execute(
      sql`UPDATE extraction_jobs SET status='failed', error='Worker lease expired after three attempts. Retry extraction.', lease_until=NULL WHERE status='processing' AND attempts>=3 AND lease_until<now() ${scope}`,
    );
    const found = await tx.execute(
      sql`SELECT id FROM extraction_jobs WHERE (status='queued' OR (status='processing' AND lease_until<now())) AND attempts<3 ${scope} ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`,
    );
    if (!found.rows.length) return null;
    const [item] = await tx
      .update(jobs)
      .set({
        status: 'processing',
        attempts: sql`${jobs.attempts}+1`,
        leaseUntil: new Date(Date.now() + 180000),
        error: null,
      })
      .where(eq(jobs.id, String(found.rows[0].id)))
      .returning();
    return item;
  });
  if (!job) return false;
  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, job.documentId));
    const chosen = provider(),
      result = await chosen.invoices(await readOriginal(doc.storageKey), doc.mime, doc.name);
    // Preserve provider evidence even when a later candidate/constraint transaction fails.
    await db.insert(extractions).values({
      companyId: doc.companyId,
      documentId: doc.id,
      provider: chosen.name,
      model: result.model,
      raw: result.raw,
    });
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM companies WHERE id=${doc.companyId} FOR UPDATE`);
      // Reclaimed workers cannot finalise a later lease's job.
      const [current] = await tx.select().from(jobs).where(eq(jobs.id, job.id));
      assert(
        current.status === 'processing' && current.attempts === job.attempts,
        'Extraction lease changed.',
      );
      const existing = await tx.select().from(invoices).where(eq(invoices.documentId, doc.id));
      if (!existing.length) {
        const others = await tx
          .select({ invoice: invoices, doc: documents })
          .from(invoices)
          .innerJoin(documents, eq(documents.id, invoices.documentId))
          .where(eq(invoices.companyId, doc.companyId));
        for (const item of result.parsed.documents) {
          const errors: string[] = [];
          const amount = (v: string | null) => {
            if (v === null) return null;
            try {
              const n = minor(v);
              if (n < 0) throw new Error();
              return n;
            } catch {
              errors.push('Invalid amount');
              return null;
            }
          };
          const date = (v: string | null) => {
            if (v === null) return null;
            if (validDate(v)) return v;
            errors.push('Invalid date');
            return null;
          };
          const total = amount(item.total),
            subtotal = amount(item.subtotal),
            tax = amount(item.tax);
          const currency = currencies.includes(item.currency as (typeof currencies)[number])
            ? item.currency
            : null;
          const duplicate = detectDuplicate(
            {
              number: item.number,
              party: item.party,
              date: item.invoiceDate,
              totalMinor: total,
              description: item.description,
              sourceHash: doc.hash,
              imageHash: doc.imageHash,
              pageStart: item.pageStart,
            },
            others.map((x) => ({
              id: x.invoice.id,
              number: x.invoice.number,
              party: x.invoice.party,
              date: x.invoice.invoiceDate,
              totalMinor: x.invoice.totalMinor,
              description: x.invoice.description,
              sourceHash: x.doc.hash,
              imageHash: x.doc.imageHash,
              pageStart: x.invoice.pageStart,
            })),
          );
          const category = categories.includes(item.category || '') ? item.category : null;
          const invoiceDate = date(item.invoiceDate),
            dueDate = date(item.dueDate);
          const incomplete =
            !total ||
            !item.party ||
            !currency ||
            !invoiceDate ||
            !category ||
            errors.length ||
            (subtotal !== null && tax !== null && subtotal + tax !== total);
          const decision = categorisationDecision({
            category,
            confidence: item.confidence,
            incomplete: !!incomplete,
            duplicate: !!duplicate,
          });
          const [created] = await tx
            .insert(invoices)
            .values({
              companyId: doc.companyId,
              documentId: doc.id,
              claimId: doc.claimId,
              pageStart: item.pageStart,
              pageEnd: item.pageEnd,
              kind: doc.claimId ? 'Claim Receipt' : item.kind,
              party: item.party,
              number: item.number,
              invoiceDate,
              dueDate,
              description: item.description,
              product: item.product,
              paymentTerms: uploadPaymentTerms(
                item,
                doc.claimId ? null : doc.defaultPaymentTermDays,
              ),
              bankReference: item.bankReference,
              subtotalMinor: subtotal,
              taxMinor: tax,
              totalMinor: total && total > 0 ? total : null,
              currency,
              category: decision.category,
              confidence: item.confidence,
              reviewStatus: decision.reviewStatus,
              duplicateOf: duplicate?.id,
              duplicateReason: duplicate?.reason || null,
            })
            .returning();
          others.push({ invoice: created, doc });
        }
      }
      await tx
        .update(jobs)
        .set({ status: 'complete', leaseUntil: null, error: null })
        .where(eq(jobs.id, job.id));
    });
  } catch (error) {
    if (error instanceof ExtractionFailure)
      await db.insert(extractions).values({
        companyId: job.companyId,
        documentId: job.documentId,
        provider: provider().name,
        model: error.model,
        raw: error.raw,
      });
    await db
      .update(jobs)
      .set({
        status: 'failed',
        leaseUntil: null,
        error: error instanceof Error ? error.message.slice(0, 500) : 'Extraction failed.',
      })
      .where(and(eq(jobs.id, job.id), eq(jobs.attempts, job.attempts)));
  }
  return true;
}
