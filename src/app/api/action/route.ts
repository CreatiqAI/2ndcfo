import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { checkOrigin } from '@/server/auth';
import { addEmployee } from '@/server/employees';
import { createClaimLink } from '@/server/claim-links';
import { trashRecord } from '@/server/record-trash';
import { failure, requestActor, requestUser } from '@/server/http';
import { assignMember, createWorkspace, rejectSuggestion } from '@/server/workspace';
import { cancelInvoice, reviewInvoice, splitInvoice } from '@/server/invoices/service';
import { changeClaim, createClaim } from '@/server/claims/service';
import { confirmStatement, createBankAccount } from '@/server/banking/service';
import { categoriseBank, confirmAllocations } from '@/server/reconciliation/service';
import { processOne } from '@/server/extraction/worker';
import { getDb } from '@/server/db';
import { documents, jobs } from '@/server/db/schema';
import { allowedDocuments } from '@/server/workspace';
import { assert, audit, lockCompany, requireRole } from '@/server/core';
export const runtime = 'nodejs';
// One extraction per request; allow the 90-second provider timeout plus database/storage work.
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { action, companyId, ...input } = await request.json();
    if (action === 'workspace.create')
      return NextResponse.json(await createWorkspace((await requestUser()).id, input));
    const actor = await requestActor(companyId);
    let result: unknown;
    switch (action) {
      case 'claim.link':
        result = await createClaimLink(actor, input);
        break;
      case 'record.trash':
        result = await trashRecord(actor, input);
        break;
      case 'employee.create':
        result = await addEmployee(actor, input);
        break;
      case 'invoice.review':
        result = await reviewInvoice(actor, { ...input, action: input.operation });
        break;
      case 'invoice.split':
        result = await splitInvoice(actor, input);
        break;
      case 'invoice.cancel':
        result = await cancelInvoice(actor, input);
        break;
      case 'claim.create':
        result = await createClaim(actor, input);
        break;
      case 'claim.change':
        result = await changeClaim(actor, { ...input, action: input.operation });
        break;
      case 'account.create':
        result = await createBankAccount(actor, input);
        break;
      case 'statement.confirm':
        result = await confirmStatement(actor, { ...input, action: input.operation || 'import' });
        break;
      case 'allocation.confirm':
        result = await confirmAllocations(actor, input);
        break;
      case 'bank.categorise':
        result = await categoriseBank(actor, input);
        break;
      case 'suggestion.reject':
        result = await rejectSuggestion(actor, input);
        break;
      case 'member.assign':
        result = await assignMember(actor, input);
        break;
      case 'jobs.process':
        requireRole(actor, ['Admin', 'Finance', 'Manager', 'Employee']);
        result = { processed: await processOne(actor.companyId) };
        break;
      case 'jobs.retry': {
        requireRole(actor, ['Admin', 'Finance', 'Manager', 'Employee']);
        const id = z.uuid().parse(input.id),
          docs = await allowedDocuments(actor);
        result = await (
          await getDb()
        ).transaction(async (tx) => {
          await lockCompany(tx, actor);
          const [job] = await tx
            .select()
            .from(jobs)
            .where(and(eq(jobs.id, id), eq(jobs.companyId, actor.companyId)));
          assert(job && docs.some((d) => d.id === job.documentId), 'Job not found.', 404);
          assert(job.status === 'failed', 'Only failed extraction jobs can be retried.');
          await tx
            .update(jobs)
            .set({ status: 'queued', attempts: 0, error: null, leaseUntil: null })
            .where(eq(jobs.id, id));
          await audit(tx, actor, id, 'extraction.retried', job, { status: 'queued' });
          return { ok: true };
        });
        break;
      }
      default:
        throw new Error('Unknown action');
    }
    return NextResponse.json(result ?? { ok: true });
  } catch (e) {
    return failure(e);
  }
}
