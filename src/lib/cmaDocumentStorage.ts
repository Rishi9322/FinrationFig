import { saveCalculation, getUserCalculations } from "./calculationStorage"
import type { CmaParsedData, CmaComputedData } from "./finance/cmaTypes"
import type { DocumentClassification } from "./ai/openrouter"

export interface SavedCmaDocument {
  id: string
  createdAt: string
  sourceName: string | null
  sourceFormat: string
  classification: DocumentClassification | null
  parsedData: CmaParsedData
  computedData: CmaComputedData | null
  creditOpinion: string
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
    },
    {
      computedData: params.computedData,
      creditOpinion: params.creditOpinion,
    }
  )

  return { id: saved.id }
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
    }))
}
