import { describe, it, expect } from 'vitest'
import {
  calculateDebtEquity,
  calculateCurrentRatio,
  calculateDSCR,
  calculateEBITDA,
  calculateISCR,
  calculatePID,
} from '../financialCalculations'

describe('financialCalculations', () => {
  it('calculates debt to equity correctly', () => {
    const res = calculateDebtEquity(100, 200)
    expect(res.value).toBeCloseTo(0.5)
    expect(res.formatted).toBe('0.50')
    expect(res.risk).toBe('low')
  })

  it('calculates current ratio correctly', () => {
    const res = calculateCurrentRatio(150, 100)
    expect(res.value).toBeCloseTo(1.5)
    expect(res.formatted).toBe('1.50')
    expect(['moderate','low','high']).toContain(res.risk)
  })

  it('calculates DSCR and enforces non-zero debt service', () => {
    const good = calculateDSCR(300, 200)
    expect(good.value).toBeCloseTo(1.5)
    expect(good.risk).toBe('moderate')

    expect(() => calculateDSCR(100, 0)).toThrow('Total debt service cannot be zero')
  })

  it('calculates EBITDA and returns currency formatted value', () => {
    const r = calculateEBITDA(200, 60, 40, 1000)
    expect(r.value).toBe(300)
    expect(r.details).toContain('30.0%')
  })

  it('calculates ISCR and enforces non-zero interest', () => {
    const r = calculateISCR(150, 50)
    expect(r.value).toBeCloseTo(3)
    expect(r.risk).toBe('low')
    expect(() => calculateISCR(100, 0)).toThrow('Interest expense cannot be zero')
  })

  it('calculates PID inputs and returns expected structure', () => {
    const inputs = {
      projectedAnnualSales: 1000000,
      annualPurchase: 600000,
      marginPercent: 20,
      salesCreditDays: 60,
      purchaseCreditDays: 30,
      pidLimit: 100000,
      pidCostPerMonthPercent: 1,
      cashDiscountPercent: 2,
    }
    const out = calculatePID(inputs)
    expect(typeof out.netPidBenefit).toBe('number')
    expect(typeof out.totalProfitIncrease).toBe('number')
    expect(out.interpretation.length).toBeGreaterThan(10)
  })
})
