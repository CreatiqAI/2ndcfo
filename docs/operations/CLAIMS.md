# Employee claim bundles

1. An Admin opens **Claims → Add employee** and enters name, email, department
   and a login password (8 or more characters). This creates an Employee account
   in this workspace. Share credentials directly; no email is sent. Existing
   accounts are linked using Settings → Workspace member without resetting passwords.
2. Create a claim for the employee and month. Leave **Claimed amount** blank for
   automatic receipt totals, or enter a declared amount to retain comparison mode.
3. The receipt upload opens automatically. Select multiple files in one batch;
   subsequent batches can be added to the same draft claim. Press Upload to close
   the popup and follow progress in Claims. Reopen the bundle to inspect receipts.
   Totals update as extraction completes or receipt reviews are saved.
4. Money Out and Documents show one **[Employee name] claim** row per claim.
   Open receipts to see the specific claim's supporting receipts and review each
   original. Separate claims for the same employee retain their title and month.
   Documents → Originals retains the individual evidence files.
5. Submit, obtain manager approval, then finance approval. Approved claims enter
   Money Out totals once and can be matched to bank payments as a bundle. Receipt
   invoices are excluded from standalone Money Out rows and totals.

Automatic totals count non-rejected receipts in the claim currency. Missing,
mixed-currency, duplicate or inconsistent receipts still require review. Submission
and approval wait for extraction. Automatic totals are frozen when approved;
manual adjustments switch the claim to declared-amount mode. Existing claims
retain their original manual amounts. No receipt files are copied or deleted.

Employees see their own claims; Managers retain department scope; Finance/Admin
can create claims on behalf of workspace employees. Adding logins is Admin-only.

## One-time employee links

Finance/Admin can use **Claims → Send link to employee**, select an employee,
month and description, then create a link. This creates a new automatic-total
claim bundle. Copy the link for WhatsApp/email, or open an email draft; the app
does not send email. Create links from the deployed app when sharing externally;
localhost links are only reachable on the same computer.

An unused link expires after 7 days. The employee explicitly clicks Open to
redeem it once (GET previews do not consume it), then receives a separate 24-hour
claim-only session. The token is in the URL fragment, removed from the address
bar on load; only token/session hashes are stored. It cannot create a finance
login or access another claim. The employee enters a description, uploads receipts,
and submits the bundle. Extraction runs automatically per upload, with a Calculate
receipts button for queued work. Failed extraction requires the finance team's
review/retry in the normal app. Submission expires the claim session, including
submissions marked Needs Review. Finance uses the existing approval workflow.

## Delete and restore

Finance/Admin can delete invoices in Money In/Out and delete claims inside the
claim details. A reason and confirmation are required. **Deleted records** offers
Restore from its own sidebar page (Finance/Admin only). These are reversible removals from active lists, available for approved,
paid and draft records. Claim receipts stay with the bundle and original files
remain retained. Posted totals, allocations and exports preserve accounting history;
deletion does not cancel invoices or reverse payments. Use the normal cancellation
or correction workflow when the financial amounts themselves need correction.
