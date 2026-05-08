import { CalculatorType } from "./financialCalculations"
import { projectId, publicAnonKey } from "../../utils/supabase/info"

export interface SavedCalculation {
  id: string
  userId: string
  calculatorType: CalculatorType
  inputs: Record<string, unknown>
  results: Record<string, unknown>
  createdAt: string
}

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-bd792702`

async function apiCall(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || "Request failed")
  }

  return data
}

export async function saveCalculation(
  userId: string,
  calculatorType: CalculatorType,
  inputs: Record<string, unknown>,
  results: Record<string, unknown>
): Promise<SavedCalculation> {
  const data = await apiCall("/calculations", {
    method: "POST",
    body: JSON.stringify({ userId, calculatorType, inputs, results }),
  })

  return {
    id: data.id,
    userId,
    calculatorType,
    inputs,
    results,
    createdAt: new Date().toISOString(),
  }
}

export async function getUserCalculations(userId: string): Promise<SavedCalculation[]> {
  const data = await apiCall(`/calculations/${userId}`)
  return data.calculations || []
}
