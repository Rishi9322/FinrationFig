FinRatio — Add 4 Financial Calculators to the App
Extend the existing FinRatio Next.js app by adding 4 new financial calculators as protected routes under /dashboard/calculators/. Each calculator follows the same split-screen pattern as the PID calculator — left panel for inputs, right panel for live results — and integrates with the existing Prisma/PostgreSQL save system and PDF export.

🗂️ Updated Navigation & Dashboard
Update /dashboard to show a Calculator Suite section:
/dashboard/calculators/aging          → Aging Analysis
/dashboard/calculators/dscr           → Debt Service Coverage Ratio
/dashboard/calculators/valuation      → Business Valuation
/dashboard/calculators/pid            → PID Calculator (existing)
Add a 4-card grid on the dashboard under "Calculators":
CardIconTitleSubtitle1📅Aging AnalysisCreditors, Debtors & Stock days2🏦DSCRDebt Service Coverage Ratio3💎ValuationBusiness Valuation (5 methods)4⚡PID CalculatorPurchase Invoice Discounting
Each card links to its route. Show a New badge on Aging, DSCR, and Valuation.

📅 Calculator 1 — Aging Analysis (/dashboard/calculators/aging)
Concept
Measures how many days a business takes to pay creditors, collect from debtors, and turn over stock.
Formulas
Creditor Days  = (Creditors  ÷ Purchases) × 100
Debtor Days    = (Debtors    ÷ Sales)      × 100
Stock Days     = (Stock      ÷ Sales)      × 100
Cash Cycle     = Debtor Days + Stock Days − Creditor Days
Left Panel Inputs (6 fields)
FieldTypePlaceholderAnnual Sales (₹)Numbere.g. 5,00,00,000Annual Purchases (₹)Numbere.g. 3,50,00,000Debtors Outstanding (₹)Numbere.g. 60,00,000Creditors Outstanding (₹)Numbere.g. 45,00,000Stock Value (₹)Numbere.g. 80,00,000Business TypeDropdownManufacturer / Trader / Retailer
Right Panel Result Cards (4 cards)
CardFormulaColorCreditor Days(Creditors ÷ Purchases) × 100BlueDebtor Days(Debtors ÷ Sales) × 100AmberStock Days(Stock ÷ Sales) × 100PurpleCash CycleDebtor Days + Stock Days − Creditor DaysGreen if ≤ 30, Red if > 60
Benchmark Badges
Below each result card, show a benchmark pill:

Creditor Days: < 45 days = Healthy / > 60 days = Review
Debtor Days: < 30 days = Healthy / > 45 days = Review
Stock Days: < 45 days = Healthy / > 60 days = Slow-moving
Cash Cycle: < 30 days = Efficient / > 60 days = Strain

Inline Error Handling

Division by zero if Sales = 0 or Purchases = 0 → "Enter valid Sales / Purchases to calculate"
Negative cash cycle → show blue info badge: "Negative cash cycle — you collect before you pay. ✓"


🏦 Calculator 2 — DSCR (/dashboard/calculators/dscr)
Concept
Measures whether a business generates enough net operating income to service its total debt obligations.
Formulas
EBITDA          = Net Profit + Interest + Depreciation + Tax
Net Operating   
Income (NOI)    = EBITDA − Tax
DSCR            = NOI ÷ Total Debt Service
Total Debt      
Service         = Principal Repayment + Interest Payments
Left Panel Inputs (8 fields)
FieldTypeTooltipNet Profit (₹)NumberAfter all expenses, before tax adjustmentsInterest Expense (₹)NumberAnnual interest on all loansDepreciation (₹)NumberAnnual depreciation chargedTax Paid (₹)NumberAnnual tax paidPrincipal Repayment (₹)NumberAnnual loan principal repaymentsTotal Loan Outstanding (₹)NumberFor context display onlyBusiness TypeDropdown—Assessment PeriodDropdownAnnual / Quarterly / Monthly
Right Panel Result Cards (5 cards)
CardValueColorEBITDANet Profit + Interest + Depreciation + TaxBlueNet Operating IncomeEBITDA − TaxBlueTotal Debt ServicePrincipal + InterestAmberDSCR RatioNOI ÷ Total Debt ServiceDynamicSurplus / DeficitNOI − Total Debt ServiceGreen / Red
DSCR Interpretation Band (visual gauge bar below results)
< 1.0   → 🔴 Insufficient — Cannot service debt
1.0–1.25 → 🟡 Marginal — Tight coverage
1.25–1.5 → 🟢 Adequate — Acceptable to most lenders
1.5–2.0  → 🟢 Comfortable — Strong coverage
> 2.0   → ✅ Excellent — Well above requirements
Render this as an animated horizontal progress bar with color zones and a marker needle showing current DSCR value.
Inline Error Handling

