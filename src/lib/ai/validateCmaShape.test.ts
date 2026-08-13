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

describe('verifyCompanyAgainstSource', () => {
  it('keeps a company name that appears in the source document', async () => {
    const { verifyCompanyAgainstSource } = await import('./openrouter');
    const source = 'BALANCE SHEET OF ACME POLYMERS LIMITED AS AT 31.03.2025';

    const out = verifyCompanyAgainstSource({ company: 'M/s. Acme Polymers Ltd.' }, source);

    expect(out.company).toBe('M/s. Acme Polymers Ltd.');
  });

  it('blanks a name carried over from a training example', async () => {
    const { verifyCompanyAgainstSource } = await import('./openrouter');
    // The name the model returned appears nowhere in the document it parsed.
    const source = 'BALANCE SHEET OF ACME POLYMERS LIMITED AS AT 31.03.2025';

    const out = verifyCompanyAgainstSource({ company: 'M/s. Spar Coats and Polymers' }, source);

    expect(out.company).toBe('');
  });

  it('leaves an already-empty company untouched', async () => {
    const { verifyCompanyAgainstSource } = await import('./openrouter');

    expect(verifyCompanyAgainstSource({ company: '' }, 'anything').company).toBe('');
  });
});
