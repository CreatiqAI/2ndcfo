import { NextResponse } from 'next/server';
import { failure, requestActor } from '@/server/http';
import { snapshot } from '@/server/workspace';
import { assert, decimal } from '@/server/core';
function cell(value: unknown) {
  let str = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  return '"' + str.replaceAll('"', '""') + '"';
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      actor = await requestActor(url.searchParams.get('company') || ''),
      state = await snapshot(actor),
      kind = url.searchParams.get('kind');
    let rows: unknown[][] = [];
    if (kind === 'claims')
      rows = [
        ['Claim', 'Employee', 'Month', 'Claimed', 'Receipts', 'Difference', 'Currency', 'Status'],
        ...state.claims.map((c) => [
          c.title,
          c.employeeName,
          c.month,
          decimal(c.claimedMinor),
          decimal(c.receiptTotal),
          decimal(c.difference),
          c.currency,
          c.paymentStatus,
        ]),
      ];
    else if (kind === 'reconciliation') {
      assert(['Admin', 'Finance', 'Accountant'].includes(actor.role), 'Not authorised.', 403);
      rows = [
        [
          'Date',
          'Description',
          'Reference',
          'Direction',
          'Amount',
          'Allocated',
          'Currency',
          'Status',
        ],
        ...state.bank.map((b) => [
          b.date,
          b.description,
          b.reference,
          b.direction,
          decimal(b.amountMinor),
          decimal(b.allocatedMinor),
          b.currency,
          b.status,
        ]),
      ];
    } else {
      assert(['Admin', 'Finance', 'Accountant'].includes(actor.role), 'Not authorised.', 403);
      rows = [
        [
          'Date',
          'Type',
          'Party',
          'Number',
          'Description',
          'Category',
          'Amount',
          'Currency',
          'Paid',
          'Outstanding',
          'Payment status',
          'Bank match',
          'Approved by',
          'Document ID',
        ],
        ...state.invoices
          .filter((i) => !i.claimId && (kind !== 'transactions' || i.reviewStatus === 'Approved'))
          .map((i) => [
            i.invoiceDate,
            i.kind,
            i.party,
            i.number,
            i.description,
            i.category,
            decimal(i.totalMinor),
            i.currency,
            decimal(i.paidMinor),
            decimal(i.outstandingMinor),
            i.paymentStatus,
            i.bankMatch,
            i.approvedBy,
            i.documentId,
          ]),
      ];
    }
    return new NextResponse('\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="finance-export.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
