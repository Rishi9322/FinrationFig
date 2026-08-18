import React, { useMemo, useState } from 'react';
import { useCma } from '../context/CmaContext';
import { suggestMpbfLimit, sizeTermLoan, tenureSensitivity } from '../../../lib/finance/facilityStructuring';

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 1 });
const TENURE_OPTIONS = [3, 5, 7, 10];

export function FacilityStructuring() {
  const { parsedData, computedData } = useCma();
  const [interestRate, setInterestRate] = useState(10); // % p.a.
  const [tenureYears, setTenureYears] = useState(5);
  const [targetDscr, setTargetDscr] = useState(1.5);
  const [proposedLoanAmount, setProposedLoanAmount] = useState(0);

  const mpbf = useMemo(() => (parsedData && computedData ? suggestMpbfLimit(parsedData, computedData) : null), [parsedData, computedData]);

  const sizing = useMemo(() => {
    if (!parsedData || !computedData) return null;
    return sizeTermLoan(parsedData, computedData, { interestRate: interestRate / 100, tenureYears, targetDscr });
  }, [parsedData, computedData, interestRate, tenureYears, targetDscr]);

  const sensitivityRows = useMemo(() => {
    if (!parsedData || !computedData) return [];
    const amount = proposedLoanAmount || sizing?.maxLoanAmount || 0;
    if (!amount) return [];
    return tenureSensitivity(parsedData, computedData, { loanAmount: amount, interestRate: interestRate / 100, tenureOptions: TENURE_OPTIONS });
  }, [parsedData, computedData, proposedLoanAmount, sizing, interestRate]);

  if (!parsedData || !computedData) {
    return <div style={{ color: '#94A3B8' }}>Please parse financial data first.</div>;
  }

  return (
    <div className="cma-form-container">
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#F8FAFC', marginBottom: '0.5rem' }}>Facility Structuring</h2>
      <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        Deterministic sizing off the latest year's cash accrual and existing debt service - not AI-generated.
        Annual-period amortization; treat as a screening estimate, not a disbursement schedule.
      </p>

      {mpbf && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#0E1218', border: '1px solid #1A2030', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggested CC Limit (MPBF, {mpbf.year})</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#F8FAFC' }}>₹ {fmt(mpbf.mpbfValue)} Lakhs</div>
          <p style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '0.25rem' }}>Tandon Method II, from the MPBF tab.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#94A3B8' }}>
          Interest rate (% p.a.)
          <input type="number" value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value))}
            style={{ width: '110px', backgroundColor: '#111720', border: '1px solid #1A2030', color: '#F8FAFC', padding: '0.4rem', borderRadius: '4px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#94A3B8' }}>
          Tenure (years)
          <input type="number" value={tenureYears} onChange={(e) => setTenureYears(Number(e.target.value))}
            style={{ width: '110px', backgroundColor: '#111720', border: '1px solid #1A2030', color: '#F8FAFC', padding: '0.4rem', borderRadius: '4px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#94A3B8' }}>
          Target DSCR
          <input type="number" step="0.1" value={targetDscr} onChange={(e) => setTargetDscr(Number(e.target.value))}
            style={{ width: '110px', backgroundColor: '#111720', border: '1px solid #1A2030', color: '#F8FAFC', padding: '0.4rem', borderRadius: '4px' }} />
        </label>
      </div>

      {sizing && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#0E1218', border: '1px solid #1A2030', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggested Term Loan Amount</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#F8FAFC' }}>₹ {fmt(sizing.maxLoanAmount)} Lakhs</div>
          <p style={{ color: '#94A3B8', fontSize: '0.8rem', marginTop: '0.4rem' }}>
            At {targetDscr.toFixed(1)}x target DSCR, {tenureYears}-year tenure, {interestRate}% p.a. — cash accrual ₹{fmt(sizing.annualCashAccrual)} Lakhs,
            existing debt service ₹{fmt(sizing.existingDebtService)} Lakhs, leaving ₹{fmt(sizing.maxAnnualEmi)} Lakhs/yr headroom for a new EMI.
          </p>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#94A3B8', maxWidth: '220px' }}>
          Proposed loan amount for tenure sensitivity (₹ Lakhs, blank = use suggested)
          <input type="number" value={proposedLoanAmount || ''} placeholder={sizing ? fmt(sizing.maxLoanAmount) : ''}
            onChange={(e) => setProposedLoanAmount(Number(e.target.value))}
            style={{ backgroundColor: '#111720', border: '1px solid #1A2030', color: '#F8FAFC', padding: '0.4rem', borderRadius: '4px' }} />
        </label>
      </div>

      {sensitivityRows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.6rem', color: '#94A3B8', borderBottom: '1px solid #1A2030' }}>Tenure</th>
                <th style={{ textAlign: 'right', padding: '0.6rem', color: '#94A3B8', borderBottom: '1px solid #1A2030' }}>Annual EMI</th>
                <th style={{ textAlign: 'right', padding: '0.6rem', color: '#94A3B8', borderBottom: '1px solid #1A2030' }}>Resulting DSCR</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityRows.map((row) => (
                <tr key={row.tenureYears}>
                  <td style={{ padding: '0.6rem', color: '#E2E8F0', borderBottom: '1px solid #1A2030' }}>{row.tenureYears} years</td>
                  <td style={{ padding: '0.6rem', color: '#E2E8F0', textAlign: 'right', borderBottom: '1px solid #1A2030', fontFamily: 'monospace' }}>₹ {fmt(row.annualEmi)} L</td>
                  <td style={{
                    padding: '0.6rem', textAlign: 'right', borderBottom: '1px solid #1A2030', fontFamily: 'monospace',
                    color: row.projectedDscr >= 1.5 ? '#22C55E' : row.projectedDscr >= 1.2 ? '#F59E0B' : '#EF4444',
                  }}>
                    {row.projectedDscr.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