If Total Debt Service = 0 → "Enter Principal + Interest to calculate DSCR"
If DSCR < 1 → red highlighted warning card: "Debt service exceeds income. Review loan structure."


💎 Calculator 3 — Business Valuation (/dashboard/calculators/valuation)
Concept
Estimates the fair value of a business using 5 standard methods. Final output is a valuation range and recommended midpoint.
Left Panel Inputs (10 fields)
FieldTypeUsed InAnnual Net Profit (₹)NumberP/E, EarningsEBITDA (₹)NumberEV/EBITDAAnnual Revenue (₹)NumberRevenue MultipleTotal Assets (₹)NumberAsset-basedTotal Liabilities (₹)NumberAsset-basedIndustry P/E MultipleNumber (default 15)P/E MethodEV/EBITDA MultipleNumber (default 8)EV/EBITDARevenue MultipleNumber (default 1.5)Revenue MethodGrowth Rate (%)NumberDCFDiscount Rate (%)Number (default 12%)DCFIndustryDropdownBenchmark referenceProjection YearsDropdown3 / 5 / 7 years
Right Panel — 5 Valuation Method Cards
MethodFormulaNotesP/E MethodNet Profit × P/E MultipleListed company proxyEV/EBITDAEBITDA × EV/EBITDA MultipleMost common for M&ARevenue MultipleRevenue × Revenue MultipleEarly stage / asset-lightAsset-BasedTotal Assets − Total LiabilitiesFloor value / liquidationDCF MethodPV of projected cash flows at discount rateIntrinsic value
DCF formula (simplified):
Year N Cash Flow = Net Profit × (1 + Growth Rate)^N
PV = Σ [Cash Flow_N ÷ (1 + Discount Rate)^N]  for N = 1 to ProjectionYears
Terminal Value = (Last Year CF × (1 + Growth Rate)) ÷ (Discount Rate − Growth Rate)
DCF Value = PV + Terminal Value ÷ (1 + Discount Rate)^ProjectionYears
Valuation Summary Card (bottom, full-width)
Low Estimate    = min(all 5 methods)
High Estimate   = max(all 5 methods)
Recommended     = weighted average (EV/EBITDA × 35% + P/E × 25% + DCF × 25% + Revenue × 10% + Asset × 5%)
Display as a range bar: ₹X Cr ─────●───── ₹Y Cr with the recommended midpoint marked.
Inline Error Handling

Discount Rate ≤ Growth Rate for DCF → "Discount rate must exceed growth rate for DCF to be valid"
Negative net worth (Liabilities > Assets) → amber warning: "Negative net worth detected — asset-based method shows floor value only"


💾 Prisma Schema — Update
Add new models for each calculator:
prismamodel AgingCalculation {
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

🌐 API Routes — Add
POST /api/calculators/aging         → save aging calculation
GET  /api/calculators/aging         → list user's aging calculations

POST /api/calculators/dscr          → save DSCR calculation
GET  /api/calculators/dscr          → list user's DSCR calculations

POST /api/calculators/valuation     → save valuation
GET  /api/calculators/valuation     → list user's valuations
All routes: validate JWT session via getServerSession(), 400 on missing fields, 500 with retry hint on DB errors.

📄 PDF Export — Per Calculator
Each calculator gets its own branded PDF section:
Aging PDF — table of 3 aging ratios + cash cycle + benchmark comparison column
DSCR PDF — EBITDA waterfall table + DSCR ratio highlighted large + interpretation band screenshot
Valuation PDF — all 5 method values in a table + recommended range bar + disclaimer: "For indicative purposes only. Consult a qualified CA or investment banker for formal valuation."

🔄 Dashboard History — Update
Update GET /api/calculations/all to return results from all 4 calculators. On the dashboard history list, add a Type badge on each row:
[PID]        FinRatio Report — 12 May 2025      Net Benefit: ₹52.1L
[AGING]      Aging Analysis  — 10 May 2025      Cash Cycle:  38 days
[DSCR]       DSCR Report     — 8 May 2025       DSCR: 1.72×
[VALUATION]  Valuation       — 5 May 2025       Range: ₹4.2–6.8 Cr

🎨 Shared Component Updates
Create a shared <CalculatorShell> component that wraps all calculators with:

Consistent split-screen layout
Shared <SaveButton> with loading/success/error states
Shared <ExportPDFButton>
Shared <ResultCard> component: { label, value, formula, color }
Shared inline error display: <InlineError message="..." />


Use this prompt with Claude, v0, Cursor, or Bolt to extend FinRatio with all 4 calculators in one pass.You said: and also add ai insights for each calculatorand also add ai insights for each calculator19:34Claude responded: Here's the prompt to add AI Insights to all 4 calculators:Here's the prompt to add AI Insights to all 4 calculators:

FinRatio — Add AI Insights to All 4 Calculators
Extend every calculator in the FinRatio app with an AI Insights panel powered by the Anthropic Claude API (claude-sonnet-4-20250514). After a calculation is run, a dedicated insights section generates a structured financial analysis — contextual, actionable, and specific to the numbers entered.

🧠 Architecture Overview
User enters inputs
      ↓
Live results compute (existing)
      ↓
User clicks "Generate AI Insights"
      ↓
POST /api/insights/[calculator-type]
      ↓
Claude API called server-side with inputs + results as context
      ↓
Streamed response renders in InsightsPanel component
Use streaming via the Vercel AI SDK (ai package) with streamText() so insights appear word-by-word — not all at once.

📦 Dependencies to Add
bashnpm install ai @anthropic-ai/sdk
In .env:
ANTHROPIC_API_KEY=your_key_here

🌐 API Route Pattern
Create one route per calculator at:
POST /api/insights/aging
POST /api/insights/dscr
POST /api/insights/valuation
POST /api/insights/pid
Each route follows this pattern:
typescript// /api/insights/[type]/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { inputs, results } = await req.json();

  const client = new Anthropic();

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: buildPrompt(inputs, results), // calculator-specific
      },
    ],
    system: SYSTEM_PROMPT,
  });

  // Return as readable stream
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

