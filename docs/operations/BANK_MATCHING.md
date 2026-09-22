# Monthly bank matching

1. Open **Bank Matching → Import statement** and choose the bank account.
2. Answer **Which month and year is this bank statement for?** This is required
   for each upload; use the statement period, not today's month.
3. Upload the PDF, CSV or XLSX. The app switches to that month and opens review.
4. Check the extracted rows and balances, then import. Transactions outside the
   selected month block import; dates must follow the original evidence. Check
   the selected period carefully before upload; the existing review screen edits
   transaction details but does not change the statement period.
5. Matching suggestions appear automatically for approved invoices and finance
   approved claims in the same calendar month and year. Amount, currency,
   direction and identity signals still apply. Review and confirm a suggestion
   before it records a payment.

For example, a September 2026 statement uploaded in October opens September
2026 and suggests September invoices. A September payment settling an August
invoice can still be allocated using **Manual / split / combine**, which includes
all periods. Automatic combined/split suggestions stay within one month.

The existing statement month and invoice/claim dates are used. No database
migration, date rewriting or extra AI request is needed for month matching.
