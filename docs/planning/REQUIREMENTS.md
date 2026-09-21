Build a production-ready web application called:

# AI Finance & Budgeting System

The system is designed for startup founders and SMEs to manage company finances in a simple, non-accounting-heavy way.

The core philosophy is:

**Upload financial documents → AI extracts and organises data → system reconciles with bank transactions → system calculates financial performance → AI produces monthly reports, budgeting and financial insights.**

The frontend should use simple business language such as:

- Money In
- Money Out
- Claims
- Bank Reconciliation
- Budget
- Reports
- AI Finance

Avoid forcing users to understand accounting terms such as journal entries, debit, credit or general ledger unless required in the backend.

---

# 1. Main Product Goal

The system should help a company answer these questions automatically:

- How much money did we make this month?
- How much money did we spend?
- How much cash do we currently have?
- Which customers still owe us money?
- Which suppliers do we still need to pay?
- How much are employee claims?
- Are all invoices matched to actual bank transactions?
- Which expenses increased unusually?
- Are we over budget?
- What is our monthly burn rate?
- How many months of runway do we have?
- What is our projected cash balance next month?
- What should management pay attention to this month?

The system should act like an:

# AI CFO for SMEs

AI may extract, classify, match, analyse and recommend.

However:

**AI should not permanently finalise sensitive financial records without user approval.**

Use the flow:

AI Suggest → Human Review → Approve → Final Record.

---

# 2. Main Navigation

Create the following main modules:

1. Dashboard
2. Money In
3. Money Out
4. Claims
5. Bank Reconciliation
6. Transactions
7. Budget
8. Reports
9. AI Finance
10. Documents
11. Settings

---

# 3. Dashboard

The dashboard should provide a company financial overview.

Display:

## Cash

- Current Cash Balance
- Bank Balance
- Available Cash

## Current Month

- Revenue
- Cash Collected
- Expenses
- Cash Paid Out
- Gross Profit
- Operating Profit / Loss
- Net Cash Flow

## Outstanding

- Accounts Receivable
- Accounts Payable
- Overdue Customer Invoices
- Upcoming Supplier Payments

## Financial Health

- Monthly Burn Rate
- Runway
- Average Monthly Revenue
- Average Monthly Expense
- Gross Margin %
- Operating Margin %

## Budget

- Total Monthly Budget
- Actual Spending
- Remaining Budget
- Budget Utilisation %
- Over-Budget Categories

## AI Finance Summary

Display AI-generated management insights.

Example:

“Revenue increased 18% compared with last month.”

“Marketing spending increased RM8,200.”

“RM18,000 of customer invoices are more than 30 days overdue.”

“At the current burn rate, estimated runway is 8.4 months.”

---

# 4. Batch Invoice Upload

This is a core feature.

The user must be able to upload many invoices at once.

Example:

20, 50, 100 or 200 invoices in a single batch.

Support:

- PDF
- JPG
- JPEG
- PNG

Allow drag-and-drop upload.

Also support multi-page PDFs containing multiple invoices.

The system should attempt to split individual documents automatically.

---

# 5. AI Invoice Extraction

For every uploaded invoice, use OCR / AI document understanding to extract:

- Supplier / Customer Name
- Invoice Number
- Invoice Date
- Due Date
- Description
- Product / Service
- Subtotal
- Tax
- Total Amount
- Currency
- Payment Terms
- Bank Reference
- Document Type

The system should classify the document as:

- Sales Invoice
- Supplier Invoice
- Receipt
- Claim Receipt
- Other Financial Document

---

# 6. AI Categorisation

AI should suggest financial categories.

Revenue examples:

- Subscription Revenue
- Setup Fee
- Project Revenue
- Website Development
- Custom Development
- Consultation
- Commission
- Other Revenue

Expense examples:

- Payroll
- Marketing
- Advertising
- Software
- Cloud / API
- Office
- Rental
- Utilities
- Sales Commission
- Travel
- Entertainment
- Professional Fees
- Accounting
- Legal
- R&D
- Equipment
- Bank Charges
- Other Expenses

Every AI suggestion should include:

- Suggested Category
- Confidence Score

Example:

