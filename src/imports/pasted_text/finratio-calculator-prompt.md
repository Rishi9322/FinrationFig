Here's a comprehensive prompt to add all 4 calculators to the FinRatio web store:

---

**FinRatio — Add 4 Financial Calculators to the App**

Extend the existing FinRatio Next.js app by adding **4 new financial calculators** as protected routes under `/dashboard/calculators/`. Each calculator follows the same split-screen pattern as the PID calculator — left panel for inputs, right panel for live results — and integrates with the existing Prisma/PostgreSQL save system and PDF export.

---

### 🗂️ Updated Navigation & Dashboard

Update `/dashboard` to show a **Calculator Suite** section:

```
/dashboard/calculators/aging          → Aging Analysis
/dashboard/calculators/dscr           → Debt Service Coverage Ratio
/dashboard/calculators/valuation      → Business Valuation
/dashboard/calculators/pid            → PID Calculator (existing)
```

Add a **4-card grid** on the dashboard under "Calculators":

| Card | Icon | Title | Subtitle |
|------|------|-------|----------|
| 1 | 📅 | Aging Analysis | Creditors, Debtors & Stock days |
| 2 | 🏦 | DSCR | Debt Service Coverage Ratio |
| 3 | 💎 | Valuation | Business Valuation (5 methods) |
| 4 | ⚡ | PID Calculator | Purchase Invoice Discounting |

Each card links to its route. Show a `New` badge on Aging, DSCR, and Valuation.

---

### 📅 Calculator 1 — Aging Analysis (`/dashboard/calculators/aging`)

#### Concept
Measures how many days a business takes to pay creditors, collect from debtors, and turn over stock.

#### Formulas
```
Creditor Days  = (Creditors  ÷ Purchases) × 100
Debtor Days    = (Debtors    ÷ Sales)      × 100
Stock Days     = (Stock      ÷ Sales)      × 100
Cash Cycle     = Debtor Days + Stock Days − Creditor Days
```

#### Left Panel Inputs (6 fields)

| Field | Type | Placeholder |
|-------|------|-------------|
| Annual Sales (₹) | Number | e.g. 5,00,00,000 |
| Annual Purchases (₹) | Number | e.g. 3,50,00,000 |
| Debtors Outstanding (₹) | Number | e.g. 60,00,000 |
| Creditors Outstanding (₹) | Number | e.g. 45,00,000 |
| Stock Value (₹) | Number | e.g. 80,00,000 |
| Business Type | Dropdown | Manufacturer / Trader / Retailer |

#### Right Panel Result Cards (4 cards)

| Card | Formula | Color |
|------|---------|-------|
| Creditor Days | `(Creditors ÷ Purchases) × 100` | Blue |
| Debtor Days | `(Debtors ÷ Sales) × 100` | Amber |
| Stock Days | `(Stock ÷ Sales) × 100` | Purple |
| Cash Cycle | `Debtor Days + Stock Days − Creditor Days` | Green if ≤ 30, Red if > 60 |

#### Benchmark Badges
Below each result card, show a benchmark pill:
- Creditor Days: `< 45 days = Healthy` / `> 60 days = Review`
- Debtor Days: `< 30 days = Healthy` / `> 45 days = Review`
- Stock Days: `< 45 days = Healthy` / `> 60 days = Slow-moving`
- Cash Cycle: `< 30 days = Efficient` / `> 60 days = Strain`

#### Inline Error Handling
- Division by zero if Sales = 0 or Purchases = 0 → `"Enter valid Sales / Purchases to calculate"`
- Negative cash cycle → show blue info badge: `"Negative cash cycle — you collect before you pay. ✓"`

---

### 🏦 Calculator 2 — DSCR (`/dashboard/calculators/dscr`)

#### Concept
Measures whether a business generates enough net operating income to service its total debt obligations.

#### Formulas
```
EBITDA          = Net Profit + Interest + Depreciation + Tax
Net Operating   
Income (NOI)    = EBITDA − Tax
DSCR            = NOI ÷ Total Debt Service
Total Debt      
Service         = Principal Repayment + Interest Payments
```

#### Left Panel Inputs (8 fields)

| Field | Type | Tooltip |
|-------|------|---------|
| Net Profit (₹) | Number | After all expenses, before tax adjustments |
| Interest Expense (₹) | Number | Annual interest on all loans |
| Depreciation (₹) | Number | Annual depreciation charged |
| Tax Paid (₹) | Number | Annual tax paid |
| Principal Repayment (₹) | Number | Annual loan principal repayments |
| Total Loan Outstanding (₹) | Number | For context display only |
| Business Type | Dropdown | — |
| Assessment Period | Dropdown | Annual / Quarterly / Monthly |

#### Right Panel Result Cards (5 cards)

| Card | Value | Color |
|------|-------|-------|
| EBITDA | Net Profit + Interest + Depreciation + Tax | Blue |
| Net Operating Income | EBITDA − Tax | Blue |
| Total Debt Service | Principal + Interest | Amber |
| **DSCR Ratio** | NOI ÷ Total Debt Service | **Dynamic** |
| Surplus / Deficit | NOI − Total Debt Service | Green / Red |

#### DSCR Interpretation Band (visual gauge bar below results)

```
< 1.0   → 🔴 Insufficient — Cannot service debt
1.0–1.25 → 🟡 Marginal — Tight coverage
1.25–1.5 → 🟢 Adequate — Acceptable to most lenders
1.5–2.0  → 🟢 Comfortable — Strong coverage
> 2.0   → ✅ Excellent — Well above requirements
```

