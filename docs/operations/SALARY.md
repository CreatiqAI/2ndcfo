# Salary and payslips

## Template settings

Open **Settings → Payslips → Payslip template** as Admin or Finance. The button
opens a popup with the editor and PDF preview. Close it with the X or Escape;
save before closing to keep edits. Set the heading, accent
and page colours, footer message, logo size and signature-line visibility. Upload
a PNG/JPEG company logo up to 1 MB (maximum 16 megapixels), or remove it to restore
the radial mark. Logos are resized to at most 256×256 pixels, with proportions
preserved, and saved as PNG data with the workspace template.

Use **Preview PDF** to see sample figures in the actual PDF renderer without
creating a salary record. **Save template** applies the design to future payslips.
**Reset to default** resets the form; save to apply the reset. Blank footer text
hides the coloured footer block. Text contrast adjusts to the chosen colours.

Each new salary record snapshots the template and logo. Changing settings does
not restyle previously saved payslips; pre-template records retain their original
monochrome design. Settings do not alter salary calculations or permissions.

## Generate a payslip

Admin and Finance users can open **Salary** in the sidebar. Add employees through
the existing employee management controls first, then select **Generate payslip**.

1. Choose an employee and pay month.
2. Enter basic salary, attendance, transportation and meal allowances, and bonus.
   All amounts are MYR. Enter verified deductions and an optional description.
3. Add employee/company contact details and the authorised signatory's name/title
   if required. Review the calculated gross earnings and net pay before saving.
4. Select **Download PDF** on the saved row. The A4 monochrome template follows
   the supplied reference, with an earnings table, totals and a signature line.

Gross earnings is the sum of the five earning fields; net pay subtracts deductions.
Negative amounts, deductions exceeding earnings, closed periods and duplicate
employee/month records are rejected. Calculations use integer cents.

Payslips are immutable snapshots: one per employee per month. This release does
not provide a correction/reissue workflow, so check figures before generating.
It does not calculate statutory EPF, SOCSO, EIS or PCB deductions or record salary
payments in Money Out/bank matching. Enter verified deductions yourself. A saved
payslip alone does not indicate that the employee was paid.

Employee/company details are saved with the statement, preserving the original
version if profiles later change. Only Finance/Admin in the same workspace can
list or download statements; employee claim links grant no payroll access.

The PDF supports Chinese names using Noto Sans SC, distributed in `public/fonts/`
under its accompanying SIL Open Font License. Source: the official
[Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/notosanssc).
The font is included in API deployment tracing; no extra environment variables
are required. Excessively long text must be shortened to fit the single-page form.
