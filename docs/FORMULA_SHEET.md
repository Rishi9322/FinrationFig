# FinRatio Formula Sheet

This sheet is updated using `FinRatio_Formula_Sheet.xlsx` (Formula Reference tab) and mapped to the calculators currently present in the app.

## App Calculators

### 1. Debt-to-Equity Ratio
Debt-to-Equity = Total Debt / Tangible Net Worth

### 2. Quasi Debt-to-Equity Ratio
Quasi Debt-to-Equity = (Total Debt + Quasi Debt) / Equity

Quasi Debt typically includes unsecured promoter loans and deferred payments.

### 3. Current Ratio
Current Ratio = Current Assets / Current Liabilities

### 4. Debt Service Coverage Ratio (DSCR)
DSCR = Cash Accruals / (Principal Repayment + Interest)

Cash Accruals = PAT + Depreciation + Interest

### 5. EBITDA
EBITDA = Net Income + Interest + Taxes + Depreciation + Amortisation

Alternative form:

EBITDA = EBIT + Depreciation + Amortisation

### 6. Interest Service Coverage Ratio (ISCR)
ISCR = EBIT / Interest Expense

Alternative (often used in practice):

ISCR = EBITDA / Interest Expense

### 7. Net Working Capital
Net Working Capital = Current Assets - Current Liabilities

### 8. Drawing Power
Drawing Power = (Stock + Debtors - Creditors) * 75 / 100

### 9. Receivables Ageing Analysis
0-30 bucket = Receivables with DPD <= 30

31-60 bucket = Receivables with DPD between 31 and 60

61-90 bucket = Receivables with DPD between 61 and 90

90+ bucket = Receivables with DPD > 90

Bucket Percentage = Bucket Amount / Total Receivables * 100

### 10. Purchase Invoice Discounting (PID)
Gap Days = Sales Credit Days - Purchase Credit Days

PID Rotation = 365 / Gap Days

Purchase Supported = PID Limit * PID Rotation

Sales Generated = Purchase Supported / (1 - Margin Percent / 100)

Additional Profit = Sales Generated * Margin Percent / 100

Cash Discount Earned = Purchase Supported * Cash Discount Percent / 100

PID Cost Annual = PID Limit * PID Cost Per Month Percent / 100 * 12

Net PID Benefit = Cash Discount Earned - PID Cost Annual

Total Profit Increase = Additional Profit + Net PID Benefit

### 11. Working Capital Cycle %
Debtors Percent = Debtors * 100 / Sales

Stock Percent = Stock * 100 / Sales

Creditors Percent = Creditors * 100 / Purchases

Working Capital Cycle Percent = Debtors Percent + Stock Percent - Creditors Percent

### 12. Business Valuation
Enterprise Value (EV) = EBITDA * Multiple

Equity Value = EV - Net Debt

Net Debt = Total Debt - Cash and Cash Equivalents

## Additional Reference Ratios from Workbook

### AR Aging Days (Debtors Turnover Ratio)
AR Aging Days = Accounts Receivable * 365 / Credit Sales

Some teams use 360 instead of 365 by internal convention.

### Creditors Turnover Ratio
CTR = Trade Creditors * 365 / Net Purchases

### Gross Profit Margin
Gross Profit Margin = (Revenue - COGS) / Revenue * 100

### Net Profit Margin
Net Profit Margin = Net Profit After Tax / Revenue * 100

### TOL/TNW
TOL/TNW = Total Outside Liabilities / Tangible Net Worth

### Current Liability Ratio (CLR)
CLR = Current Liabilities / Total Outside Liabilities


## Balance Sheet Upload and Assessment Report

How an uploaded statement becomes the report (code: `statementParsing.ts`, `parsedToCalculatorMapper.ts`, `financialRating.ts`, `finance/peerBenchmarks.ts`).

### Reading the statement
- **Headings decide the section.** "Current assets", "Non-current liabilities", "Shareholders' funds", "Secured / Unsecured loans" and similar headings place the lines under them. Generic headings ("Liabilities", "Assets") only place lines the wording cannot.
- **Wording is matched against synonyms** (Sundry Debtors = Trade Receivables, Bank OD / CC / WCDL = working-capital debt, Capital Account = equity, and so on). A line that stays unplaced is reported, never guessed.
- **Layouts handled:** vertical Schedule III, side-by-side (T-format) sheets in PDF and Excel/CSV, two pages printed on one sheet, a second amount column holding group subtotals, `Add:` / `Less:` rows, `To,` / `By,` trading-account rows.
- **Only the statements are read** from a long report: from "Balance Sheet as at ..." / "Statement of Profit and Loss ..." up to the cash flow, changes in equity or notes.
- **Consolidated and standalone:** when a report has both sets, the first is read and the upload screen offers a switch to the other.
- **Units** printed on the statement ("Rs. in lakhs", "₹ crore") are carried to the report; ratios are unaffected.

### Debt used in the report
Total debt = borrowings (term loans, cash credit, bank OD, bills discounted, debentures) + lease liabilities + deferred payment liabilities (e.g. spectrum dues) + lines under a Secured/Unsecured Loans heading. Working-capital borrowings count as current liabilities whatever heading they sit under.

### Our rating
Each measure scores Low risk 100, Moderate 55, High 15. Grade = weighted average: A 75+, B 55+, C 35+, otherwise D.

| Measure | Weight |
|---|---|
| Debt / Equity | 2 |
| Current Ratio | 2 |
| DSCR | 2 |
| ISCR | 2 |
| EBITDA | 1.5 |

(Quasi Debt / Equity is shown but not scored: it restates Debt / Equity.) One High measure caps the grade at B, two cap it at C. Fewer than ~4 weighted measures gives "not enough data". A file read below 50% confidence is marked provisional. DSCR uses interest + principal repaid (read from the cash flow statement when the file has one: repayment of borrowings, lease and deferred-payment liabilities); without a cash flow statement it is interest only and the report says so.

### Peer comparison
Debt / Equity, Current Ratio, Interest Cover (EBIT / Interest) and Operating Margin are placed against listed Indian companies (48 industries with 15+ companies, financial companies excluded from the all-company group). Output is "better than X% of peers" in the direction that counts as better. Data: Kaggle `pacificrm/financial-sheets` (CC0), rebuilt with `scripts/build-peer-benchmarks.mjs`. Peers are mostly mid-size and large, so a small firm usually ranks below the median.

### CMA generator: AI extraction
The CMA generator sends the document text to a model (`src/lib/ai/cmaPrompt.ts`). The prompt carries a terminology glossary for every schema field (Sundry Debtors = trade receivables, Bank OD / CC / WCDL = bank borrowings CC, Capital Account = ordinary share capital, and so on), the layouts to expect (Schedule III, two-sided Indian format, proprietorship, trading account, two pages to a sheet), and the rules: convert every unit to Rs. Lakhs, use the printed years oldest first, `Add:` / `Less:` signs, subtotal columns are not extra lines. After extraction, `src/lib/ai/sourceCheck.ts` compares the model's total assets with the figure the document itself prints (allowing for the unit conversion); a disagreement appears in the review items.
