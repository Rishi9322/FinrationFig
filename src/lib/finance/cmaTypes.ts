export interface CmaParsedData {
  company: string;
  unit: string;
  years: string[];
  yearTypes: string[];
  operatingStatement: {
    grossSales: number[];
    exportSales: number[];
    exciseDuty: number[];
    netSales: number[];
    rawMaterials: { imported: number[]; indigenous: number[] };
    otherSpares: number[];
    powerFuel: number[];
    directLabour: number[];
    otherManufacturingExpenses: number[];
    depreciationManufacturing: number[];
    costOfProduction: number[];
    openingStockFinishedGoods: number[];
    closingStockFinishedGoods: number[];
    totalCostOfSales: number[];
    sellingAdminExpenses: number[];
    operatingProfitBeforeInterest: number[];
    interestOnTL: number[];
    interestOnWC: number[];
    totalInterest: number[];
    otherNonOperatingIncome: number[];
    profitBeforeTax: number[];
    provisionForTax: number[];
    netProfit: number[];
    dividend: number[];
    retainedProfit: number[];
  };
  balanceSheet: {
    currentLiabilities: {
      bankBorrowingsCC: number[];
      bankBorrowingsOther: number[];
      totalBankBorrowings: number[];
      shortTermOthers: number[];
      sundryCreditors: number[];
      advanceFromCustomers: number[];
      provisionTaxGratuity: number[];
      dividendPayable: number[];
      tlInstalmentsWithin1Yr: number[];
      otherCurrentLiabilities: number[];
      totalCurrentLiabilitiesExclBank: number[];
      totalCurrentLiabilities: number[];
    };
    termLiabilities: {
      debentures: number[];
      termLoansExclInstalment: number[];
      deferredPaymentCredits: number[];
      unsecuredLoans: number[];
      totalTermLiabilities: number[];
    };
    totalOutsideLiabilities: number[];
    netWorth: {
      ordinaryShareCapital: number[];
      preferenceShareCapital: number[];
      generalReserve: number[];
      otherReserves: number[];
      surplusDeficitPL: number[];
      totalNetWorth: number[];
    };
    totalLiabilities: number[];
    currentAssets: {
      cashAndBank: number[];
      shortTermInvestments: number[];
      tradeReceivablesDomestic: number[];
      tradeReceivablesExport: number[];
      instalmentsOfDeferredReceivables: number[];
      rawMaterialStock: { imported: number[]; indigenous: number[] };
      stockInProcess: number[];
      finishedGoodsStock: number[];
      advanceToSuppliers: number[];
      advancePaymentOfTaxes: number[];
      otherCurrentAssets: number[];
      totalCurrentAssets: number[];
    };
    fixedAssets: {
      grossBlock: number[];
      depreciationToDate: number[];
      netBlock: number[];
    };
    otherNonCurrentAssets: number[];
    totalNonCurrentAssets: number[];
    totalAssets: number[];
    tangibleNetWorth: number[];
    netWorkingCapital: number[];
  };
}

export interface CmaComputedData {
  ratios: any;
  mpbf: any;
  dscr: any;
  repaymentSchedule: any;
  fixedAssets: any;
  financialPosition: any;
}
