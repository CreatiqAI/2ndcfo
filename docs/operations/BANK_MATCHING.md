# Monthly bank matching

The main suggested-match list selects the highest-confidence available pairings,
with each bank transaction and invoice/claim appearing at most once. Rejected pairs
are excluded before alternatives are selected; ties use stable IDs for consistent
display. These remain suggestions requiring human confirmation. Manual matching
and explicit split/combine workflows remain available for other arrangements.

## Statement history and repeat review

Open **Bank Matching → Bank statement history**. The history includes all months,
independently of the matching month's filter. Search by filename/account or select
a month, then choose **Continue review** or **Review again**.

Pending imports can be corrected and confirmed by Finance/Admin. Imported rows
remain read-only; compare them with **Original statement**, enter a review note
and press **Record review**. This adds `statement.reviewed` to the audit trail
without inserting bank rows again or changing allocations. Accountant access is
read-only. Re-review does not rerun AI or reverse/correct already imported ledger
rows; such changes require a separate correction workflow. Review annotations can
be recorded for closed periods because they do not change financial values.

### Match payments while reviewing a statement

In **Review again**, tick the outstanding transactions in the **Match payment**
column. Below the rows, select an invoice/claim for each payment, check the amount
and reason, then press **Confirm selected matches**. For two RM444 incoming rows,
select both, then choose the appropriate customer/invoice number separately for
each reference. No assignment is guessed from equal amounts.

Invoice pickers only include approved outstanding invoices from the bank
statement's exact month and year, with matching currency and payment direction.
The server also enforces this for all invoice allocations. Changing a bank payment
in Manual / split / combine clears the previously selected target. Fully matched or directly categorised
rows cannot be selected. Confirmation uses the existing atomic allocation service:
tenant, role, closed-period, remaining-balance and duplicate-payment protections
still apply. Invoice payment status refreshes immediately after confirmation.

## Upload and match

### Bank handling fees and expenses without receipts

In **Review again**, an unmatched outgoing row offers **Bank handling fee / No
receipt**. Choose Bank handling fee (stored as Bank Charges) or No receipt (stored
as Other Expenses), enter an explanation, and select **Record paid expense**.
The whole bank transaction is categorised; it must not already have allocations.
The original statement remains the evidence and the reason is saved in the audit.

Categorised outgoing transactions appear under **Money Out → Bank fees & expenses
without receipts**, with a link back to the statement. Total Expenses includes
them; Monthly Expenses uses their transaction dates and workspace currency.
These expenses are already paid and do not increase Outstanding or Overdue.
Repeat categorisation and subsequent invoice allocation are blocked to prevent
double counting. Previously categorised outgoing transactions are included too.

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
2026 and suggests September invoices. A September statement cannot be manually
matched to an August invoice or a September invoice from another year. This also
applies to Manual / split / combine. Existing confirmed allocations are preserved.

The existing statement month and invoice/claim dates are used. No database
migration, date rewriting or extra AI request is needed for month matching.
