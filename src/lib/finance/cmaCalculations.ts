import { CmaParsedData, CmaComputedData } from "./cmaTypes";

export function computeCmaData(parsed: CmaParsedData): CmaComputedData {
  const { operatingStatement, balanceSheet } = parsed;
  const numYears = parsed.years.length;
  
  // 1. Operating Statement Computations
  const costOfProduction = new Array(numYears).fill(0);
  const totalCostOfSales = new Array(numYears).fill(0);
  const operatingProfitBeforeInterest = new Array(numYears).fill(0);
  const profitBeforeTax = new Array(numYears).fill(0);
  const netProfit = new Array(numYears).fill(0);
  const retainedProfit = new Array(numYears).fill(0);

  for (let i = 0; i < numYears; i++) {
    costOfProduction[i] = 
      (operatingStatement.rawMaterials.imported[i] || 0) + 
      (operatingStatement.rawMaterials.indigenous[i] || 0) + 
      (operatingStatement.otherSpares[i] || 0) + 
      (operatingStatement.powerFuel[i] || 0) + 
      (operatingStatement.directLabour[i] || 0) + 
      (operatingStatement.otherManufacturingExpenses[i] || 0) + 
      (operatingStatement.depreciationManufacturing[i] || 0);

    totalCostOfSales[i] = 
      costOfProduction[i] + 
      (operatingStatement.openingStockFinishedGoods[i] || 0) - 
      (operatingStatement.closingStockFinishedGoods[i] || 0);

    operatingProfitBeforeInterest[i] = 
      (operatingStatement.netSales[i] || 0) - 
      totalCostOfSales[i] - 
      (operatingStatement.sellingAdminExpenses[i] || 0);

    profitBeforeTax[i] = 
      operatingProfitBeforeInterest[i] - 
      (operatingStatement.totalInterest[i] || 0) + 
      (operatingStatement.otherNonOperatingIncome[i] || 0);

    netProfit[i] = profitBeforeTax[i] - (operatingStatement.provisionForTax[i] || 0);
    retainedProfit[i] = netProfit[i] - (operatingStatement.dividend[i] || 0);
  }

  // 2. Balance Sheet Computations
  const totalBankBorrowings = new Array(numYears).fill(0);
  const totalCLExclBank = new Array(numYears).fill(0);
  const totalCLInclBank = new Array(numYears).fill(0);
  const totalTermLiabilities = new Array(numYears).fill(0);
  const totalOutsideLiabilities = new Array(numYears).fill(0);
  const netWorth = new Array(numYears).fill(0);
  const totalLiabilities = new Array(numYears).fill(0);
  const totalCA = new Array(numYears).fill(0);
  const netBlock = new Array(numYears).fill(0);
  const totalAssets = new Array(numYears).fill(0);
  const tangibleNetWorth = new Array(numYears).fill(0);
  const netWorkingCapital = new Array(numYears).fill(0);
  const currentRatio = new Array(numYears).fill(0);

  for (let i = 0; i < numYears; i++) {
    const cl = balanceSheet.currentLiabilities;
    totalBankBorrowings[i] = (cl.bankBorrowingsCC[i] || 0) + (cl.bankBorrowingsOther[i] || 0);
    
    totalCLExclBank[i] = 
      (cl.sundryCreditors[i] || 0) + 
      (cl.advanceFromCustomers[i] || 0) + 
      (cl.provisionTaxGratuity[i] || 0) + 
      (cl.dividendPayable[i] || 0) + 
      (cl.tlInstalmentsWithin1Yr[i] || 0) + 
      (cl.otherCurrentLiabilities[i] || 0);

    totalCLInclBank[i] = totalBankBorrowings[i] + totalCLExclBank[i];

    const tl = balanceSheet.termLiabilities;
    totalTermLiabilities[i] = 
      (tl.debentures[i] || 0) + 
      (tl.termLoansExclInstalment[i] || 0) + 
      (tl.deferredPaymentCredits[i] || 0) + 
      (tl.unsecuredLoans[i] || 0);

    totalOutsideLiabilities[i] = totalCLInclBank[i] + totalTermLiabilities[i];

    const nw = balanceSheet.netWorth;
    netWorth[i] = 
      (nw.ordinaryShareCapital[i] || 0) + 
      (nw.preferenceShareCapital[i] || 0) + 
      (nw.generalReserve[i] || 0) + 
      (nw.otherReserves[i] || 0) + 
      (nw.surplusDeficitPL[i] || 0);

    totalLiabilities[i] = totalOutsideLiabilities[i] + netWorth[i];

    const ca = balanceSheet.currentAssets;
    totalCA[i] = 
      (ca.cashAndBank[i] || 0) + 
      (ca.shortTermInvestments[i] || 0) + 
      (ca.tradeReceivablesDomestic[i] || 0) + 
      (ca.tradeReceivablesExport[i] || 0) + 
      (ca.rawMaterialStock.imported[i] || 0) + 
      (ca.rawMaterialStock.indigenous[i] || 0) + 
      (ca.stockInProcess[i] || 0) + 
      (ca.finishedGoodsStock[i] || 0) + 
      (ca.advanceToSuppliers[i] || 0) + 
      (ca.advancePaymentOfTaxes[i] || 0) + 
      (ca.otherCurrentAssets[i] || 0);

    const fa = balanceSheet.fixedAssets;
    netBlock[i] = (fa.grossBlock[i] || 0) - (fa.depreciationToDate[i] || 0);

    totalAssets[i] = totalCA[i] + netBlock[i] + (balanceSheet.otherNonCurrentAssets[i] || 0); // Need to adjust intangibles
    
    // Simplification for Tangible Net Worth (assuming no intangibles in input data yet)
    tangibleNetWorth[i] = netWorth[i] - 0; 

    netWorkingCapital[i] = totalCA[i] - totalCLInclBank[i];
    currentRatio[i] = totalCLInclBank[i] === 0 ? 0 : totalCA[i] / totalCLInclBank[i];
  }

  // 3. MPBF Computations (Tandon Method II)
  const wcg = new Array(numYears).fill(0);
  const minimumNWC = new Array(numYears).fill(0);
  const actualNWC = new Array(numYears).fill(0);
  const mpbfValue = new Array(numYears).fill(0);

  for (let i = 0; i < numYears; i++) {
    wcg[i] = totalCA[i] - totalCLExclBank[i];
    minimumNWC[i] = 0.25 * totalCA[i];
    actualNWC[i] = totalCA[i] - totalCLInclBank[i];
    const item6 = wcg[i] - minimumNWC[i];
    const item7 = wcg[i] - actualNWC[i];
    mpbfValue[i] = Math.min(item6, item7);
  }

  // 4. DSCR Computations
  const dscrNumerator = new Array(numYears).fill(0);
  const dscrDenominator = new Array(numYears).fill(0);
  const dscrRatio = new Array(numYears).fill(0);

  for (let i = 0; i < numYears; i++) {
    dscrNumerator[i] = netProfit[i] + (operatingStatement.depreciationManufacturing[i] || 0) + (operatingStatement.totalInterest[i] || 0);
    dscrDenominator[i] = (balanceSheet.currentLiabilities.tlInstalmentsWithin1Yr[i] || 0) + (operatingStatement.totalInterest[i] || 0);
    dscrRatio[i] = dscrDenominator[i] === 0 ? 0 : dscrNumerator[i] / dscrDenominator[i];
  }

  return {
    ratios: {
      currentRatio,
      tolToTNW: totalOutsideLiabilities.map((val, i) => tangibleNetWorth[i] === 0 ? 0 : val / tangibleNetWorth[i]),
    },
    mpbf: {
      totalCA,
      totalCLExclBank,
      wcg,
      minimumNWC,
      actualNWC,
      mpbfValue
    },
    dscr: {
      dscrNumerator,
      dscrDenominator,
      dscrRatio
    },
    repaymentSchedule: {},
    fixedAssets: {},
    financialPosition: {
      totalLiabilities,
      totalAssets,
      tangibleNetWorth,
      netWorkingCapital,
      costOfProduction,
      totalCostOfSales,
      operatingProfitBeforeInterest,
      profitBeforeTax,
      netProfit,
      retainedProfit
    }
  };
}
