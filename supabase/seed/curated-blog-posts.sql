-- Curated blog posts: short summaries in FinRatio's own words, each crediting and
-- linking the original. Nothing is copied wholesale. Safe to re-run (slug is unique).
-- Sources were read on 2026-10-05; thresholds and rules change, so each post tells the
-- reader to confirm with their lender.

insert into public.blog_posts (slug, title, excerpt, content, source_name, source_url, published, author_id, author_name)
values

-- 1 ---------------------------------------------------------------------------
('dscr-explained-the-ratio-lenders-check-first',
 'DSCR explained: the ratio lenders check first',
 'Debt service coverage ratio compares the cash a business earns with the loan payments it owes. Here is what the number means, how to read it, and why its definition changes from lender to lender.',
 $md$
**Debt service coverage ratio (DSCR)** answers one question a lender cares about above all: *does this business generate enough cash to pay its loan instalments?*

## The idea
- **DSCR = net operating income ÷ debt service.**
- *Net operating income* is what the business earns from operations after operating costs.
- *Debt service* is everything owed on borrowings in the period: the **principal repaid, the interest, and lease payments**.

## How to read the number
| DSCR | What it tells you |
|---|---|
| Below 1.0 | Income does not cover the payments. The shortfall has to come from savings, new borrowing or the owners. |
| Exactly 1.0 | Income only just covers the payments, with no cushion at all. |
| Above 1.0 | Income comfortably covers the payments. The higher, the safer the lender feels. |

The source notes that **1.25 or more** is a common minimum in commercial real-estate lending (a 25% cushion), and that **commercial banks typically ask for somewhere between about 1.15 and 1.35**.

## Why two lenders can give you two different DSCRs
The definition is not fully standard. One wrinkle the source points out is tax: interest is tax-deductible but principal repayment is not, so "cash available for debt service" depends on how taxes are treated. Some lenders adjust for this. Others start from EBITDA or cash profit instead of operating income. Always ask your bank **which formula it uses** before you compare your number with a benchmark.

## What to do with this
- Keep your projected DSCR comfortably above your lender's stated minimum in **every** year of the loan, not only on average.
- If it is thin, a longer repayment period, a smaller loan or higher operating cash flow are the levers that move it.

*FinRatio's DSCR calculator lets you test these scenarios with your own figures.*

---
**Credit:** Summarised by FinRatio from Wikipedia, "Debt service coverage ratio" (text available under CC BY-SA). Read the full article at the source: https://en.wikipedia.org/wiki/Debt_service_coverage_ratio. Thresholds vary by lender and loan type; confirm with your bank.
$md$,
 'Wikipedia', 'https://en.wikipedia.org/wiki/Debt_service_coverage_ratio', true, 'editorial', 'FinRatio Editorial'),

-- 2 ---------------------------------------------------------------------------
('ebitda-based-dscr-what-the-125x-rule-hides',
 'The EBITDA-based DSCR: what the 1.25x rule hides',
 'Many lenders approximate cash flow with EBITDA less cash taxes. That is quick, but it has real blind spots. A summary of the formula, the usual thresholds and the four limitations to watch.',
 $md$
There is more than one way to compute DSCR. A widely used corporate version replaces "net operating income" with an **EBITDA-based cash proxy**:

> **DSCR = (EBITDA − cash taxes) ÷ (principal + interest)**

## Typical thresholds quoted
- **Below 1.0x**: very weak. The business owes more each year than it generates in cash.
- **About 1.25x**: the commonly cited *minimum* a commercial bank wants.
- **2.0x or more**: what most lenders would prefer to see.

## Four limitations worth knowing
1. **EBITDA is an approximation, not real cash flow.** It ignores swings in working capital (stock building up, customers paying late).
2. **It is a snapshot of one period.** A seasonal business can look fine on an annual figure and still run short in the lean months.
3. **Context matters.** Capital-heavy industries, owner pay, and leases that behave like debt all need adjusting for.
4. **It should never be read alone.** Look at leverage and liquidity ratios beside it.

## A practical takeaway for borrowers
If your bank uses an EBITDA-based formula, a business with heavy receivables or fast-growing inventory can show a healthy DSCR on paper while cash is tight in practice. Keep a monthly cash forecast alongside the ratio, and be ready to explain any gap to your lender.

---
**Credit:** Summarised by FinRatio from "Debt Service Coverage Ratio (DSCR)" by the **Corporate Finance Institute (CFI Team)**, published 29 January 2020: https://corporatefinanceinstitute.com/resources/commercial-lending/debt-service-coverage-ratio/. All rights remain with the original publisher. Lender thresholds vary.
$md$,
 'Corporate Finance Institute', 'https://corporatefinanceinstitute.com/resources/commercial-lending/debt-service-coverage-ratio/', true, 'editorial', 'FinRatio Editorial'),