Render this as an animated horizontal progress bar with color zones and a marker needle showing current DSCR value.

#### Inline Error Handling
- If Total Debt Service = 0 → `"Enter Principal + Interest to calculate DSCR"`
- If DSCR < 1 → red highlighted warning card: `"Debt service exceeds income. Review loan structure."`

---

### 💎 Calculator 3 — Business Valuation (`/dashboard/calculators/valuation`)

#### Concept
Estimates the fair value of a business using 5 standard methods. Final output is a valuation range and recommended midpoint.

#### Left Panel Inputs (10 fields)

| Field | Type | Used In |
|-------|------|---------|
| Annual Net Profit (₹) | Number | P/E, Earnings |
| EBITDA (₹) | Number | EV/EBITDA |
| Annual Revenue (₹) | Number | Revenue Multiple |
| Total Assets (₹) | Number | Asset-based |
| Total Liabilities (₹) | Number | Asset-based |
| Industry P/E Multiple | Number (default 15) | P/E Method |
| EV/EBITDA Multiple | Number (default 8) | EV/EBITDA |
| Revenue Multiple | Number (default 1.5) | Revenue Method |
| Growth Rate (%) | Number | DCF |
| Discount Rate (%) | Number (default 12%) | DCF |
| Industry | Dropdown | Benchmark reference |
| Projection Years | Dropdown | 3 / 5 / 7 years |

#### Right Panel — 5 Valuation Method Cards

| Method | Formula | Notes |
|--------|---------|-------|
| **P/E Method** | Net Profit × P/E Multiple | Listed company proxy |
| **EV/EBITDA** | EBITDA × EV/EBITDA Multiple | Most common for M&A |
| **Revenue Multiple** | Revenue × Revenue Multiple | Early stage / asset-light |
| **Asset-Based** | Total Assets − Total Liabilities | Floor value / liquidation |
| **DCF Method** | PV of projected cash flows at discount rate | Intrinsic value |

DCF formula (simplified):
```
Year N Cash Flow = Net Profit × (1 + Growth Rate)^N
PV = Σ [Cash Flow_N ÷ (1 + Discount Rate)^N]  for N = 1 to ProjectionYears
Terminal Value = (Last Year CF × (1 + Growth Rate)) ÷ (Discount Rate − Growth Rate)
DCF Value = PV + Terminal Value ÷ (1 + Discount Rate)^ProjectionYears
```

#### Valuation Summary Card (bottom, full-width)
```
Low Estimate    = min(all 5 methods)
High Estimate   = max(all 5 methods)
Recommended     = weighted average (EV/EBITDA × 35% + P/E × 25% + DCF × 25% + Revenue × 10% + Asset × 5%)
```

Display as a **range bar**: `₹X Cr ─────●───── ₹Y Cr` with the recommended midpoint marked.

#### Inline Error Handling
- Discount Rate ≤ Growth Rate for DCF → `"Discount rate must exceed growth rate for DCF to be valid"`
- Negative net worth (Liabilities > Assets) → amber warning: `"Negative net worth detected — asset-based method shows floor value only"`

---

### 💾 Prisma Schema — Update

Add new models for each calculator:

```prisma
model AgingCalculation {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  businessType String
  inputs       Json
  results      Json
  createdAt    DateTime @default(now())
}

model DscrCalculation {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  businessType String
  inputs       Json
  results      Json
  createdAt    DateTime @default(now())
}

model ValuationCalculation {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  industry     String
  inputs       Json
  results      Json
  createdAt    DateTime @default(now())
}
```

---

### 🌐 API Routes — Add

```
POST /api/calculators/aging         → save aging calculation
GET  /api/calculators/aging         → list user's aging calculations

POST /api/calculators/dscr          → save DSCR calculation
GET  /api/calculators/dscr          → list user's DSCR calculations

POST /api/calculators/valuation     → save valuation
GET  /api/calculators/valuation     → list user's valuations
```

All routes: validate JWT session via `getServerSession()`, 400 on missing fields, 500 with retry hint on DB errors.

---

### 📄 PDF Export — Per Calculator

Each calculator gets its own branded PDF section:

**Aging PDF** — table of 3 aging ratios + cash cycle + benchmark comparison column

**DSCR PDF** — EBITDA waterfall table + DSCR ratio highlighted large + interpretation band screenshot

**Valuation PDF** — all 5 method values in a table + recommended range bar + disclaimer: `"For indicative purposes only. Consult a qualified CA or investment banker for formal valuation."`

---

### 🔄 Dashboard History — Update

Update `GET /api/calculations/all` to return results from all 4 calculators. On the dashboard history list, add a **Type badge** on each row:

```
[PID]        FinRatio Report — 12 May 2025      Net Benefit: ₹52.1L
[AGING]      Aging Analysis  — 10 May 2025      Cash Cycle:  38 days
[DSCR]       DSCR Report     — 8 May 2025       DSCR: 1.72×
[VALUATION]  Valuation       — 5 May 2025       Range: ₹4.2–6.8 Cr
```

---

### 🎨 Shared Component Updates

Create a shared `<CalculatorShell>` component that wraps all calculators with:
- Consistent split-screen layout
- Shared `<SaveButton>` with loading/success/error states
- Shared `<ExportPDFButton>`
- Shared `<ResultCard>` component: `{ label, value, formula, color }`
- Shared inline error display: `<InlineError message="..." />`

---

Use this prompt with **Claude**, **v0**, **Cursor**, or **Bolt** to extend FinRatio with all 4 calculators in one pass.