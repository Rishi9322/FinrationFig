import { saveCalculation, getUserCalculations, updateCalculation } from "./calculationStorage"
import type { CmaParsedData, CmaComputedData } from "./finance/cmaTypes"
import type { DocumentClassification, CreditRecommendation } from "./ai/openrouter"

export type CaseStatus = "New" | "Under Review" | "Awaiting Docs" | "Memo Ready" | "Approved" | "Declined"

export interface CaseMeta {
  borrowerName: string
  sector: string
  facilityType: string
  sanctionAmount: string
  relationshipManager: string
  assignedAnalyst: string
  status: CaseStatus
  notes: string
}

export const EMPTY_CASE_META: CaseMeta = {
  borrowerName: "", sector: "", facilityType: "", sanctionAmount: "",
  relationshipManager: "", assignedAnalyst: "", status: "New", notes: "",
}

export interface SavedCmaDocument {
  id: string
  createdAt: string
  sourceName: string | null
  sourceFormat: string
  classification: DocumentClassification | null
  parsedData: CmaParsedData
  computedData: CmaComputedData | null
  creditOpinion: string
  caseMeta: CaseMeta
  recommendation: CreditRecommendation | null
}

export async function saveCmaDocument(
  userId: string,
  params: {
    sourceName: string | null
    sourceFormat: string
    classification: DocumentClassification | null
    parsedData: CmaParsedData
    computedData: CmaComputedData | null
    creditOpinion: string
    caseMeta?: Partial<CaseMeta>
    recommendation?: CreditRecommendation | null
  }
): Promise<{ id: string }> {
  const saved = await saveCalculation(
    userId,
    "cma-document",
    {
      sourceName: params.sourceName,
      sourceFormat: params.sourceFormat,
      classification: params.classification,
      parsedData: params.parsedData,
      caseMeta: { ...EMPTY_CASE_META, ...params.caseMeta },
    },
    {
      computedData: params.computedData,
      creditOpinion: params.creditOpinion,
      recommendation: params.recommendation ?? null,
    }
  )

  return { id: saved.id }
}

// PUT overwrites the whole `inputs` column, so this reads the current row's
// other fields from the caller (already in hand as a SavedCmaDocument) and
// only swaps in the merged caseMeta rather than trusting a partial patch.
export async function updateCmaCaseMeta(doc: SavedCmaDocument, caseMeta: Partial<CaseMeta>): Promise<void> {
  await updateCalculation(doc.id, {
    inputs: {
      sourceName: doc.sourceName,
      sourceFormat: doc.sourceFormat,
      classification: doc.classification,
      parsedData: doc.parsedData,
      caseMeta: { ...doc.caseMeta, ...caseMeta },
    },
  })
}

export async function getSavedCmaDocuments(userId: string): Promise<SavedCmaDocument[]> {
  const calculations = await getUserCalculations(userId)

  return calculations
    .filter((calc) => calc.calculatorType === "cma-document")
    .map((calc) => ({
      id: calc.id,
      createdAt: calc.createdAt,
      sourceName: (calc.inputs as any)?.sourceName ?? null,
      sourceFormat: (calc.inputs as any)?.sourceFormat ?? "txt",
      classification: (calc.inputs as any)?.classification ?? null,
      parsedData: (calc.inputs as any)?.parsedData,
      computedData: (calc.results as any)?.computedData ?? null,
      creditOpinion: (calc.results as any)?.creditOpinion ?? "",
      caseMeta: { ...EMPTY_CASE_META, ...(calc.inputs as any)?.caseMeta },
      recommendation: (calc.results as any)?.recommendation ?? null,
    }))
}
