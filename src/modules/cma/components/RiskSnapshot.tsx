import React from 'react';
import { useCma } from '../context/CmaContext';

// Deterministic, computed straight from the ratios - no AI round trip, so it's
// visible the instant financials are parsed instead of after the memo streams.
// Thresholds are the standard RBI/banking norms already referenced in the
// credit-memo prompt (current ratio 1.33, TOL/TNW 3.0, DSCR 1.5).
type Severity = 'good' | 'watch' | 'bad';

function severityColor(s: Severity) {
  if (s === 'bad') return '#EF4444';
  if (s === 'watch') return '#F59E0B';
  return '#22C55E';
}

export function RiskSnapshot() {
  const { parsedData, computedData, balanceCheck } = useCma();
  if (!parsedData || !computedData) return null;

  const lastIndex = parsedData.years.length - 1;
  const currentRatio = computedData.ratios.currentRatio[lastIndex] as number;
  const tolToTnw = computedData.ratios.tolToTNW[lastIndex] as number;
  const dscrValues = (computedData.dscr.dscrRatio as number[]).filter((v: number) => v > 0);
  const avgDscr = dscrValues.length ? dscrValues.reduce((a, b) => a + b, 0) / dscrValues.length : 0;

  const currentRatioSeverity: Severity = currentRatio >= 1.33 ? 'good' : currentRatio >= 1.0 ? 'watch' : 'bad';
  const tolTnwSeverity: Severity = tolToTnw <= 3.0 ? 'good' : tolToTnw <= 4.0 ? 'watch' : 'bad';
  const dscrSeverity: Severity = avgDscr >= 1.5 ? 'good' : avgDscr >= 1.2 ? 'watch' : 'bad';

  const overall: Severity = [currentRatioSeverity, tolTnwSeverity, dscrSeverity].includes('bad')
    ? 'bad'
    : [currentRatioSeverity, tolTnwSeverity, dscrSeverity].includes('watch')
    ? 'watch'
    : 'good';

  const concerns: string[] = [];
  if (currentRatioSeverity !== 'good') {
    concerns.push(`Current ratio is ${currentRatio.toFixed(2)}, below the RBI norm of 1.33.`);
  }
  if (tolTnwSeverity !== 'good') {
    concerns.push(`TOL/TNW is ${tolToTnw.toFixed(2)}, above the 3.0 norm - leverage is stretched.`);
  }
  if (dscrSeverity !== 'good') {
    concerns.push(`Average DSCR is ${avgDscr.toFixed(2)}, below the 1.5 comfort threshold.`);
  }
  if (!balanceCheck.isBalanced) {
    concerns.push('Balance sheet does not tie out - Total Assets vs Total Liabilities mismatch.');
  }

  return (
    <div
      style={{
        backgroundColor: '#0E1218', border: `1px solid ${severityColor(overall)}55`,
        borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem',
        display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start',
      }}
    >
      <div style={{ minWidth: '160px' }}>
        <div style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risk Picture</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: severityColor(overall), display: 'inline-block' }} />
          <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#F8FAFC' }}>
            {overall === 'good' ? 'Acceptable' : overall === 'watch' ? 'Needs Review' : 'High Risk'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Current Ratio', value: currentRatio.toFixed(2), severity: currentRatioSeverity },
          { label: 'TOL/TNW', value: tolToTnw.toFixed(2), severity: tolTnwSeverity },
          { label: 'Avg DSCR', value: avgDscr.toFixed(2), severity: dscrSeverity },
        ].map((m) => (
          <div key={m.label}>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{m.label}</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: severityColor(m.severity) }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: '1 1 260px', minWidth: '260px' }}>
        <div style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
          Top Concerns
        </div>
        {concerns.length === 0 ? (
          <div style={{ color: '#64748B', fontSize: '0.85rem' }}>No threshold breaches on latest-year ratios.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#E2E8F0', fontSize: '0.85rem' }}>
            {concerns.slice(0, 3).map((c, i) => (
              <li key={i} style={{ marginBottom: '0.2rem' }}>{c}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
