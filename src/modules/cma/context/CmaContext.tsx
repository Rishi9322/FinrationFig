import React, { createContext, useContext, useState, useMemo } from 'react';
import { CmaParsedData, CmaComputedData } from '../../../lib/finance/cmaTypes';
import { computeCmaData } from '../../../lib/finance/cmaCalculations';
import type { DocumentClassification } from '../../../lib/ai/openrouter';

interface CmaState {
  parsedData: CmaParsedData | null;
  computedData: CmaComputedData | null;
  activeTab: number;
  isLoading: boolean;
  creditOpinion: string;
  isStreaming: boolean;
  balanceCheck: { isBalanced: boolean; differences?: number[] };
  classification: DocumentClassification | null;
  sourceMeta: { sourceName: string | null; sourceFormat: string };
}

interface CmaContextType extends CmaState {
  setParsedData: (data: CmaParsedData) => void;
  setActiveTab: (tab: number) => void;
  setIsLoading: (loading: boolean) => void;
  setCreditOpinion: (opinion: string | ((prev: string) => string)) => void;
  setIsStreaming: (streaming: boolean) => void;
  setClassification: (classification: DocumentClassification | null) => void;
  setSourceMeta: (meta: { sourceName: string | null; sourceFormat: string }) => void;
  loadSampleData: () => void;
  loadSavedDocument: (saved: { parsedData: CmaParsedData; creditOpinion?: string; classification?: DocumentClassification | null; sourceName?: string | null; sourceFormat?: string }) => void;
}

const CmaContext = createContext<CmaContextType | undefined>(undefined);

