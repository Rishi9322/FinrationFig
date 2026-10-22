import { BalanceSheetReport } from "../../components/calculators/BalanceSheetReport"
import { sampleParsed } from "../../../lib/__fixtures__/sampleParsed"
import "../../../styles/balanceSheetReport.css"

// Dev-only preview of the assessment report with made-up figures (see routes.tsx).
export default function ReportSamplePage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <BalanceSheetReport parsed={sampleParsed} businessConstitution="Private Limited" />
    </div>
  )
}
