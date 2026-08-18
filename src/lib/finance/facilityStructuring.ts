import type { CmaParsedData, CmaComputedData } from "./cmaTypes";

// ponytail: annual-period amortization (EMI treated as one annual instalment,
// not monthly compounding) - close enough for sizing/screening, not for a
// disbursement schedule. Upgrade path: switch to monthly compounding once
// this feeds an actual sanction letter rather than a what-if exploration.

export interface McbfSuggestion {
  year: string;
  mpbfValue: number;
}

/** Surfaces the MPBF already computed by cmaCalculations.ts (Tandon Method II) for the latest year - no new math, just picking the number out. */
export function suggestMpbfLimit(parsed: CmaParsedData, computed: CmaComputedData): McbfSuggestion | null {
  const lastIndex = parsed.years.length - 1;
  if (lastIndex < 0) return null;
  return { year: parsed.years[lastIndex], mpbfValue: computed.mpbf.mpbfValue[lastIndex] };
}

function annualEmi(principal: number, rate: number, tenureYears: number): number {
  if (tenureYears <= 0) return principal;
  if (rate === 0) return principal / tenureYears;
  return (principal * rate) / (1 - Math.pow(1 + rate, -tenureYears));
}

function maxPrincipalForEmi(emi: number, rate: number, tenureYears: number): number {
  if (tenureYears <= 0) return 0;
  if (rate === 0) return emi * tenureYears;
  return (emi * (1 - Math.pow(1 + rate, -tenureYears))) / rate;
}

export interface TermLoanSizing {
  annualCashAccrual: number;
  existingDebtService: number;
  maxAnnualEmi: number;
  maxLoanAmount: number;
}

/**
 * Max term loan a business can service at a target DSCR, given its current
 * cash accrual and existing debt service. Same accrual/debt-service
 * convention as the DSCR calc in cmaCalculations.ts, so results line up with
 * the ratios shown elsewhere in the app.
 */
export function sizeTermLoan(
  parsed: CmaParsedData,
  computed: CmaComputedData,
  params: { interestRate: number; tenureYears: number; targetDscr: number }
): TermLoanSizing {
  const lastIndex = parsed.years.length - 1;
  const accrual = computed.dscr.dscrNumerator[lastIndex] || 0;
  const existingDebtService = computed.dscr.dscrDenominator[lastIndex] || 0;

  const maxAnnualEmi = Math.max(0, accrual / params.targetDscr - existingDebtService);
  const maxLoanAmount = maxPrincipalForEmi(maxAnnualEmi, params.interestRate, params.tenureYears);

  return { annualCashAccrual: accrual, existingDebtService, maxAnnualEmi, maxLoanAmount };
}

export interface TenureRow {
  tenureYears: number;
  annualEmi: number;
  projectedDscr: number;
}

/** For a fixed proposed loan amount, shows EMI and resulting DSCR across tenure options. */
export function tenureSensitivity(
  parsed: CmaParsedData,
  computed: CmaComputedData,
  params: { loanAmount: number; interestRate: number; tenureOptions: number[] }
): TenureRow[] {
  const lastIndex = parsed.years.length - 1;
  const accrual = computed.dscr.dscrNumerator[lastIndex] || 0;
  const existingDebtService = computed.dscr.dscrDenominator[lastIndex] || 0;

  return params.tenureOptions.map((tenureYears) => {
    const emi = annualEmi(params.loanAmount, params.interestRate, tenureYears);
    const totalDebtService = existingDebtService + emi;
    const projectedDscr = totalDebtService === 0 ? 0 : accrual / totalDebtService;
    return { tenureYears, annualEmi: emi, projectedDscr };
  });
}