Advertising

Confidence: 96%

The user can:

- Approve
- Change Category
- Reject
- Mark for Review

Invoices with low confidence should automatically enter:

Needs Review.

Suggested threshold:

Below 80% = Needs Review.

---

# 7. Batch Invoice Review

After a large batch upload, show a review table.

Columns:

- Document
- Supplier / Customer
- Invoice Number
- Invoice Date
- Amount
- Type
- AI Category
- AI Confidence
- Bank Match Status
- Duplicate Status
- Review Status

Example:

| Invoice | Company | Amount | Category | Confidence | Match |
| --- | --- | --- | --- | --- | --- |
| INV001 | Meta | RM4,832 | Advertising | 98% | Matched |
| INV002 | AWS | RM1,288 | Cloud | 97% | Matched |
| INV003 | Canva | RM450 | Software | 95% | Unmatched |
| INV004 | ABC Sdn Bhd | RM8,000 | Unknown | 62% | Review |

Finance users should mainly review exceptions instead of manually processing every invoice.

---

# 8. Payment Status

Invoice and cash payment must be treated separately.

An invoice does NOT automatically mean cash was received or paid.

Each invoice requires status:

- Draft
- Issued
- Unpaid
- Partially Paid
- Paid
- Overdue
- Cancelled

Example:

Invoice Amount:
RM10,000

Received:
RM4,000

Outstanding:
RM6,000

Status:
Partially Paid

---

# 9. Bank Statement Upload

Users must be able to upload a bank statement for a selected month.

Support:

- PDF
- CSV
- XLSX

The system should extract:

- Transaction Date
- Transaction Description
- Bank Reference
- Money In
- Money Out
- Bank Balance

After uploading the bank statement, start automatic reconciliation.

---

# 10. AI Bank Reconciliation

AI should attempt to match:

Invoices

Claims

Expenses

Receipts

to bank transactions.

Matching should NOT be based on amount alone.

Use multiple signals:

- Amount
- Supplier / Customer Name
- Invoice Number
- Date
- Bank Reference
- Description
- Historical Payment Pattern
- Currency

Generate a Match Confidence Score.

Example:

Meta Invoice

RM4,832.20

↔

Bank Transaction

META PLATFORMS

RM4,832.20

Match Confidence:

98%

Allow:

- Confirm Match
- Reject Match
- Select Another Match
- Split Payment
- Combine Payments

---

# 11. Reconciliation Scenarios

Support the following cases.

## Exact Match

Invoice:
RM5,000

Bank:
RM5,000

Status:
Matched

---

## Partial Payment

Invoice:
RM10,000

Bank:
RM4,000

Status:
Partially Paid

Outstanding:
RM6,000

---

## Multiple Bank Transactions to One Invoice

Invoice:

RM10,000

Bank:

RM4,000

RM3,000

RM3,000

AI should suggest:

These 3 transactions may fully settle this invoice.

---

## One Bank Transaction Paying Multiple Invoices

Invoices:

RM3,000

RM4,000

RM3,000

Bank:

RM10,000

AI should suggest:

This transaction may settle 3 invoices.

Require human confirmation.

---

## Bank Transaction Without Invoice

Example:

Bank Charge

RM35

Allow user to categorise it directly.

Suggested:

Bank Charges

---

## Invoice Without Bank Match

Keep invoice as:

Unpaid

If due date has passed:

Overdue

Automatically move it into Accounts Receivable or Accounts Payable.

---

# 12. AI Reconciliation Centre

Create a dedicated reconciliation page.

This should be one of the key screens in the product.

Layout suggestion:

Left side:

Documents

- Sales Invoices
- Supplier Bills
- Claims

Right side:

Bank Transactions

Show suggested links visually.

Example:

ABC Invoice

RM10,000

↔

ABC Bank Payment

RM10,000

99% Match

Status:
Confirmed

---

Allow filters:

- Matched
- Unmatched
- Partial
- Needs Review
- Duplicate
- Difference
- Missing Document

---

# 13. Monthly Reconciliation

Allow Finance to select a month.

Example:

September 2026

Show:

Documents Uploaded:
183

Invoices Recognised:
176

