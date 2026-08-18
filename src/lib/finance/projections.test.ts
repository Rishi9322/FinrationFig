import { describe, it, expect } from "vitest";
import { projectScenarios } from "./projections";
import type { CmaParsedData } from "./cmaTypes";

function makeParsed(overrides: Partial<CmaParsedData> = {}): CmaParsedData {
  const zeros = (n = 1) => new Array(n).fill(0);
  return {
    company: "Test Co",
    unit: "Rs. Lakhs",
    years: ["2024-25"],
    yearTypes: ["Actual"],
    operatingStatement: {
      grossSales: [1000], exportSales: zeros(), exciseDuty: zeros(), netSales: [1000],
      rawMaterials: { imported: zeros(), indigenous: zeros() }, otherSpares: zeros(),
      powerFuel: zeros(), directLabour: zeros(), otherManufacturingExpenses: zeros(),
      depreciationManufacturing: [20], costOfProduction: zeros(), openingStockFinishedGoods: zeros(),
      closingStockFinishedGoods: zeros(), totalCostOfSales: zeros(), sellingAdminExpenses: zeros(),
      operatingProfitBeforeInterest: zeros(), interestOnTL: zeros(), interestOnWC: zeros(),
      totalInterest: [30], otherNonOperatingIncome: zeros(), profitBeforeTax: zeros(),
      provisionForTax: zeros(), netProfit: [100], dividend: zeros(), retainedProfit: zeros(),
    },
    balanceSheet: {
      currentLiabilities: {
        bankBorrowingsCC: zeros(), bankBorrowingsOther: zeros(), totalBankBorrowings: zeros(),
        shortTermOthers: zeros(), sundryCreditors: zeros(), advanceFromCustomers: zeros(),
        provisionTaxGratuity: zeros(), dividendPayable: zeros(), tlInstalmentsWithin1Yr: [50],
        otherCurrentLiabilities: zeros(), totalCurrentLiabilitiesExclBank: zeros(), totalCurrentLiabilities: zeros(),
      },
      termLiabilities: { debentures: zeros(), termLoansExclInstalment: zeros(), deferredPaymentCredits: zeros(), unsecuredLoans: zeros(), totalTermLiabilities: zeros() },
      totalOutsideLiabilities: zeros(),
      netWorth: { ordinaryShareCapital: zeros(), preferenceShareCapital: zeros(), generalReserve: zeros(), otherReserves: zeros(), surplusDeficitPL: zeros(), totalNetWorth: zeros() },
      totalLiabilities: zeros(),
      currentAssets: {
        cashAndBank: zeros(), shortTermInvestments: zeros(), tradeReceivablesDomestic: zeros(), tradeReceivablesExport: zeros(),
        instalmentsOfDeferredReceivables: zeros(), rawMaterialStock: { imported: zeros(), indigenous: zeros() },
        stockInProcess: zeros(), finishedGoodsStock: zeros(), advanceToSuppliers: zeros(), advancePaymentOfTaxes: zeros(),
        otherCurrentAssets: zeros(), totalCurrentAssets: zeros(),
      },
      fixedAssets: { grossBlock: zeros(), depreciationToDate: zeros(), netBlock: zeros() },
      otherNonCurrentAssets: zeros(), totalNonCurrentAssets: zeros(), totalAssets: zeros(),
      tangibleNetWorth: zeros(), netWorkingCapital: zeros(),
    },
    ...overrides,
  };
}

describe("projectScenarios", () => {
  it("grows base case sales by the growth rate for 2 years", () => {
    const [, base] = projectScenarios(makeParsed(), { growthRate: 0.1, marginSwing: 0.02, growthSwing: 0.05 });
    expect(base.scenario).toBe("base");
    expect(base.years[0].netSales).toBeCloseTo(1100, 5);
    expect(base.years[1].netSales).toBeCloseTo(1210, 5);
  });

  it("orders best > base > worst on year-2 net profit", () => {
    const [best, base, worst] = projectScenarios(makeParsed(), { growthRate: 0.1, marginSwing: 0.02, growthSwing: 0.05 });
    expect(best.years[1].netProfit).toBeGreaterThan(base.years[1].netProfit);
    expect(base.years[1].netProfit).toBeGreaterThan(worst.years[1].netProfit);
  });

  it("computes DSCR against the flat base-year debt service", () => {
    const [, base] = projectScenarios(makeParsed(), { growthRate: 0, marginSwing: 0, growthSwing: 0 });
    // netProfit stays 100 (0% growth, margin unchanged at 10%), debtService = 50 (instalment) + 30 (interest) = 80
    // dscr = (100 + 20 depreciation + 30 interest) / 80
    expect(base.years[0].dscr).toBeCloseTo((100 + 20 + 30) / 80, 5);
  });

  it("throws when there are no years to project from", () => {
    expect(() => projectScenarios(makeParsed({ years: [], yearTypes: [] }), { growthRate: 0.1, marginSwing: 0, growthSwing: 0 })).toThrow();
  });
});