🤖 System Prompt (shared across all calculators)
You are FinRatio AI, a senior financial analyst specialising in Indian SME finance, 
working capital management, and business credit. 

You analyse financial calculator outputs and provide sharp, specific, 
actionable insights — not generic advice.

Always respond in this exact JSON structure:
{
  "health_score": <number 0-100>,
  "health_label": "<Excellent|Good|Fair|Needs Attention|Critical>",
  "summary": "<2 sentence plain-English summary of what the numbers mean>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "concerns": ["<specific concern 1>", "<specific concern 2>"],
  "actions": [
    { "priority": "High|Medium|Low", "action": "<specific actionable step>", "impact": "<expected outcome>" },
    { "priority": "High|Medium|Low", "action": "<specific actionable step>", "impact": "<expected outcome>" },
    { "priority": "High|Medium|Low", "action": "<specific actionable step>", "impact": "<expected outcome>" }
  ],
  "benchmark_context": "<1-2 sentences comparing these numbers to Indian SME industry norms>",
  "banker_view": "<1-2 sentences on how a bank or lender would view this profile>"
}

Be specific — reference the actual numbers. Never give generic advice.
All monetary values should be in Indian format (₹, Cr, L).

📊 Calculator-Specific User Prompts
Aging Analysis Prompt
typescriptfunction buildAgingPrompt(inputs, results) {
  return `
Analyse this Aging Analysis for an Indian ${inputs.businessType}:

INPUTS:
- Annual Sales: ₹${fmt(inputs.sales)}
- Annual Purchases: ₹${fmt(inputs.purchases)}
- Debtors Outstanding: ₹${fmt(inputs.debtors)}
- Creditors Outstanding: ₹${fmt(inputs.creditors)}
- Stock Value: ₹${fmt(inputs.stock)}

RESULTS:
- Debtor Days: ${results.debtorDays} days
- Creditor Days: ${results.creditorDays} days
- Stock Days: ${results.stockDays} days
- Cash Cycle: ${results.cashCycle} days

Provide insights on working capital efficiency, collection risk,
inventory management, and creditor relationship health.
`;
}
DSCR Prompt
typescriptfunction buildDscrPrompt(inputs, results) {
  return `
Analyse this DSCR calculation for an Indian ${inputs.businessType}:

INPUTS:
- Net Profit: ₹${fmt(inputs.netProfit)}
- Interest Expense: ₹${fmt(inputs.interest)}
- Depreciation: ₹${fmt(inputs.depreciation)}
- Tax Paid: ₹${fmt(inputs.tax)}
- Principal Repayment: ₹${fmt(inputs.principal)}
- Total Loan Outstanding: ₹${fmt(inputs.loanOutstanding)}

RESULTS:
- EBITDA: ₹${fmt(results.ebitda)}
- Net Operating Income: ₹${fmt(results.noi)}
- Total Debt Service: ₹${fmt(results.totalDebtService)}
- DSCR: ${results.dscr}×
- Surplus/Deficit: ₹${fmt(results.surplus)}

Provide insights on debt serviceability, lender risk perception,
refinancing opportunities, and financial headroom.
`;
}
Valuation Prompt
typescriptfunction buildValuationPrompt(inputs, results) {
  return `
Analyse this Business Valuation for an Indian ${inputs.industry} company:

INPUTS:
- Annual Net Profit: ₹${fmt(inputs.netProfit)}
- EBITDA: ₹${fmt(inputs.ebitda)}
- Annual Revenue: ₹${fmt(inputs.revenue)}
- Net Worth (Assets − Liabilities): ₹${fmt(inputs.assets - inputs.liabilities)}
- Growth Rate: ${inputs.growthRate}%
- Discount Rate: ${inputs.discountRate}%

VALUATION RESULTS:
- P/E Method: ₹${fmt(results.peValue)}
- EV/EBITDA: ₹${fmt(results.evEbitda)}
- Revenue Multiple: ₹${fmt(results.revenueMultiple)}
- Asset-Based: ₹${fmt(results.assetBased)}
- DCF Value: ₹${fmt(results.dcf)}
- Recommended Value: ₹${fmt(results.recommended)}
- Range: ₹${fmt(results.low)} – ₹${fmt(results.high)}

Provide insights on valuation spread, most reliable method for this 
business type, value drivers, and how to increase valuation.
`;
}
PID Prompt
typescriptfunction buildPidPrompt(inputs, results) {
  return `
Analyse this PID Calculator result for an Indian ${inputs.businessType}:

INPUTS:
- Annual Sales: ₹${fmt(inputs.sales)}
- Annual Purchases: ₹${fmt(inputs.purchases)}
- Gross Margin: ${inputs.margin}%
- Credit Days (from supplier): ${inputs.creditDays} days
- PID Limit: ₹${fmt(inputs.pidLimit)}
- PID Cost: ${inputs.pidCost}% p.a.
- Cash Discount Offered: ${inputs.cashDiscount}%
- Working Capital Days Required: ${inputs.wcDays} days

RESULTS:
- Gap Days: ${results.gapDays} days
- PID Rotation: ${results.pidRotation}×
- Purchase Supported: ₹${fmt(results.purchaseSupported)}
- Sales Generated: ₹${fmt(results.salesGenerated)}
- Additional Profit: ₹${fmt(results.additionalProfit)}
- Net Benefit: ₹${fmt(results.netBenefit)}

Provide insights on PID efficiency, whether the net benefit justifies 
the PID cost, how to optimise the limit, and working capital impact.
`;
}