Bank Transactions:
241

Matched:
163

Partially Matched:
6

Unmatched:
7

Potential Duplicates:
3

Needs Review:
10

Missing Documents:
4

Display a progress indicator.

Example:

September Closing Progress:

92%

---

# 14. Month-End Closing

Create a:

Close Month

button.

Before closing, perform validation.

Example checklist:

- All bank statements uploaded
- Critical invoices reviewed
- Claims approved
- Unmatched transactions reviewed
- Duplicate invoices reviewed
- Receivables updated
- Payables updated

Allow non-critical exceptions but show warnings.

When a month is closed:

Lock historical financial records.

Any later modification must generate an Audit Trail.

---

# 15. Claims Module

Create a dedicated employee / director claim module.

Claims should support batch receipt upload.

Example:

Employee:
Sean

Claim Period:
September 2026

User uploads:

35 receipts at once.

AI automatically reads every receipt.

Extract:

- Merchant
- Date
- Receipt Number
- Amount
- Tax
- Category
- Currency

Categories may include:

- Grab / Transport
- Petrol
- Parking
- Toll
- Meals
- Client Entertainment
- Hotel
- Flight
- Office Purchase
- Software
- Miscellaneous

---

# 16. Claim Batch Calculation

After uploading receipts, AI automatically calculates:

Total Supporting Receipt Amount.

Example:

Grab:
RM28.50

Petrol:
RM120

Parking:
RM18

Client Lunch:
RM86

Hotel:
RM380

Flight:
RM426

Total:

RM1,058.50

Show category breakdown.

Example:

Travel:
RM954.50

Entertainment:
RM86

Parking:
RM18

---

# 17. Submitted Claim Amount vs Receipt Total

Allow the employee to enter:

Claimed Amount.

Example:

Employee Claimed:

RM1,100

AI Calculated Supporting Receipts:

RM1,058.50

Difference:

RM41.50

Display warning:

Claim total does not match supporting documents.

Finance should be able to investigate.

---

# 18. Missing Receipt Detection

If a claim form includes:

Petrol:
RM120

Grab:
RM58

Meal:
RM80

Parking:
RM22

Total:
RM280

But uploaded receipts total:

RM258

AI should flag:

Possible Missing Receipt

Difference:

RM22

Allow Finance to:

- Request Receipt
- Approve Without Receipt
- Reject Item
- Adjust Claim

---

# 19. Duplicate Claim Detection

Detect possible duplicate receipts using:

- Receipt Number
- Merchant
- Date
- Amount
- Document Hash
- Image Similarity
- Previous Claim History

Example:

Possible Duplicate Claim

RM48 Grab Receipt

Previously submitted:
28 August 2026

Require human review.

---

# 20. Claim Approval Workflow

Use the flow:

Employee / Admin Upload

↓

AI Extract

↓

AI Calculate

↓

AI Check Difference

↓

AI Check Duplicate

↓

Manager Approval

↓

Finance Approval

↓

Payout

↓

Bank Reconciliation

↓

Paid

Statuses:

- Draft
- Submitted
- Needs Review
- Manager Approved
- Finance Approved
- Rejected
- Paid

---

# 21. Claim Bank Reconciliation

Example:

Approved Claim:

Sean

September Claim

RM1,058.50

Bank Transaction:

SEAN LEE

RM1,058.50

AI should match them.

Status:

Paid

---

# 22. Money In

Create a section for company revenue.

Main items:

- Sales Invoices
- Payments Received
- Accounts Receivable

Show:

- Total Invoiced
- Cash Collected
- Outstanding
- Overdue
- Upcoming Due

---

# 23. Accounts Receivable

Create ageing buckets:

- Current
- 1–30 Days
- 31–60 Days
- 61–90 Days
- 90+ Days

Example:

ABC Sdn Bhd

RM15,000

12 Days Overdue

XYZ Sdn Bhd

RM8,800

Due in 4 Days

---

# 24. Money Out

Include:

- Supplier Bills
- Expenses
- Claims
- Recurring Expenses
- Accounts Payable

Show:

- Total Bills
- Paid
- Outstanding
- Upcoming
- Overdue

---