-- 3 ---------------------------------------------------------------------------
('interest-coverage-ratio-vs-dscr',
 'Interest coverage ratio vs DSCR: which one does your lender mean?',
 'Both ratios measure whether earnings can carry debt, but they cover different things. One looks only at interest; the other also counts loan repayments. A short guide to telling them apart.',
 $md$
Lenders and analysts use two cousins that are easy to mix up.

## Interest coverage ratio (ICR)
Also called **times interest earned**. It divides **EBIT (or EBITDA) by interest expense**.
- Below **1.0** means operating earnings cannot even cover the interest bill, so the business must dip into reserves or borrow more to pay it.
- The source describes a ratio under about **2.5x** as a warning sign.
- It also notes that EBITDA is often considered a better numerator than EBIT for this purpose, because depreciation is a non-cash cost.

## DSCR
DSCR divides the cash available by the **whole debt service, which includes principal repayment as well as interest**. (See our DSCR explainers for the formulas and thresholds.)

## The difference in one line
> **ICR asks, "Can you afford the interest?" DSCR asks, "Can you afford the interest *and* the repayments?"**

That is why a business can pass an interest-cover test and still fail on DSCR: a short-tenor loan with large instalments can swamp earnings even when interest alone looks small.

## Which to use
- Use **ICR** to judge how heavy the borrowing cost is.
- Use **DSCR** to judge whether the repayment *schedule* is realistic.
- When a bank quotes a minimum, check which of the two it means.

---
**Credit:** Summarised by FinRatio from Wikipedia, "Times interest earned" (text available under CC BY-SA): https://en.wikipedia.org/wiki/Times_interest_earned, together with Wikipedia's "Debt service coverage ratio" for the definition of debt service. Benchmarks vary by industry and lender.
$md$,
 'Wikipedia', 'https://en.wikipedia.org/wiki/Times_interest_earned', true, 'editorial', 'FinRatio Editorial'),

-- 4 ---------------------------------------------------------------------------
('how-banks-decide-your-working-capital-limit-nayak-turnover-method',
 'How banks decide your working capital limit: the turnover method',
 'RBI''s own FAQ explains that banks size working capital after appraising genuine needs, and describes the Nayak Committee''s turnover approach for small units. A plain-English summary.',
 $md$
When a small business asks a bank for a working capital limit, how does the bank decide the number? The Reserve Bank of India answers this in its public FAQs for borrowers.

## Banks must appraise genuine need
According to the RBI FAQ, banks have been advised to **sanction limits only after properly appraising the borrower's genuine working capital requirement**, taking into account the **business cycle** and the **short-term credit requirement**. In other words, the limit is meant to follow how your business actually operates, not a fixed rule of thumb.

## The turnover method for small units
The FAQ also refers to the **Nayak Committee** approach. For small-scale units, the working capital limit is computed on the basis of **at least 20% of the estimated turnover, for credit limits up to ₹5 crore**.

*Worked example (illustrative):* a unit expecting ₹2 crore of turnover would be looked at for a limit of roughly ₹40 lakh under this method (20% of ₹2 crore), subject to the bank's own appraisal.

## Banks have discretion
RBI also states that credit-related matters, including interest rates, have been **deregulated and are governed by each bank's own lending policy**. So two banks can reach different limits for the same business.

## What this means for you
- Prepare a **realistic turnover projection**: it is the starting point for the limit.
- Show your **operating cycle** (how long stock and receivables take to convert to cash); that is what justifies the need.
- Ask your bank which method it applies to your size band.

---
**Credit:** Summarised by FinRatio from the **Reserve Bank of India**'s public FAQs (Q7 on working capital assessment and Q10 on deregulation): https://www.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=966. The RBI's rules are updated from time to time; check the current RBI master directions and your bank's lending policy.
$md$,
 'Reserve Bank of India', 'https://www.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=966', true, 'editorial', 'FinRatio Editorial'),

