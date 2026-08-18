import { describe, it, expect } from "vitest";
import { findAnomalies } from "./anomalies";
import type { CmaParsedData } from "./cmaTypes";

function baseParsed(): CmaParsedData {
  const z2 = () => [0, 0];
  return {
    company: "Test Co", unit: "Rs. Lakhs", years: ["Y1", "Y2"], yearTypes: ["Actual", "Actual"],
    operatingStatement: {
      grossSales: [1000, 1100], exportSales: z2(), exciseDuty: z2(), netSales: [1000, 1100],
      rawMaterials: { imported: z2(), indigenous: z2() }, otherSpares: z2(), powerFuel: z2(),
      directLabour: z2(), otherManufacturingExpenses: z2(), depreciationManufacturing: z2(),
      costOfProduction: z2(), openingStockFinishedGoods: z2(), closingStockFinishedGoods: z2(),
      totalCostOfSales: z2(), sellingAdminExpenses: z2(), operatingProfitBeforeInterest: z2(),
      interestOnTL: z2(), interestOnWC: z2(), totalInterest: z2(), otherNonOperatingIncome: z2(),
      profitBeforeTax: z2(), provisionForTax: z2(), netProfit: [100, 110], dividend: z2(), retainedProfit: z2(),
    },
    balanceSheet: {
      currentLiabilities: {
        bankBorrowingsCC: z2(), bankBorrowingsOther: z2(), totalBankBorrowings: [100, 100],
        shortTermOthers: z2(), sundryCreditors: z2(), advanceFromCustomers: z2(), provisionTaxGratuity: z2(),
        dividendPayable: z2(), tlInstalmentsWithin1Yr: z2(), otherCurrentLiabilities: z2(),
        totalCurrentLiabilitiesExclBank: z2(), totalCurrentLiabilities: [200, 210],
      },
      termLiabilities: { debentures: z2(), termLoansExclInstalment: z2(), deferredPaymentCredits: z2(), unsecuredLoans: z2(), totalTermLiabilities: [50, 50] },
      totalOutsideLiabilities: z2(),
      netWorth: { ordinaryShareCapital: z2(), preferenceShareCapital: z2(), generalReserve: z2(), otherReserves: z2(), surplusDeficitPL: z2(), totalNetWorth: z2() },
      totalLiabilities: [500, 550],
      currentAssets: {
        cashAndBank: z2(), shortTermInvestments: z2(), tradeReceivablesDomestic: [100, 110], tradeReceivablesExport: z2(),
        instalmentsOfDeferredReceivables: z2(), rawMaterialStock: { imported: z2(), indigenous: z2() },
        stockInProcess: z2(), finishedGoodsStock: z2(), advanceToSuppliers: z2(), advancePaymentOfTaxes: z2(),
        otherCurrentAssets: z2(), totalCurrentAssets: z2(),
      },
      fixedAssets: { grossBlock: z2(), depreciationToDate: z2(), netBlock: z2() },
      otherNonCurrentAssets: z2(), totalNonCurrentAssets: z2(), totalAssets: [500, 550],
      tangibleNetWorth: z2(), netWorkingCapital: z2(),
    },
  };
}

describe("findAnomalies", () => {
  it("finds nothing on a clean, proportionate year", () => {
    expect(findAnomalies(baseParsed())).toEqual([]);
  });

  it("flags a balance sheet mismatch", () => {
    const p = baseParsed();
    p.balanceSheet.totalLiabilities = [500, 600]; // vs totalAssets [500, 550]
    const found = findAnomalies(p);
    expect(found.some((a) => a.message.includes("does not match"))).toBe(true);
  });

  it("flags a receivables spike disproportionate to sales", () => {
    const p = baseParsed();
    p.balanceSheet.currentAssets.tradeReceivablesDomestic = [100, 250]; // +150% vs 10% sales growth
    const found = findAnomalies(p);
    expect(found.some((a) => a.message.includes("receivables"))).toBe(true);
  });

  it("flags debt growth outpacing flat sales", () => {
    const p = baseParsed();
    p.operatingStatement.netSales = [1000, 1010]; // ~1% growth
    p.balanceSheet.termLiabilities.totalTermLiabilities = [50, 100]; // +100%
    const found = findAnomalies(p);
    expect(found.some((a) => a.message.includes("Debt grew"))).toBe(true);
  });

  it("flags margin compression", () => {
    const p = baseParsed();
    p.operatingStatement.netProfit = [100, 60]; // margin 10% -> 5.5%
    const found = findAnomalies(p);
    expect(found.some((a) => a.message.includes("PAT margin fell"))).toBe(true);
  });
});
