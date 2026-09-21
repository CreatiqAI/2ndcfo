import { randomUUID } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getDb } from './db';
import {
  allocations,
  bankAccounts,
  bankTransactions,
  documents,
  extractions,
  invoices,
  statements,
} from './db/schema';
import { type Actor, audit, lockCompany } from './core';
import { sha256, storeOriginal } from './ingestion/storage';
export async function seedDemo(actor: Actor) {
  const month = new Date().toISOString().slice(0, 7);
  const fixtures = [
    {
      party: 'Meta Platforms',
      number: 'META-0921',
      total: 483220,
      category: 'Advertising',
      day: '04',
      sales: false,
      approved: true,
      paid: 483220,
    },
    {
      party: 'Amazon Web Services',
      number: 'AWS-8821',
      total: 128800,
      category: 'Cloud / API',
      day: '05',
      sales: false,
      approved: true,
      paid: 0,
    },
    {
      party: 'Canva',
      number: 'CNV-3102',
      total: 45000,
      category: 'Software',
      day: '07',
      sales: false,
      approved: true,
      paid: 0,
    },
    {
      party: 'Northstar Studio',
      number: 'INV-2026-041',
      total: 1000000,
      category: 'Project Revenue',
      day: '03',
      sales: true,
      approved: true,
      paid: 400000,
    },
    {
      party: 'Autolab',
      number: 'INV-2026-042',
      total: 1500000,
      category: 'Custom Development',
      day: '08',
      sales: true,
      approved: true,
      paid: 0,
    },
    {
      party: 'Google Workspace',
      number: 'GWS-901',
      total: 68800,
      category: 'Software',
      day: '10',
      sales: false,
      approved: false,
      paid: 0,
    },
    {
      party: 'Atlas Office',
      number: 'ATL-328',
      total: 820000,
      category: 'Office',
      day: '12',
      sales: false,
      approved: false,
      paid: 0,
    },
    {
      party: 'Meta Platforms',
      number: 'META-0921',
      total: 483220,
      category: 'Advertising',
      day: '04',
      sales: false,
      approved: false,
      paid: 0,
    },
    {
      party: 'Brightside Consulting',
      number: 'INV-2026-043',
      total: 600000,
      category: 'Consultation',
      day: '15',
      sales: true,
      approved: true,
      paid: 0,
    },
  ];
  const objects: { data: Buffer; key: string }[] = [];
  for (const f of fixtures) {
    const pdf = await PDFDocument.create(),
      page = pdf.addPage([595, 842]),
      font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = [
      'DEMO DOCUMENT - not a real financial record',
      f.party,
      f.number,
      `Date: ${month}-${f.day}`,
      `Currency: MYR`,
      `Total: ${(f.total / 100).toFixed(2)}`,
      `Category: ${f.category}`,
    ];
    lines.forEach((line, i) =>
      page.drawText(line, {
        x: 50,
        y: 770 - i * 40,
        size: i === 0 ? 12 : 18,
        font,
        color: rgb(0.1, 0.2, 0.3),
      }),
    );
    const data = Buffer.from(await pdf.save());
    objects.push({ data, key: await storeOriginal(actor.companyId, data, 'application/pdf') });
  }
  const bankCsv = `date,description,reference,money_in,money_out,balance\n${month}-04,Meta Platforms,META-0921,0,4832.20,195167.80\n${month}-05,Northstar Studio,INV-2026-041,4000,0,199167.80\n${month}-06,Amazon Web Services,AWS-8821,0,1288,197879.80\n${month}-08,Canva,CNV-3102,0,450,197429.80\n${month}-09,Autolab,INV-2026-042,15000,0,212429.80\n${month}-10,Monthly bank fee,FEE-09,0,35,212394.80\n`;
  const bankData = Buffer.from(bankCsv),
    bankKey = await storeOriginal(actor.companyId, bankData, 'text/csv');
  const db = await getDb();
  await db.transaction(async (tx) => {
    await lockCompany(tx, actor);
    const [account] = await tx
      .insert(bankAccounts)
      .values({
        companyId: actor.companyId,
        name: 'Maybank · Demo operating account',
        currency: 'MYR',
      })
      .returning();
    const [bankDoc] = await tx
      .insert(documents)
      .values({
        companyId: actor.companyId,
        uploaderId: actor.userId,
        batchId: randomUUID(),
        name: 'demo-bank-statement.csv',
        storageKey: bankKey,
        mime: 'text/csv',
        size: bankData.length,
        hash: sha256(bankData),
        purpose: 'statement',
      })
      .returning();
    const [statement] = await tx
      .insert(statements)
      .values({
        companyId: actor.companyId,
        accountId: account.id,
        documentId: bankDoc.id,
        month,
        openingMinor: 20000000,
        closingMinor: 21239480,
        status: 'Imported',
        draft: {
          opening: '200000.00',
          closing: '212394.80',
          rows: [],
          notes: 'Explicit demo fixture; original CSV retains all bank rows.',
        },
      })
      .returning();
    const bankFixtures = [
      {
        index: 0,
        date: '04',
        party: 'Meta Platforms',
        ref: 'META-0921',
        amount: 483220,
        dir: 'out',
        balance: 19516780,
      },
      {
        index: 3,
        date: '05',
        party: 'Northstar Studio',
        ref: 'INV-2026-041',
        amount: 400000,
        dir: 'in',
        balance: 19916780,
      },
      {
        index: 1,
        date: '06',
        party: 'Amazon Web Services',
        ref: 'AWS-8821',
        amount: 128800,
        dir: 'out',
        balance: 19787980,
      },
      {
        index: 2,
        date: '08',
        party: 'Canva',
        ref: 'CNV-3102',
        amount: 45000,
        dir: 'out',
        balance: 19742980,
      },
      {
        index: 4,
        date: '09',
        party: 'Autolab',
        ref: 'INV-2026-042',
        amount: 1500000,
        dir: 'in',
        balance: 21242980,
      },
      {
        index: -1,
        date: '10',
        party: 'Monthly bank fee',
        ref: 'FEE-09',
        amount: 3500,
        dir: 'out',
        balance: 21239480,
      },
    ];
    const invoiceIds: string[] = [];
    for (const [idx, f] of fixtures.entries()) {
      const o = objects[idx];
      const [doc] = await tx
        .insert(documents)
        .values({
          companyId: actor.companyId,
          uploaderId: actor.userId,
          batchId: randomUUID(),
          name: `DEMO-${f.number}.pdf`,
          storageKey: o.key,
          mime: 'application/pdf',
          size: o.data.length,
          hash: sha256(o.data),
          purpose: 'invoice',
        })
        .returning();
      await tx.insert(extractions).values({
        companyId: actor.companyId,
        documentId: doc.id,
        provider: 'demo-fixture',
        model: 'deterministic-fixture',
        raw: { ...f, demo: true },
      });
      const [invoice] = await tx
        .insert(invoices)
        .values({
          companyId: actor.companyId,
          documentId: doc.id,
          kind: f.sales ? 'Sales Invoice' : 'Supplier Invoice',
          party: f.party,
          number: f.number,
          invoiceDate: `${month}-${f.day}`,
          dueDate: `${month}-${f.sales ? '28' : '20'}`,
          description: f.sales ? 'Professional services' : 'Monthly business expense',
          subtotalMinor: f.total,
          taxMinor: 0,
          totalMinor: f.total,
          currency: 'MYR',
          category: f.category,
          confidence: idx === 6 ? 62 : 96,
          reviewStatus: f.approved ? 'Approved' : 'Needs Review',
          lifecycle: f.approved ? 'Issued' : 'Draft',
          approvedBy: f.approved ? actor.userId : null,
          approvedAt: f.approved ? new Date() : null,
          duplicateOf: idx === 7 ? invoiceIds[0] : null,
          duplicateReason: idx === 7 ? 'Duplicate demo invoice number, supplier and amount' : null,
        })
        .returning();
      invoiceIds.push(invoice.id);
      await audit(
        tx,
        actor,
        invoice.id,
        'demo.invoice_seeded',
        null,
        invoice,
        'Explicit demo data, not a real company record',
      );
    }
    for (const [idx, f] of bankFixtures.entries()) {
      const [bank] = await tx
        .insert(bankTransactions)
        .values({
          companyId: actor.companyId,
          accountId: account.id,
          statementId: statement.id,
          rowIndex: idx + 1,
          date: `${month}-${f.date}`,
          description: f.party,
          reference: f.ref,
          direction: f.dir,
          amountMinor: f.amount,
          balanceMinor: f.balance,
          currency: 'MYR',
          fingerprint: sha256(`${actor.companyId}-${idx}`),
        })
        .returning();
      if (f.index === 0 || f.index === 3) {
        const [allocation] = await tx
          .insert(allocations)
          .values({
            companyId: actor.companyId,
            bankTransactionId: bank.id,
            invoiceId: invoiceIds[f.index],
            amountMinor: f.amount,
            createdBy: actor.userId,
            reason: 'Explicit seeded demo confirmation',
          })
          .returning();
        await audit(tx, actor, allocation.id, 'demo.reconciliation_seeded', null, allocation);
      }
    }
    await audit(
      tx,
      actor,
      statement.id,
      'demo.statement_seeded',
      null,
      { accountId: account.id, count: 6 },
      'Explicit demo data',
    );
  });
}