export function CmaProvider({ children }: { children: React.ReactNode }) {
  const [parsedData, setParsedDataState] = useState<CmaParsedData | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [creditOpinion, setCreditOpinion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [classification, setClassification] = useState<DocumentClassification | null>(null);
  const [sourceMeta, setSourceMeta] = useState<{ sourceName: string | null; sourceFormat: string }>({ sourceName: null, sourceFormat: "txt" });

  const computedData = useMemo(() => {
    if (!parsedData) return null;
    try {
      return computeCmaData(parsedData);
    } catch (e) {
      console.error("Computation error", e);
      return null;
    }
  }, [parsedData]);

  const balanceCheck = useMemo(() => {
    if (!parsedData) return { isBalanced: true };
    const numYears = parsedData.years.length;
    let isBalanced = true;
    const differences: number[] = [];
    
    for (let i = 0; i < numYears; i++) {
      const diff = Math.abs((parsedData.balanceSheet.totalAssets[i] || 0) - (parsedData.balanceSheet.totalLiabilities[i] || 0));
      differences.push(diff);
      if (diff > 1) { // 1 lakh tolerance
        isBalanced = false;
      }
    }
    return { isBalanced, differences };
  }, [parsedData]);

  const setParsedData = (data: CmaParsedData) => {
    setParsedDataState(data);
  };

  const loadSampleData = () => {
    const sample: CmaParsedData = {
      company: "M/s. Spar Coats and Polymers",
      unit: "₹ Lakhs",
      years: ["2024-25", "2025-26", "2026-27", "2027-28", "2028-29", "2029-30", "2030-31", "2031-32", "2032-33"],
      yearTypes: ["Actual", "Provisional", "Projected", "Projected", "Projected", "Projected", "Projected", "Projected", "Projected"],
      operatingStatement: {
        grossSales: [443.18, 935.81, 1500, 1750, 2000, 2250, 2500, 2750, 3000],
        exportSales: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        exciseDuty: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        netSales: [443.18, 935.81, 1500, 1750, 2000, 2250, 2500, 2750, 3000],
        rawMaterials: {
          imported: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          indigenous: [245.06, 631.83, 975, 1150, 1300, 1450, 1625, 1800, 1975]
        },
        otherSpares: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        powerFuel: [8.45, 25.51, 30, 35, 40, 45, 50, 55, 60],
        directLabour: [73.52, 160.54, 175, 200, 225, 250, 275, 300, 325],
        otherManufacturingExpenses: [2.37, 2.99, 3.5, 4, 4.5, 5, 5.5, 6, 6.5],
        depreciationManufacturing: [6.72, 9.39, 23.982, 20.385, 17.327, 14.728, 12.519, 10.641, 9.045],
        costOfProduction: [336.12, 830.26, 1207.48, 1414.38, 1586.83, 1764.73, 1968.02, 2171.64, 2375.54],
        openingStockFinishedGoods: [10.75, 23.56, 200.15, 225, 250, 275, 300, 325, 350],
        closingStockFinishedGoods: [23.56, 200.15, 225, 250, 275, 300, 325, 350, 375],
        totalCostOfSales: [323.31, 653.67, 1182.63, 1389.38, 1561.83, 1739.73, 1943.02, 2146.64, 2350.54],
        sellingAdminExpenses: [72.05, 164.04, 170, 210, 275, 325, 350, 375, 400],
        operatingProfitBeforeInterest: [47.82, 118.10, 147.37, 150.62, 163.17, 185.27, 206.98, 228.36, 249.46],
        interestOnTL: [14.67, 44.28, 35.14, 23.71, 10.02, 5.14, 3.86, 2.57, 1.29], // Placeholder split
        interestOnWC: [15, 15, 15, 15, 15, 15, 15, 15, 15],
        totalInterest: [29.67, 59.28, 50.14, 38.715, 25.020, 20.144, 18.859, 17.574, 16.289],
        otherNonOperatingIncome: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        profitBeforeTax: [18.15, 58.82, 97.23, 111.90, 138.15, 165.13, 188.12, 210.79, 233.17],
        provisionForTax: [5.91, 17.65, 29.168, 35.070, 41.446, 49.538, 56.437, 63.236, 69.950],
        netProfit: [12.24, 41.17, 68.06, 76.83, 96.71, 115.59, 131.69, 147.55, 163.22],
        dividend: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        retainedProfit: [12.24, 41.17, 68.06, 76.83, 96.71, 115.59, 131.69, 147.55, 163.22]
      },
      balanceSheet: {
        currentLiabilities: {
          bankBorrowingsCC: [0, 0, 125, 125, 125, 125, 125, 125, 125],
          bankBorrowingsOther: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          totalBankBorrowings: [0, 0, 125, 125, 125, 125, 125, 125, 125],
          shortTermOthers: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          sundryCreditors: [11.93, 120.54, 25, 25, 25, 25, 25, 25, 25],
          advanceFromCustomers: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          provisionTaxGratuity: [0, 17.65, 29.168, 35.070, 41.446, 49.538, 56.437, 63.236, 69.950],
          dividendPayable: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          tlInstalmentsWithin1Yr: [0, 0, 73.01, 45.30, 10.71, 10.71, 10.71, 10.71, 10.74],
          otherCurrentLiabilities: [5.91, 0, 2.5, 3, 3.5, 4, 4.5, 5, 5.5],
          totalCurrentLiabilitiesExclBank: [17.84, 138.19, 129.68, 108.37, 80.66, 89.25, 96.65, 103.95, 111.19],
          totalCurrentLiabilities: [17.84, 138.19, 254.68, 233.37, 205.66, 214.25, 221.65, 228.95, 236.19]
        },
        termLiabilities: {
          debentures: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          termLoansExclInstalment: [151.91, 167.68, 169.67, 150.24, 101.36, 32.16, 21.45, 10.74, 0],
          deferredPaymentCredits: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          unsecuredLoans: [0, 55, 55, 55, 55, 55, 55, 55, 55],
          totalTermLiabilities: [151.91, 222.68, 224.67, 205.24, 156.36, 87.16, 76.45, 65.74, 55]
        },
        totalOutsideLiabilities: [169.75, 360.87, 479.35, 438.61, 362.02, 301.41, 298.10, 294.69, 291.19],
        netWorth: {
          ordinaryShareCapital: [21.21, 33.45, 106.35, 174.41, 256.24, 352.95, 468.53, 600.22, 747.77],
          preferenceShareCapital: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          generalReserve: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          otherReserves: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          surplusDeficitPL: [12.24, 41.17, 68.06, 81.83, 96.71, 115.59, 131.69, 147.55, 163.22],
          totalNetWorth: [33.45, 74.62, 174.41, 256.24, 352.95, 468.54, 600.22, 747.77, 910.99]
        },
        totalLiabilities: [203.20, 435.49, 653.76, 694.85, 714.97, 769.95, 898.32, 1042.46, 1202.18],
        currentAssets: {
          cashAndBank: [36.18, 47.22, 5.36, 1.33, 3.28, 2.48, 2.88, 2.16, 0.42],
          shortTermInvestments: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          tradeReceivablesDomestic: [86.27, 120.46, 275, 315, 325, 370, 485, 615, 760],
          tradeReceivablesExport: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          instalmentsOfDeferredReceivables: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          rawMaterialStock: { imported: [0, 0, 0, 0, 0, 0, 0, 0, 0], indigenous: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
          stockInProcess: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          finishedGoodsStock: [23.56, 200.15, 225, 250, 275, 300, 325, 350, 375],
          advanceToSuppliers: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          advancePaymentOfTaxes: [0, 0, 0, 0, 0, 0, 0, 0, 0],
          otherCurrentAssets: [3.59, 6.89, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5],
          totalCurrentAssets: [149.60, 374.72, 512.86, 574.83, 612.78, 682.98, 824.38, 979.66, 1148.92]
        },
        fixedAssets: {
          grossBlock: [57.32, 62.66, 169.27, 169.27, 169.27, 169.27, 169.27, 169.27, 169.27],
          depreciationToDate: [6.72, 9.39, 33.37, 53.76, 71.08, 85.81, 98.33, 108.97, 118.02],
          netBlock: [50.60, 53.27, 135.90, 115.51, 98.19, 83.46, 70.94, 60.30, 51.25]
        },
        otherNonCurrentAssets: [3, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5],
        totalNonCurrentAssets: [53.60, 60.77, 143.40, 123.01, 105.69, 90.96, 78.44, 67.80, 58.75],
        totalAssets: [203.20, 435.49, 656.26, 697.84, 718.47, 773.94, 902.82, 1047.46, 1207.67],
        tangibleNetWorth: [33.45, 74.62, 174.41, 256.24, 352.95, 468.54, 600.22, 747.77, 910.99],
        netWorkingCapital: [131.76, 236.53, 258.18, 341.46, 407.12, 468.73, 602.73, 750.71, 912.73]
      }
    };
    setParsedDataState(sample);
  };

  const loadSavedDocument = (saved: { parsedData: CmaParsedData; creditOpinion?: string; classification?: DocumentClassification | null; sourceName?: string | null; sourceFormat?: string }) => {
    setParsedDataState(saved.parsedData);
    setCreditOpinion(saved.creditOpinion || "");
    setClassification(saved.classification ?? null);
    setSourceMeta({ sourceName: saved.sourceName ?? null, sourceFormat: saved.sourceFormat || "txt" });
  };

  return (
    <CmaContext.Provider value={{
      parsedData,
      computedData,
      activeTab,
      isLoading,
      creditOpinion,
      isStreaming,
      balanceCheck,
      classification,
      sourceMeta,
      setParsedData,
      setActiveTab,
      setIsLoading,
      setCreditOpinion,
      setIsStreaming,
      setClassification,
      setSourceMeta,
      loadSampleData,
      loadSavedDocument
    }}>
      {children}
    </CmaContext.Provider>
  );
}

export function useCma() {
  const context = useContext(CmaContext);
  if (context === undefined) {
    throw new Error('useCma must be used within a CmaProvider');
  }
  return context;
}