# 25. Accounts Payable

Display:

- Supplier
- Invoice
- Amount
- Due Date
- Category
- Status
- Priority

AI alert example:

RM18,600 supplier payments are due within the next 7 days.

---

# 26. Recurring Expenses

Support recurring financial commitments.

Examples:

- Office Rental
- Salary
- AWS
- OpenAI
- Canva
- Google Workspace
- Accounting Fee
- Insurance
- Software Subscription

Fields:

- Vendor
- Description
- Amount
- Frequency
- Start Date
- End Date
- Category
- Department
- Auto Forecast Enabled

The system should use recurring expenses for forecasting.

---

# 27. Budgeting

Allow monthly budgets.

Categories:

- Revenue Target
- Payroll
- Marketing
- Advertising
- Software
- Office
- Rental
- R&D
- Sales
- Travel
- Other

For each category show:

- Budget
- Actual
- Remaining
- Variance
- Variance %
- Utilisation %

Example:

Marketing

Budget:
RM20,000

Actual:
RM17,420

Remaining:
RM2,580

Utilisation:
87.1%

---

# 28. Budget Alerts

Generate alerts such as:

Marketing has reached 95% of monthly budget with 9 days remaining.

Software spending is 22% above budget.

Overall operating expenses exceeded budget by RM8,900.

---

# 29. Budget vs Actual Report

Create table:

| Category | Budget | Actual | Variance | Variance % |
| --- | --- | --- | --- | --- |

AI should explain major differences.

Example:

September expenses exceeded budget by RM8,900.

Main contributors:

Marketing:
+RM7,500

Software:
+RM1,800

Office:
-RM400

---

# 30. Cash Flow Forecast

Forecast:

- 30 Days
- 60 Days
- 90 Days
- 6 Months
- 12 Months

Use:

Current Cash

+

Expected Receivables

+

Expected Recurring Revenue

-

Accounts Payable

-

Recurring Expenses

-

Approved Budget Spending

=

Projected Cash Balance

Display a graph.

---

# 31. Burn Rate

Calculate:

Gross Burn

=

Total Monthly Operating Expenses

Net Burn

=

Operating Expenses

-

Operating Cash Contribution

Keep formula configurable.

Show monthly history.

---

# 32. Runway

Calculate:

Runway

=

Available Cash

÷

Average Monthly Net Burn

Example:

Cash:
RM500,000

Net Burn:
RM50,000

Runway:
10 Months

Show prominently on Dashboard.

---

# 33. Scenario Planning

Allow management to create scenarios.

Default:

Conservative

Base

Growth

Example assumptions:

Conservative:
Revenue -30%

Base:
Current Forecast

Growth:
Revenue +30%

Allow user to modify:

- Revenue Growth
- New Hiring
- Payroll
- Marketing
- Software
- Office
- New Projects
- One-Time Expenses

System recalculates:

- Revenue
- Expense
- Profit
- Cash Flow
- Burn
- Runway

Example query:

What if I hire 3 employees at RM4,000 each?

Result:

Additional Payroll:
RM12,000/month

Net Burn:
RM32,000 → RM44,000

Runway:
14.2 months → 10.3 months

---

# 34. AI Finance Assistant

Create a ChatGPT-style finance assistant inside the application.

The assistant must query actual company financial data.

It should not provide generic responses when company data exists.

Example questions:

- How much did we spend this month?
- What is our biggest expense?
- Which customers still owe us money?
- Which invoices are overdue?
- Why did profit decrease this month?
- What is our current runway?
- Can we afford to hire two employees?
- Which software subscriptions increased?
- Show all Meta invoices from August.
- Which projects are most profitable?
- How much will we need to pay next month?
- Are we over budget?

AI responses should cite the underlying internal records where possible.

---

# 35. Monthly AI Finance Report

Automatically generate a monthly management report.

Sections:

## Executive Summary

- Revenue
- Expenses
- Profit
- Cash Flow
- Cash Balance
- Burn Rate
- Runway

## Revenue Analysis

- Revenue by Product
- Revenue by Customer
- Recurring Revenue
- One-Time Revenue
- Revenue Growth

## Expense Analysis