-- 5 ---------------------------------------------------------------------------
('cma-report-seven-statements-and-why-banks-reject-them',
 'The CMA report: seven statements and why banks reject them',
 'A CMA (Credit Monitoring Arrangement) report is the financial pack most Indian banks ask for with a working capital proposal. What it contains, the three mistakes that get proposals bounced, and quick tips.',
 $md$
A **CMA report** (Credit Monitoring Arrangement) is the standard financial package banks in India use to assess a working capital or term loan proposal. A guide from Cred by Fastlegal sets out what it contains and where applications go wrong.

## What a complete CMA contains
The guide lists seven parts:
1. Operating statement (the profit and loss account)
2. Balance sheet analysis
3. Comparative statement of current assets and current liabilities
4. Maximum Permissible Bank Finance (MPBF) calculation
5. Fund flow statement
6. Ratio analysis
7. Fixed-asset details with depreciation schedules

## Three common reasons for rejection (per the guide)
1. **Historical figures don't match filed returns.** Banks cross-check your actuals against ITR and GST filings.
2. **MPBF errors.** The amount asked for is higher than the permissible ceiling the numbers support.
3. **Aggressive projections.** Growth assumptions above roughly 40% a year without a market reason raise doubts.

## Quick tips from the guide
- Use the **Indian Banks' Association (IBA) standard format**, which the guide says is accepted across banks.
- Show **actual financials for past years plus forward projections** (the guide suggests two years of actuals and five years of projections).
- Keep **DSCR at or above about 1.25 in every projected year**, which the guide describes as the minimum acceptable.
- Clearly label anything that is an estimate.

## A note of caution
Format and years required differ between banks and proposal sizes, so ask your relationship manager for the exact checklist before you build the pack.

*FinRatio's CMA generator turns a balance sheet upload into a draft CMA you can review and edit.*

---
**Credit:** Summarised by FinRatio from "How to Make a CMA Report for Bank Loan" by **Cred by Fastlegal (Fastlegal Technologies Private Limited)**, 2026: https://cred.fastlegal.in/blog/how-to-make-cma-report. All rights remain with the original publisher.
$md$,
 'Cred by Fastlegal', 'https://cred.fastlegal.in/blog/how-to-make-cma-report', true, 'editorial', 'FinRatio Editorial'),

-- 6 ---------------------------------------------------------------------------
('working-capital-ratios-current-quick-and-cash-conversion-cycle',
 'Working capital ratios made simple: current ratio, quick ratio and the cash conversion cycle',
 'Three numbers tell you whether your business can pay its short-term bills and how long cash stays locked in operations. Formulas, healthy ranges and the three levers that improve them.',
 $md$
Banks and owners both watch **working capital** closely. Three ratios give the quickest read.

## 1. Current ratio
**Current assets ÷ current liabilities.** It shows overall short-term solvency. The source treats roughly **1.5 to 2.0** as healthy, with the right level varying by industry.

## 2. Quick (acid-test) ratio
**(Current assets − inventory − prepaid expenses) ÷ current liabilities.** It removes stock, which can be slow to sell, so it shows liquidity you could use quickly. **Around or above 1.0** is the usual comfort level.

## 3. Cash conversion cycle (CCC)
**Days inventory outstanding + days sales outstanding − days payables outstanding.** It measures how many days cash stays tied up in operations. Shorter is healthier. The source notes benchmarks can run from negative (some e-commerce models) to **about 45–90 days for manufacturing**.

## Three levers to improve them
1. **Collect faster (lower DSO):** invoice promptly, set tighter terms, follow up automatically.
2. **Hold less stock (lower DIO):** rank items by value (ABC analysis) and order closer to demand.
3. **Use supplier credit responsibly (manage DPO):** stretch payments only within agreed and legal limits.

The source also recommends a **rolling 13-week cash forecast** to spot shortfalls early.

## Reading the ratios for a loan
Ranges are guides, not rules: a lender will compare you with your industry and its own policy. Run your own figures through FinRatio's current ratio and working capital calculators before you meet the bank.

---
**Credit:** Summarised by FinRatio from "Working Capital Management: Ratios, CCC Formula & Techniques" by **BUSY Infotech Pvt. Ltd.** (updated 5 August 2026): https://busy.in/accounting/working-capital-management-techniques-importance-and-ratios/. All rights remain with the original publisher.
$md$,
 'BUSY Infotech', 'https://busy.in/accounting/working-capital-management-techniques-importance-and-ratios/', true, 'editorial', 'FinRatio Editorial'),

