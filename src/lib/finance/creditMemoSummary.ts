export type RiskLevel = "high" | "moderate" | "low" | null;

export interface MemoSummary {
  riskLevel: RiskLevel;
  recommendation: string | null;
  ccLimit: string | null;
  tlLimit: string | null;
}

// The model writes a fixed-heading memo (see the prompt in lib/ai/openrouter.ts),
// so a few targeted regexes over its own labels are enough to surface the
// answer without a second AI call.
export function extractMemoSummary(text: string): MemoSummary {
  const lower = text.toLowerCase();

  let riskLevel: RiskLevel = null;
  if (/(?:credit )?risk rating:\s*high/.test(lower)) riskLevel = "high";
  else if (/(?:credit )?risk rating:\s*moderate/.test(lower)) riskLevel = "moderate";
  else if (/(?:credit )?risk rating:\s*low/.test(lower)) riskLevel = "low";

  const recommendationMatch = text.match(/-\s*(APPROVE WITH CONDITIONS|APPROVE|DECLINE)\b/i);
  const ccMatch = text.match(/Recommended CC[^:]*:\s*₹?\s*([\d,.]+)\s*Lakhs?/i);
  const tlMatch = text.match(/Term Loan eligibility:\s*₹?\s*([\d,.]+)\s*Lakhs?/i);

  return {
    riskLevel,
    recommendation: recommendationMatch?.[1]?.toUpperCase() ?? null,
    ccLimit: ccMatch?.[1] ?? null,
    tlLimit: tlMatch?.[1] ?? null,
  };
}

export function riskLevelColor(level: RiskLevel): string {
  if (level === "high") return "#EF4444";
  if (level === "moderate") return "#F59E0B";
  if (level === "low") return "#22C55E";
  return "#64748B";
}