- Top Expense Categories
- Expense Changes
- Unexpected Spending
- Recurring Costs

## Cash Flow

- Opening Cash
- Cash In
- Cash Out
- Closing Cash

## Receivables

- Total Outstanding
- Total Overdue
- Largest Outstanding Customers

## Payables

- Upcoming Bills
- Overdue Supplier Payments

## Budget Performance

- Budget
- Actual
- Variance

## AI Observations

Example:

Revenue grew 12%, but operating expenses grew 21%.

Marketing spending increased significantly.

Outstanding receivables increased from RM32k to RM57k.

## AI Recommended Actions

Example:

Follow up RM25,000 overdue invoices.

Review 3 unused software subscriptions.

Delay RM15,000 non-essential equipment purchase.

---

# 36. Automatic Budget Recommendation

Use historical financial data to recommend next month’s budget.

Consider:

- Previous 3 Months
- Previous 6 Months
- Previous 12 Months
- Recurring Expenses
- Revenue Trend
- Expense Trend
- Management Targets

AI may recommend:

Marketing:
RM22,000

Payroll:
RM38,000

Software:
RM9,200

Office:
RM6,000

R&D:
RM12,000

Budget approval flow:

AI Generate

↓

Management Review

↓

Edit

↓

Approve

↓

Lock Budget

---

# 37. AI Anomaly Detection

Detect unusual activity.

Examples:

Marketing usually:
RM10k–RM15k

Current Month:
RM28k

AI Alert:

Marketing spending is 92% above the three-month average.

Another example:

Software expenses:

June:
RM4,800

July:
RM5,400

August:
RM6,900

September:
RM8,300

AI:

Software expenses have increased for four consecutive months.

---

# 38. Duplicate Invoice Detection

Detect possible duplicate invoices using:

- Invoice Number
- Supplier
- Amount
- Date
- Document Hash
- OCR Content Similarity

Example:

Possible Duplicate Invoice

Invoice:
ABC123

Amount:
RM8,200

Previously uploaded:
12 September 2026

---

# 39. Document Storage

Every transaction must retain its supporting documents.

Example transaction:

Meta Ads

RM4,832

Attached:

- Invoice PDF
- Bank Transaction
- AI Extraction Data
- Approval Record

Documents should be searchable and downloadable by authorised users.

---

# 40. Transactions

Create a complete transaction ledger.

Fields:

- Date
- Type
- Supplier / Customer
- Description
- Category
- Department
- Project
- Client
- Amount
- Currency
- Payment Status
- Bank Match
- Document
- Created By
- Approved By

Allow filtering and export.

---

# 41. Project and Client Profitability

Allow transactions to be assigned to:

- Client
- Project
- Department
- Cost Centre
- Product

Example:

Client:
Autolab

Project:
AI Development

Revenue:
RM100,000

Direct Cost:
RM22,000

Gross Profit:
RM78,000

Gross Margin:
78%

Allow management to compare profitability.

---

# 42. Founder Advance / Director Loan

Support cases where a founder pays company expenses personally.

Example:

Founder pays:

RM5,000 Meta Ads

Record:

Expense:
RM5,000

Category:
Marketing

Payment Source:
Founder Advance

System should also create:

Amount Company Owes Founder:
RM5,000

When company repays founder:

Reduce Founder Advance balance.

---

# 43. Notifications

Support in-app notifications first.

Future-ready for:

- Email
- WhatsApp

Alerts:

- Invoice Overdue
- Supplier Payment Due
- Budget 80% Used
- Budget Exceeded
- Cash Below Threshold
- Runway Below Threshold
- Unusual Expense
- Duplicate Invoice
- Duplicate Claim
- Missing Receipt
- Large Transaction
- Recurring Expense Increase

---

# 44. User Roles

Create role-based access control.

## Founder / Admin

Full access.

## Finance

Invoices, claims, transactions, reconciliation, reports.

## Manager

View department budgets and approve claims.

## Employee

Create and view own claims.

## Accountant

Financial records, reports, exports.

---

# 45. Audit Trail

Every important change must be recorded.

Track:

- User
- Date
- Time
- Record
- Previous Value
- New Value
- Reason where applicable