-- 7 ---------------------------------------------------------------------------
('quora-discussions-on-dscr-and-msme-loans',
 'Learn more: Quora discussions on DSCR and MSME loans',
 'Quora has active question-and-answer threads on debt service coverage, interest cover and getting an MSME loan in India. A credited reading list; click through to read the answers.',
 $md$
Real people ask practical questions about lending on **Quora**, and experienced answerers reply. We have collected some of the most relevant threads below as a reading list.

> **How this works:** we link to each question and credit **Quora and the individual answerers**. We have **not reproduced, summarised or fact-checked** the answers. They are the opinions of their authors, so treat them as discussion rather than advice, and confirm anything important with your bank or a qualified professional.

## Debt service and coverage ratios
- [What is the debt service coverage ratio, and what is its importance?](https://www.quora.com/What-is-the-debt-service-coverage-ratio-and-what-is-its-importance)
- [What is debt service coverage ratio?](https://www.quora.com/What-is-debt-service-coverage-ratio)
- [What is the debt service ratio? How can we calculate it?](https://www.quora.com/What-is-the-debt-service-ratio-How-can-we-calculate-it)
- [Why are non-cash expenses added in earnings for a debt service while calculating a debt service coverage ratio, and not in the case of an interest coverage ratio?](https://www.quora.com/Why-are-non-cash-expenses-added-in-earnings-for-a-debt-service-while-calculating-a-debt-service-coverage-ratio-and-not-in-the-case-of-an-interest-coverage-ratio)
- [Why is EBITDA used instead of EBIT in the debt service coverage ratio?](https://www.quora.com/Why-is-Ebitda-used-instead-of-EBIT-in-the-debt-service-coverage-ratio)
- [What is the interest coverage ratio?](https://www.quora.com/What-is-the-interest-coverage-ratio)

## Getting an MSME loan in India
- [Who is eligible for an MSME loan in India?](https://www.quora.com/Who-is-eligible-for-an-MSME-loan-in-India)
- [What are the documents required for MSME loan?](https://www.quora.com/What-are-the-documents-required-for-MSME-loan)
- [How to get a collateral free loan under MSME](https://www.quora.com/How-do-you-get-a-collateral-free-loan-under-MSME)
- [What is a suggested CGTMSE loan?](https://www.quora.com/What-is-a-suggested-CGTMSE-loan)
- [Is a CIBIL score required for an MSME loan?](https://www.quora.com/Is-a-CIBIL-score-required-for-an-MSME-loan)

## Want the numbers worked out for you?
FinRatio's calculators (DSCR, ISCR, current ratio and more) apply these ratios to your own balance sheet, so you can see where you stand before you meet your lender.

---
**Credit:** All questions and answers belong to **Quora** and their respective authors: https://www.quora.com. FinRatio is not affiliated with Quora.
$md$,
 'Quora', 'https://www.quora.com/What-is-the-debt-service-coverage-ratio-and-what-is-its-importance', true, 'editorial', 'FinRatio Editorial')

on conflict (slug) do nothing;
