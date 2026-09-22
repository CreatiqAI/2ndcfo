# Approvals and overdue invoices

## Currency and MYR equivalents

Document upload includes a currency selector, defaulting to MYR. With that default,
explicit foreign currency detected in the document is retained; missing currency
uses MYR. Selecting another currency explicitly applies it to that upload batch.
Review can correct the currency before approval. Older blank-currency invoices
display MYR and save the default on review/approval, without rewriting approved data.

Foreign invoice rows show a MYR equivalent using the invoice-date ECB reference
rate through [Frankfurter](https://frankfurter.dev/). The actual rate date and source
are displayed and cached; weekends may use an earlier rate (maximum 7 days old).
Missing/invalid/future invoice dates or unavailable rates show conversion unavailable,
never an invented rate. Conversion uses exact integer arithmetic rounded to MYR cents.

Original amounts and currencies remain intact for matching, approvals and exports.
The MYR equivalent is a reference valuation, not a bank payment or FX settlement;
existing cash/summary figures remain workspace-currency only. No private invoice
details or amounts are sent to the rate API—only currency and date. Local Windows
environments with a trusted corporate certificate may need Node's `--use-system-ca`.

Press **Upload** to close the picker and track each file under **Loading documents**
on the current invoice page. Uploads from Dashboard open Documents. Keep the tab
open while files transfer; after upload, queued extraction is stored durably. Failed
uploads or extraction show retry controls. Completed invoices appear in the normal
list according to their extracted type. Closing the picker with Cancel starts no upload.

During document upload, choose **Default payment terms for this upload**: invoice
date, 7, 14, 30, 45, 60 or 90 calendar days. The choice applies to every sales or
supplier invoice extracted from those files only when both printed terms and due
date are missing. Leave **Use document terms only** to avoid supplying a default.
The choice is fixed once the batch starts, retained for worker retries and recorded
in the upload audit. Edit individual extracted terms in Review before approval.
Claim receipts and bank statements do not use invoice defaults. Earlier uploads
remain unchanged; each new batch gets its own choice.

Money In and Money Out show **Approve all (count)** for Finance/Admin users.
The count includes unapproved, non-rejected invoices in the current search/status
filter, excluding claim receipts. Open the button to review the listed invoices,
then confirm approval. Each invoice uses the same server checks and audit trail
as individual approval. Failures are displayed next to the invoice; successful
approvals remain saved. Review blocked items individually. Duplicate warnings
cannot be overridden with a generic bulk reason.

Approval locks verified invoice details but does not record payment. The
**Overdue** amount is the outstanding balance of approved, uncancelled invoices
whose effective due date is before today (server UTC date). Summary amounts use
the workspace currency and all dates. Upload date and approval date do not reset
the due date. An explicit due date takes priority. When it is blank, clear terms
such as `14 days`, `Net 30`, or `30 days from invoice date` use calendar days from
the invoice date. The interface labels this calculation; original approved fields
remain unchanged. Ambiguous terms (business days, end-of-month, delivery-based
terms or discount schedules) require individual review and are not guessed.

The Overdue filter includes partially paid invoices past their due date. Their
status remains Partially Paid, with the due date and remaining balance shown.
If an invoice has been paid, confirm its bank allocation in Bank Matching;
approval alone does not clear the outstanding amount. Older invoices paid this
month can be matched manually across periods. Incorrect due dates should be
reviewed against the original; approved evidence is not silently overwritten.
