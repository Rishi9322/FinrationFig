import { apiCall } from "./apiSession"
import { CalculatorType } from "./financialCalculations"

export interface SavedCalculation {
  id: string
  userId: string
  calculatorType: CalculatorType
  inputs: Record<string, unknown>
  results: Record<string, unknown>
  createdAt: string
}

// Calculations go through the edge function, which verifies the Firebase token
// and scopes every row to the caller's uid with the service role.
export async function saveCalculation(
  userId: string,
  calculatorType: CalculatorType,
  inputs: Record<string, unknown>,
  results: Record<string, unknown>,
): Promise<SavedCalculation> {
  const data = await apiCall("/calculations", {
    method: "POST",
    body: JSON.stringify({ calculatorType, inputs, results }),
  })
  return {
    id: data.id,
    userId,
    calculatorType,
    inputs,
    results,
    createdAt: data.createdAt || new Date().toISOString(),
  }
}

export async function getUserCalculations(_userId: string): Promise<SavedCalculation[]> {
  const data = await apiCall("/calculations")
  return data.calculations || []
}
