import { supabase } from "./supabaseClient"
import { CalculatorType } from "./financialCalculations"

export interface SavedCalculation {
  id: string
  userId: string
  calculatorType: CalculatorType
  inputs: Record<string, unknown>
  results: Record<string, unknown>
  createdAt: string
}

// Calculations are read/written straight from Postgres. RLS (calculations_owner)
// scopes every query to auth.uid(), so a user can only ever touch their own rows.
export async function saveCalculation(
  userId: string,
  calculatorType: CalculatorType,
  inputs: Record<string, unknown>,
  results: Record<string, unknown>,
): Promise<SavedCalculation> {
  const { data, error } = await supabase
    .from("calculations")
    .insert({ user_id: userId, calculator_type: calculatorType, inputs, results })
    .select("id, user_id, calculator_type, inputs, results, created_at")
    .single()

  if (error || !data) throw new Error(error?.message || "Failed to save calculation")

  return {
    id: data.id,
    userId: data.user_id,
    calculatorType: data.calculator_type,
    inputs: data.inputs ?? {},
    results: data.results ?? {},
    createdAt: data.created_at,
  }
}

export async function getUserCalculations(userId: string): Promise<SavedCalculation[]> {
  const { data, error } = await supabase
    .from("calculations")
    .select("id, user_id, calculator_type, inputs, results, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    calculatorType: row.calculator_type,
    inputs: row.inputs ?? {},
    results: row.results ?? {},
    createdAt: row.created_at,
  }))
}
