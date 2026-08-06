import { describe, expect, it } from "vitest"
import { validateCmaShape } from "./openrouter"

const valid = {
  company: "Acme",
  years: ["2024-25", "2025-26"],
  operatingStatement: { netSales: [100, 200], rawMaterials: { imported: [10, 20] } },
  balanceSheet: { currentLiabilities: { bankBorrowingsCC: [5, 6] } },
}

describe("validateCmaShape", () => {
  it("accepts numeric series", () => {
    expect(validateCmaShape(valid).company).toBe("Acme")
  })

  it("rejects a non-numeric value hidden in a nested series", () => {
    const bad = { ...valid, operatingStatement: { netSales: [100, "200"] } }
    expect(() => validateCmaShape(bad)).toThrow(/non-numeric value at operatingStatement.netSales/)
  })

  it("rejects NaN, which JSON.parse never produces but coercion can", () => {
    const bad = { ...valid, balanceSheet: { currentAssets: { cash: [NaN] } } }
    expect(() => validateCmaShape(bad)).toThrow(/non-numeric/)
  })

  it("rejects missing or malformed years", () => {
    expect(() => validateCmaShape({ ...valid, years: "2024-25" })).toThrow(/years/)
    expect(() => validateCmaShape([])).toThrow(/unexpected CMA structure/)
  })
})
