# Approvals and overdue invoices

Money In and Money Out show **Approve all (count)** for Finance/Admin users.
The count includes unapproved, non-rejected invoices in the current search/status
filter, excluding claim receipts. Open the button to review the listed invoices,
then confirm approval. Each invoice uses the same server checks and audit trail
as individual approval. Failures are displayed next to the invoice; successful
approvals remain saved. Review blocked items individually. Duplicate warnings
cannot be overridden with a generic bulk reason.

Approval locks verified invoice details but does not record payment. The
**Overdue** amount is the outstanding balance of approved, uncancelled invoices
whose recorded due date is before today (server UTC date). Summary amounts use
the workspace currency and all dates. Upload date and approval date do not reset
the due date. Missing due dates are not assumed overdue.

The Overdue filter includes partially paid invoices past their due date. Their
status remains Partially Paid, with the due date and remaining balance shown.
If an invoice has been paid, confirm its bank allocation in Bank Matching;
approval alone does not clear the outstanding amount. Older invoices paid this
month can be matched manually across periods. Incorrect due dates should be
reviewed against the original; approved evidence is not silently overwritten.
