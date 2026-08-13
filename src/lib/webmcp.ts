// WebMCP — exposes the calculators as tools to browser AI agents.
// Spec: https://github.com/webmachinelearning/webmcp
// No-ops in browsers that don't implement document.modelContext.
import {
  calculateDebtEquity,
  calculateQuasiDebtEquity,
  calculateCurrentRatio,
  calculateDSCR,
  calculateEBITDA,
  calculateISCR,
  calculateNetWorkingCapital,
  calculateDrawingPower,
  calculateWorkingCapitalCycles,
  calculateValuation,
  type CalculationResult,
} from "./financialCalculations"

type Tool = {
  name: string
  description: string
  args: [name: string, description: string][]
  run: (a: Record<string, number>) => CalculationResult
}

const TOOLS: Tool[] = [
  {
    name: "calculate-debt-equity",
    description: "Debt-to-equity ratio: leverage of a business, with a risk rating.",
    args: [["totalDebt", "Total debt"], ["totalEquity", "Total equity (must be non-zero)"]],
    run: (a) => calculateDebtEquity(a.totalDebt, a.totalEquity),
  },
  {
    name: "calculate-quasi-debt-equity",
    description: "Debt-to-equity ratio including quasi-debt (unsecured loans treated as debt).",
    args: [["totalDebt", "Total debt"], ["quasiDebt", "Quasi-debt"], ["equity", "Equity (must be non-zero)"]],
    run: (a) => calculateQuasiDebtEquity(a.totalDebt, a.quasiDebt, a.equity),
  },
  {
    name: "calculate-current-ratio",
    description: "Current ratio: short-term liquidity of a business.",
    args: [["currentAssets", "Current assets"], ["currentLiabilities", "Current liabilities (must be non-zero)"]],
    run: (a) => calculateCurrentRatio(a.currentAssets, a.currentLiabilities),
  },
  {
    name: "calculate-dscr",
    description: "Debt Service Coverage Ratio: ability to service debt from operating income.",
    args: [["netOperatingIncome", "Net operating income"], ["totalDebtService", "Total debt service (must be non-zero)"]],
    run: (a) => calculateDSCR(a.netOperatingIncome, a.totalDebtService),
  },
  {
    name: "calculate-ebitda",
    description: "EBITDA and EBITDA margin from profit, depreciation, finance cost and sales.",
    args: [["profit", "Net profit"], ["depreciation", "Depreciation"], ["financeCost", "Finance cost"], ["sales", "Sales / revenue"]],
    run: (a) => calculateEBITDA(a.profit, a.depreciation, a.financeCost, a.sales),
  },
  {
    name: "calculate-iscr",
    description: "Interest Service Coverage Ratio: ability to cover interest from EBIT.",
    args: [["ebit", "EBIT"], ["interestExpense", "Interest expense (must be non-zero)"]],
    run: (a) => calculateISCR(a.ebit, a.interestExpense),
  },
  {
    name: "calculate-net-working-capital",
    description: "Net working capital: current assets minus current liabilities.",
    args: [["currentAssets", "Current assets"], ["currentLiabilities", "Current liabilities"]],
    run: (a) => calculateNetWorkingCapital(a.currentAssets, a.currentLiabilities),
  },
  {
    name: "calculate-drawing-power",
    description: "Drawing power for a cash-credit limit from eligible stock and receivables after margin.",
    args: [["eligibleStock", "Eligible stock"], ["eligibleReceivables", "Eligible receivables"], ["marginPercent", "Margin percent (0-100)"]],
    run: (a) => calculateDrawingPower(a.eligibleStock, a.eligibleReceivables, a.marginPercent),
  },
  {
    name: "calculate-working-capital-cycle",
    description: "Working capital cycle in days from creditors, debtors, stock, sales and purchases.",
    args: [["creditors", "Creditors"], ["debtors", "Debtors"], ["stock", "Stock"], ["sales", "Sales (must be non-zero)"], ["purchases", "Purchases (must be non-zero)"]],
    run: (a) => calculateWorkingCapitalCycles(a.creditors, a.debtors, a.stock, a.sales, a.purchases),
  },
  {
    name: "calculate-business-valuation",
    description: "Business valuation from EBITDA and an industry multiple.",
    args: [["ebitda", "EBITDA"], ["multiple", "Valuation multiple"]],
    run: (a) => calculateValuation(a.ebitda, a.multiple),
  },
]

function toolDescriptor(tool: Tool) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(
        tool.args.map(([name, description]) => [name, { type: "number", description }])
      ),
      required: tool.args.map(([name]) => name),
    },
    async execute(args: Record<string, number>) {
      try {
        const r = tool.run(args)
        return {
          content: [
            {
              type: "text",
              text: `${r.formatted} — ${r.interpretation} (risk: ${r.risk})${r.details ? `\n${r.details}` : ""}`,
            },
          ],
        }
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
          isError: true,
        }
      }
    },
  }
}

export function registerWebMcpTools() {
  const ctx = (document as unknown as { modelContext?: { registerTool(t: unknown): Promise<unknown> } })
    .modelContext
  if (!ctx?.registerTool) return
  for (const tool of TOOLS) {
    // Registration is per-tool and independent; a rejection must not stop the rest.
    Promise.resolve(ctx.registerTool(toolDescriptor(tool))).catch(() => {})
  }
}
