import React from "react"
import BalanceSheetUpload from "@/app/components/BalanceSheetUpload"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { useAuth } from "@/app/hooks/useAuth"

export default function BalanceSheetAnalysisPage() {
  const { user } = useAuth()
  const userId = user?.id

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Balance Sheet Analysis</h1>
        <p className="text-gray-600">
          Upload your balance sheet in any format (Excel, CSV, PDF, Image) and automatically
          calculate key financial ratios and metrics.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Balance Sheet</CardTitle>
            <CardDescription>
              Supported formats: CSV, JSON, Excel (XLSX), PDF, DOCX, PNG, JPG
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BalanceSheetUpload userId={userId} />
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>Supported Calculators</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>
                <strong>Debt-to-Equity:</strong> Measures financial leverage and risk
              </li>
              <li>
                <strong>Current Ratio:</strong> Assesses short-term liquidity
              </li>
              <li>
                <strong>EBITDA:</strong> Operating profitability and margin analysis
              </li>
              <li>
                <strong>Net Working Capital:</strong> Operational flexibility
              </li>
              <li>
                <strong>DSCR (Debt Service Coverage):</strong> Ability to service debt
              </li>
              <li>
                <strong>And more...</strong> Quasi-debt, ISCR, Drawing Power, Ageing, PID, Valuation
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li>
                <strong>1. Upload</strong> - Choose a file (Excel, PDF, CSV, Image, etc.)
              </li>
              <li>
                <strong>2. Parse</strong> - System automatically extracts data and normalizes it
              </li>
              <li>
                <strong>3. Map</strong> - Intelligent heuristics map data to the selected calculator
              </li>
              <li>
                <strong>4. Calculate</strong> - Run financial analysis with risk assessment
              </li>
              <li>
                <strong>5. Save</strong> - Results stored in your account with full audit trail
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h2 className="font-semibold mb-2">🎯 Multi-Format Support</h2>
                <p className="text-gray-600">
                  Upload balance sheets in any format and the system intelligently extracts data
                </p>
              </div>
              <div>
                <h2 className="font-semibold mb-2">🤖 Auto-Classification</h2>
                <p className="text-gray-600">
                  AI-powered heuristics automatically categorize assets, liabilities, and equity
                </p>
              </div>
              <div>
                <h2 className="font-semibold mb-2">📊 Multiple Calculators</h2>
                <p className="text-gray-600">
                  Run any of 12+ financial ratio and metric calculators
                </p>
              </div>
              <div>
                <h2 className="font-semibold mb-2">📈 Risk Assessment</h2>
                <p className="text-gray-600">
                  Get actionable risk levels (Low/Moderate/High) for each metric
                </p>
              </div>
              <div>
                <h2 className="font-semibold mb-2">💾 Full History</h2>
                <p className="text-gray-600">
                  All calculations saved with inputs, outputs, and confidence scores
                </p>
              </div>
              <div>
                <h2 className="font-semibold mb-2">🔐 Secure</h2>
                <p className="text-gray-600">
                  Data encrypted and stored in Supabase with user isolation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