Example:

Category:

Software

Changed To:

Marketing

Changed By:

Sean

Date:

21 Sep 2026

Historical financial changes must never happen silently.

---

# 46. Search

Create global search.

Search:

- Invoice Number
- Supplier
- Customer
- Amount
- Project
- Claim
- Receipt
- Date
- Description

AI search example:

Find all invoices from Meta in August.

---

# 47. Reports

Initial reports:

- Profit & Loss
- Cash Flow
- Accounts Receivable
- Accounts Payable
- Budget vs Actual
- Monthly Management Report
- Claim Report
- Reconciliation Report

Future:

- Balance Sheet
- Trial Balance
- General Ledger
- Fixed Asset Register

---

# 48. Export

Support:

- CSV
- XLSX
- PDF

Allow export of:

- Transactions
- Invoices
- Claims
- Reconciliation
- Budget
- Reports

---

# 49. UI / UX Direction

Design should feel:

- Modern
- Premium
- Clean
- Simple
- Financial but not traditional accounting software
- Startup SaaS style

Avoid clutter.

Use cards, charts, tables and status indicators.

Prioritise readability.

Important financial alerts should be visually prominent.

Use clear statuses:

Matched

Unmatched

Paid

Unpaid

Overdue

Needs Review

Approved

Rejected

---

# 50. Recommended Month-End Experience

The ideal workflow should be:

### STEP 1

Finance uploads all sales invoices and supplier invoices for the month.

### STEP 2

Employees or Finance upload all monthly claim receipts.

### STEP 3

Finance uploads the monthly bank statement.

### STEP 4

AI extracts and categorises documents.

### STEP 5

AI automatically reconciles invoices, claims and bank transactions.

### STEP 6

Finance reviews only exceptions.

### STEP 7

System calculates:

- Revenue
- Expenses
- Profit
- Cash Flow
- Receivables
- Payables
- Burn
- Runway
- Budget Variance

### STEP 8

AI generates the monthly report.

### STEP 9

AI recommends next month’s budget.

### STEP 10

Finance / Founder closes the month.

Target experience:

Finance should mainly manage exceptions instead of manually entering every transaction.

---

# 51. MVP PRIORITY

Do NOT build the entire enterprise accounting suite first.

Start with this MVP.

## MVP Phase 1

Build:

- Authentication
- Company Workspace
- Dashboard
- Batch Invoice Upload
- AI OCR
- AI Document Extraction
- AI Categorisation
- Batch Review
- Claims
- Batch Claim Receipt Upload
- Claim Total Calculation
- Missing Receipt Detection
- Duplicate Detection
- Bank Statement Upload
- Bank Transaction Parsing
- AI Reconciliation
- Manual Reconciliation
- Money In
- Money Out
- Accounts Receivable
- Accounts Payable
- Transactions
- Basic Budget
- Budget vs Actual
- Burn Rate
- Runway
- Monthly Closing
- Monthly AI Report
- AI Finance Chat
- Audit Trail

Do not prioritise:

- Tax filing
- Payroll calculation
- Full double-entry accounting
- Government submission
- Full ERP functionality

Those can be future phases.

---

# 52. Phase 2

Add:

- Recurring Revenue
- Recurring Expenses
- MRR
- Bank Auto Import
- Cash Flow Forecast
- Scenario Planning
- Project Profitability
- Department Budgets
- AI Anomaly Detection
- Automatic Budget Recommendation
- Notifications
- Email Integrations
- WhatsApp Alerts

---

# 53. Phase 3

Future:

- Bank API Integration
- Payment Gateway Integration
- Accounting Software Integration
- CRM Integration
- Payroll Integration
- Sales System Integration
- Automated Invoice Collection
- Supplier Payment Workflow
- Balance Sheet
- General Ledger
- Tax / Compliance Features

---

# 54. Technical Requirements

Use a scalable architecture.

Prefer:

Frontend:

Next.js / React / TypeScript

Backend:

Choose a clean backend architecture suitable for financial SaaS.

Database:

PostgreSQL

Use a proper ORM.

File Storage:

Object storage architecture suitable for PDFs and images.

Authentication:

