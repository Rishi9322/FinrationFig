import { apiCall } from "./apiSession"
import { CalculatorType } from "./financialCalculations"

export interface SavedCalculation {
  id: string
  userId: string
  calculatorType: CalculatorType
  inputs: Record<string, unknown>
  results: Record<string, unknown>
  caseId?: string | null
  createdAt: string
}

export interface Case {
  id: string
  name: string
  createdAt: string
}

// Calculations go through the edge function, which verifies the Firebase token
// and scopes every row to the caller's uid with the service role.
export async function saveCalculation(
  userId: string,
  calculatorType: CalculatorType,
  inputs: Record<string, unknown>,
  results: Record<string, unknown>,
  caseId?: string | null,
): Promise<SavedCalculation> {
  const data = await apiCall("/calculations", {
    method: "POST",
    body: JSON.stringify({ calculatorType, inputs, results, caseId }),
  })
  return {
    id: data.id,
    userId,
    calculatorType,
    inputs,
    results,
    caseId: caseId ?? null,
    createdAt: data.createdAt || new Date().toISOString(),
  }
}

export async function getUserCalculations(_userId: string): Promise<SavedCalculation[]> {
  const data = await apiCall("/calculations")
  return data.calculations || []
}

// PUT replaces the given fields wholesale - callers must send the full merged
// inputs/results object, not a partial patch, since the server does a plain
// column update rather than a JSON merge.
export async function updateCalculation(
  id: string,
  patch: { inputs?: Record<string, unknown>; results?: Record<string, unknown>; caseId?: string | null },
): Promise<void> {
  await apiCall(`/calculations/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  })
}

export async function getCases(): Promise<Case[]> {
  return (await apiCall("/cases")).cases || []
}

export async function createCase(name: string): Promise<Case> {
  return apiCall("/cases", { method: "POST", body: JSON.stringify({ name }) })
}

export async function deleteCase(id: string): Promise<void> {
  await apiCall(`/cases/${id}`, { method: "DELETE" })
}
