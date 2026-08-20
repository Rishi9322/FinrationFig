import { describe, it, expect } from "vitest"
import { computeCmaData } from "../cmaCalculations"
import { CmaParsedData } from "../cmaTypes"

// Two years of minimal data, second year with more cash, lower NWC growth and
// bank-covered current liabilities, to exercise the cashflow-quality path.
function minimalCma(): CmaParsedData {
  const zeros2 = [0, 0]
  return {
    company: "Test Co",
    unit: "Lakhs",
    years: ["FY23", "FY24"],
    yearTypes: ["Actual", "Actual"],
    operatingStatement: {
      grossSales: [1000, 1200], exportSales: zeros2, exciseDuty: zeros2, netSales: [1000, 1200],
      rawMaterials: { imported: zeros2, indigenous: [400, 480] },
      otherSpares: zeros2, powerFuel: zeros2, directLabour: zeros2,
      otherManufacturingExpenses: zeros2, depreciationManufacturing: [50, 55],
      costOfProduction: zeros2, openingStockFinishedGoods: zeros2, closingStockFinishedGoods: zeros2,
      totalCostOfSales: [700, 800], sellingAdminExpenses: [100, 110],
      operatingProfitBeforeInterest: zeros2, interestOnTL: zeros2, interestOnWC: zeros2,
      totalInterest: [30, 30], otherNonOperatingIncome: zeros2,
      profitBeforeTax: zeros2, provisionForTax: [20, 25], netProfit: [150, 165],
      dividend: zeros2, retainedProfit: zeros2,
    },
    balanceSheet: {
      currentLiabilities: {
        bankBorrowingsCC: [100, 90], bankBorrowingsOther: zeros2, totalBankBorrowings: [100, 90],
        shortTermOthers: zeros2, sundryCreditors: [80, 85], advanceFromCustomers: zeros2,
        provisionTaxGratuity: zeros2, dividendPayable: zeros2, tlInstalmentsWithin1Yr: [20, 20],
        otherCurrentLiabilities: zeros2, totalCurrentLiabilitiesExclBank: [100, 105],
        totalCurrentLiabilities: [200, 195],
      },
      termLiabilities: {
        debentures: zeros2, termLoansExclInstalment: [150, 130], deferredPaymentCredits: zeros2,
        unsecuredLoans: zeros2, totalTermLiabilities: [150, 130],
      },
      totalOutsideLiabilities: zeros2,
      netWorth: {
        ordinaryShareCapital: [100, 100], preferenceShareCapital: zeros2, generalReserve: zeros2,
        otherReserves: zeros2, surplusDeficitPL: [300, 400], totalNetWorth: [400, 500],
      },
      totalLiabilities: zeros2,
      currentAssets: {
        cashAndBank: [50, 90], shortTermInvestments: zeros2,
        tradeReceivablesDomestic: [150, 160], tradeReceivablesExport: zeros2,
        instalmentsOfDeferredReceivables: zeros2,
        rawMaterialStock: { imported: zeros2, indigenous: [100, 100] },
        stockInProcess: zeros2, finishedGoodsStock: zeros2, advanceToSuppliers: zeros2,
        advancePaymentOfTaxes: zeros2, otherCurrentAssets: zeros2,
        totalCurrentAssets: [300, 350],
      },
      fixedAssets: { grossBlock: [500, 520], depreciationToDate: [150, 200], netBlock: zeros2 },
      otherNonCurrentAssets: zeros2, totalNonCurrentAssets: zeros2, totalAssets: zeros2,
      tangibleNetWorth: zeros2, netWorkingCapital: zeros2,
    },
  }
}

describe("computeCmaData cashflow-quality ratios", () => {
  it("leaves the first year null (no prior year to diff against)", () => {
    const result = computeCmaData(minimalCma())
    expect(result.ratios.cashflowQuality[0]).toBeNull()
  })

  it("computes an approximate operating cashflow and quality ratios for later years", () => {
    const result = computeCmaData(minimalCma())
    const year2 = result.ratios.cashflowQuality[1]
    expect(year2).not.toBeNull()
    expect(typeof year2.operatingCashflowApprox).toBe("number")
    expect(year2.ncg).not.toBeNull()
    expect(year2.ocg).not.toBeNull()
    expect(year2.clcc).not.toBeNull()
    expect(year2.ocs).not.toBeNull()
    expect(year2.qpt).not.toBeNull()
  })
})