Secure authentication with role-based permissions.

AI:

Abstract AI provider behind a service layer so models can be changed later.

OCR:

Create a document extraction pipeline capable of using OCR + multimodal AI.

Important:

Do not hardcode business logic inside UI components.

Financial calculation logic should live in reusable services.

Keep:

- ingestion
- extraction
- categorisation
- reconciliation
- reporting
- budgeting
- AI analysis

as separate modules.

---

# 55. Data Integrity Requirements

This is financial software.

Prioritise accuracy and auditability over automation.

Important rules:

1. Never silently overwrite approved financial records.

2. Keep original uploaded documents.

3. Store original AI extraction results.

4. Store user corrections.

5. Keep approval history.

6. Keep reconciliation history.

7. Keep confidence score.

8. Never automatically delete financial records.

9. Use soft delete where appropriate.

10. All critical calculations must be reproducible.

---

# 56. AI Safety Rules

AI must never fabricate:

- Invoice data
- Supplier name
- Payment
- Bank transaction
- Revenue
- Expense
- Missing records

If extraction confidence is low:

Mark Needs Review.

If AI cannot confidently match:

Do not auto-match.

If information is missing:

Show Unknown / Missing.

Never guess financial values.

---

# 57. Important Accounting Principle

The system must distinguish:

Accrual activity

from

Cash activity.

Example:

Invoice Created:

RM10,000 Revenue

does not mean:

RM10,000 Cash Received

Therefore track separately:

Invoice Amount

Paid Amount

Outstanding Amount

Payment Date

Bank Transaction

This distinction is essential for:

- P&L
- Cash Flow
- Accounts Receivable
- Accounts Payable

---

# 58. Acceptance Criteria

The MVP is successful when a user can do this:

1. Create company workspace.

2. Upload 50 supplier invoices at once.

3. AI extracts invoice information.

4. AI categorises expenses.

5. User reviews low-confidence records.

6. Upload 30 sales invoices.

7. Upload employee claim receipts.

8. AI calculates claim totals.

9. AI flags duplicate or missing receipts.

10. Upload one monthly bank statement.

11. System extracts bank transactions.

12. AI matches bank transactions to invoices and claims.

13. User resolves unmatched items.

14. System calculates current month:

Revenue

Expenses

Profit

Cash Flow

AR

AP

Burn

Runway

15. System compares actual spending against budget.

16. AI generates a monthly financial summary.

17. Founder can ask AI:

“Why did our expenses increase this month?”

18. System answers using actual company data.

19. Finance can close the month.

20. Historical approved data remains auditable.

---

# 59. Build Order

Please build in this order:

## Stage 1

Project architecture

Database schema

Authentication

Company workspace

Roles

## Stage 2

Document storage

Batch uploads

OCR / AI extraction pipeline

Invoice parsing

## Stage 3

Money In

Money Out

Transactions

Invoice review

## Stage 4

Claims

Batch claim upload

Claim calculation

Duplicate detection

## Stage 5

Bank statement import

Bank transaction parser

Reconciliation engine

## Stage 6

Dashboard

AR

AP

Financial calculations

## Stage 7

Budgeting

Burn

Runway

Budget vs Actual

## Stage 8

Monthly closing

Monthly AI report

## Stage 9

AI Finance Chat

## Stage 10

Testing

Security

Validation

Error handling

UI polish

---

# 60. Development Behaviour

Do not only create static frontend mockups.

Build the application architecture and workflows so features are functional.

Use realistic seeded demo data where required.

If an AI or OCR provider is not configured yet:

Create a provider abstraction and mock service so the application still runs.

If bank APIs are not available:

Start with PDF / CSV / XLSX bank statement imports.

If any business rule is unclear:

Use the safest accounting / audit-friendly behaviour.

Prioritise:

Accuracy

Traceability

Human Review

Simple UX

Batch Processing

Exception Management

The primary success metric is:

**Finance users should spend less time entering data and more time reviewing exceptions.**

Final product positioning:

# AI CFO for SMEs

**Upload your invoices, claims and bank statement.  
AI organises and reconciles the numbers.  
The system analyses the business.  
Management makes the decisions.**