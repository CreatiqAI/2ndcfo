# Salary and payslips

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