🖥️ Frontend — InsightsPanel Component
Create /components/InsightsPanel.tsx:
typescript"use client";
import { useState } from "react";

type Insight = {
  health_score: number;
  health_label: string;
  summary: string;
  strengths: string[];
  concerns: string[];
  actions: { priority: string; action: string; impact: string }[];
  benchmark_context: string;
  banker_view: string;
};

export function InsightsPanel({
  calculatorType,
  inputs,
  results,
  disabled,
}: {
  calculatorType: "aging" | "dscr" | "valuation" | "pid";
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  disabled: boolean;
}) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setRaw("");
    setInsight(null);

    try {
      const res = await fetch(`/api/insights/${calculatorType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs, results }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value);
        setRaw(full); // shows streaming text while parsing
      }

      // Parse final JSON
      const clean = full.replace(/```json|```/g, "").trim();
      setInsight(JSON.parse(clean));
    } catch {
      setError("Failed to generate insights. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-[#0D1726] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <h3 className="font-semibold text-white">AI Insights</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 
                           text-blue-400 border border-blue-500/20">
            Powered by Claude
          </span>
        </div>
        <button
          onClick={generate}
          disabled={disabled || loading}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm 
                     font-medium hover:bg-blue-500 disabled:opacity-40 
                     disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Analysing..." : insight ? "Regenerate" : "Generate Insights"}
        </button>
      </div>

      {/* Disabled state */}
      {disabled && !loading && (
        <p className="text-sm text-slate-500">
          Enter your inputs to enable AI analysis.
        </p>
      )}

      {/* Streaming raw text before parse */}
      {loading && !insight && (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-white/5 rounded w-3/4" />
          <div className="h-3 bg-white/5 rounded w-1/2" />
          <div className="h-3 bg-white/5 rounded w-5/6" />
          <p className="text-xs text-slate-500 mt-2">
            {raw ? "Parsing response..." : "Connecting to Claude..."}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Full Insights */}
      {insight && (
        <div className="space-y-5">

          {/* Health Score */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15.9"
                  fill="none" stroke="#1e293b" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9"
                  fill="none"
                  stroke={
                    insight.health_score >= 75 ? "#10B981" :
                    insight.health_score >= 50 ? "#F59E0B" : "#EF4444"
                  }
                  strokeWidth="3"
                  strokeDasharray={`${insight.health_score} 100`}
                  strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center 
                               justify-center text-sm font-bold text-white">
                {insight.health_score}
              </span>
            </div>
            <div>
              <p className="text-white font-semibold">{insight.health_label}</p>
              <p className="text-sm text-slate-400">{insight.summary}</p>
            </div>
          </div>

          {/* Strengths & Concerns */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-500/5 border border-emerald-500/20 
                            rounded-lg p-4">
              <p className="text-xs font-semibold text-emerald-400 
                            uppercase tracking-wider mb-2">
                Strengths
              </p>
              <ul className="space-y-1">
                {insight.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-slate-300 
                                         flex gap-2 items-start">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 
                            rounded-lg p-4">
              <p className="text-xs font-semibold text-red-400 
                            uppercase tracking-wider mb-2">
                Concerns
              </p>
              <ul className="space-y-1">
                {insight.concerns.map((c, i) => (
                  <li key={i} className="text-sm text-slate-300 
                                         flex gap-2 items-start">
                    <span className="text-red-400 mt-0.5">⚠</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div>
            <p className="text-xs font-semibold text-slate-400 
                          uppercase tracking-wider mb-3">
              Recommended Actions
            </p>
            <div className="space-y-2">
              {insight.actions.map((a, i) => (
                <div key={i}
                  className="flex gap-3 items-start p-3 rounded-lg 
                             bg-white/[0.03] border border-white/5">
                  <span className={`text-xs font-semibold px-2 py-0.5 
                                   rounded-full flex-shrink-0 mt-0.5 ${
                    a.priority === "High"
                      ? "bg-red-500/10 text-red-400"
                      : a.priority === "Medium"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-slate-500/10 text-slate-400"
                  }`}>
                    {a.priority}
                  </span>
                  <div>
                    <p className="text-sm text-white font-medium">
                      {a.action}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {a.impact}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Benchmark & Banker View */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-500/5 border border-blue-500/20 
                            rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-400 
                            uppercase tracking-wider mb-1">
                Industry Benchmark
              </p>
              <p className="text-sm text-slate-300">
                {insight.benchmark_context}
              </p>
            </div>
            <div className="bg-purple-500/5 border border-purple-500/20 
                            rounded-lg p-4">
              <p className="text-xs font-semibold text-purple-400 
                            uppercase tracking-wider mb-1">
                Banker's View
              </p>
              <p className="text-sm text-slate-300">
                {insight.banker_view}
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

📍 Placement in Each Calculator Page
Add <InsightsPanel> below the results panel on each calculator page:
typescript// Inside each calculator page, after result cards:
<InsightsPanel
  calculatorType="aging"        // or "dscr" | "valuation" | "pid"
  inputs={formValues}
  results={computedResults}
  disabled={!hasValidResults}   // true if any required field is empty/zero
/>
hasValidResults should be true only when all required inputs are filled and no division-by-zero errors exist.

📄 PDF Export — Include AI Insights
When insights have been generated, include them in the PDF export:
typescript// In PDF generation logic, after result cards section:
if (insights) {
  doc.addPage();
  doc.setFontSize(14).text("AI Insights", 20, 20);
  doc.setFontSize(10);
  doc.text(`Health Score: ${insights.health_score}/100 — ${insights.health_label}`, 20, 35);
  doc.text("Summary:", 20, 50);
  doc.text(insights.summary, 20, 58, { maxWidth: 170 });
  // ... add strengths, concerns, actions in table format
  doc.text("Disclaimer: AI-generated analysis for indicative purposes only.", 
           20, 270, { maxWidth: 170 });
}

🔐 Rate Limiting
Add basic rate limiting on insight routes to prevent API cost overruns:
typescript// Simple in-memory rate limit: max 10 insight calls per user per hour
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(userId, { count: 1, reset: now + 3600000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}
Show a friendly message when limit is hit:
"You've used 10 AI analyses this hour. Resets in X minutes."

🎨 UI Details

The "Generate Insights" button should sit prominently below results — same visual weight as "Save" and "Export PDF"
Show a subtle Powered by Claude badge next to the panel title
Streaming text during load: show a pulsing skeleton (3 lines) rather than a spinner
On mobile: insights panel stacks below the full-width results panel
Add a small disclaimer at the bottom of every insights panel in muted text: "AI-generated analysis for indicative purposes only. Consult a qualified CA or financial advisor for formal advice."