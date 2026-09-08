import React, { createContext, useContext, useState, useMemo } from 'react';
import { CmaParsedData, CmaComputedData } from '../../../lib/finance/cmaTypes';
import { computeCmaData } from '../../../lib/finance/cmaCalculations';
import type { DocumentClassification, CreditRecommendation } from '../../../lib/ai/openrouter';

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
  recommendation: CreditRecommendation | null;
  isGeneratingRecommendation: boolean;
  isVerified: boolean;
}

// Fields most likely to carry an extraction error, and the ones Needs Review /
// Anomalies already scrutinize - not every one of the ~80 leaf fields across
// all 6 forms. A full editable grid over everything is real scope; this is
// the 20% that covers the failure modes actually seen.
export const EDITABLE_KEY_FIELDS = [
  { section: "operatingStatement", field: "netSales", label: "Net Sales" },
  { section: "operatingStatement", field: "netProfit", label: "Net Profit" },
  { section: "balanceSheet", field: "totalAssets", label: "Total Assets" },
  { section: "balanceSheet", field: "totalLiabilities", label: "Total Liabilities" },
] as const;

interface CmaContextType extends CmaState {
  setParsedData: (data: CmaParsedData) => void;
  setActiveTab: (tab: number) => void;
  setIsLoading: (loading: boolean) => void;
  setCreditOpinion: (opinion: string | ((prev: string) => string)) => void;
  setIsStreaming: (streaming: boolean) => void;
  setClassification: (classification: DocumentClassification | null) => void;
  setSourceMeta: (meta: { sourceName: string | null; sourceFormat: string }) => void;
  setRecommendation: (rec: CreditRecommendation | null) => void;
  setIsGeneratingRecommendation: (generating: boolean) => void;
  setIsVerified: (verified: boolean) => void;
  updateCompanyName: (name: string) => void;
  updateKeyFieldValue: (section: "operatingStatement" | "balanceSheet", field: string, yearIndex: number, value: number) => void;
  loadSavedDocument: (saved: { parsedData: CmaParsedData; creditOpinion?: string; classification?: DocumentClassification | null; sourceName?: string | null; sourceFormat?: string; recommendation?: CreditRecommendation | null }) => void;
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
  const [recommendation, setRecommendation] = useState<CreditRecommendation | null>(null);
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

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
    setIsVerified(false); // a fresh parse always needs re-review
  };

  const updateCompanyName = (name: string) => {
    setParsedDataState((prev) => (prev ? { ...prev, company: name } : prev));
    setIsVerified(false);
  };

  // Only touches top-level numeric arrays (the 4 EDITABLE_KEY_FIELDS) - not a
  // general deep-path setter, since that's all this scoped override layer
  // needs. computedData/balanceCheck recompute automatically off parsedData.
  const updateKeyFieldValue = (section: "operatingStatement" | "balanceSheet", field: string, yearIndex: number, value: number) => {
    setParsedDataState((prev) => {
      if (!prev) return prev;
      const sectionData = prev[section] as Record<string, number[]>;
      const nextArray = [...(sectionData[field] || [])];
      nextArray[yearIndex] = value;
      return { ...prev, [section]: { ...sectionData, [field]: nextArray } };
    });
    setIsVerified(false);
  };

  const loadSavedDocument = (saved: { parsedData: CmaParsedData; creditOpinion?: string; classification?: DocumentClassification | null; sourceName?: string | null; sourceFormat?: string; recommendation?: CreditRecommendation | null }) => {
    setParsedDataState(saved.parsedData);
    setCreditOpinion(saved.creditOpinion || "");
    setClassification(saved.classification ?? null);
    setSourceMeta({ sourceName: saved.sourceName ?? null, sourceFormat: saved.sourceFormat || "txt" });
    setRecommendation(saved.recommendation ?? null);
    // A previously-saved case was presumably reviewed before saving - don't
    // force re-verification on every reload of the same case.
    setIsVerified(Boolean(saved.creditOpinion));
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
      recommendation,
      isGeneratingRecommendation,
      isVerified,
      setParsedData,
      setActiveTab,
      setIsLoading,
      setCreditOpinion,
      setIsStreaming,
      setClassification,
      setSourceMeta,
      setRecommendation,
      setIsGeneratingRecommendation,
      setIsVerified,
      updateCompanyName,
      updateKeyFieldValue,
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
