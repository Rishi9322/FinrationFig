import React, { useMemo, useState } from 'react';
import { useCma } from '../context/CmaContext';
import { projectScenarios, ScenarioKey } from '../../../lib/finance/projections';

const SCENARIO_LABEL: Record<ScenarioKey, string> = { best: 'Best Case', base: 'Base Case', worst: 'Worst Case' };
const SCENARIO_COLOR: Record<ScenarioKey, string> = { best: '#22C55E', base: '#94A3B8', worst: '#EF4444' };

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 1 });

export function ScenarioProjections() {
  const { parsedData } = useCma();
  const [growthRate, setGrowthRate] = useState(10); // % YoY, base case
  const [growthSwing, setGrowthSwing] = useState(5); // +/- pts for best/worst
  const [marginSwing, setMarginSwing] = useState(2); // +/- pts for best/worst

  const projections = useMemo(() => {
    if (!parsedData) return null;
    try {
      return projectScenarios(parsedData, {
        growthRate: growthRate / 100,
        growthSwing: growthSwing / 100,
        marginSwing: marginSwing / 100,
      });
    } catch {
      return null;
    }
  }, [parsedData, growthRate, growthSwing, marginSwing]);

  if (!parsedData) {
    return <div style={{ color: '#94A3B8' }}>Please parse financial data first.</div>;
  }

  return (
    <div className="cma-form-container">
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#F8FAFC', marginBottom: '0.5rem' }}>
        12–24 Month Projections
      </h2>
      <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Deterministic projection off the latest actual year - not AI-generated. Adjust the assumptions to see
        how repayment capacity moves under each scenario.
      </p>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#94A3B8' }}>
          Base sales growth (% YoY)
          <input type="number" value={growthRate} onChange={(e) => setGrowthRate(Number(e.target.value))}
            style={{ width: '100px', backgroundColor: '#111720', border: '1px solid #1A2030', color: '#F8FAFC', padding: '0.4rem', borderRadius: '4px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#94A3B8' }}>
          Growth swing, best/worst (± pts)
          <input type="number" value={growthSwing} onChange={(e) => setGrowthSwing(Number(e.target.value))}
            style={{ width: '100px', backgroundColor: '#111720', border: '1px solid #1A2030', color: '#F8FAFC', padding: '0.4rem', borderRadius: '4px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: '#94A3B8' }}>
          Margin swing, best/worst (± pts)
          <input type="number" value={marginSwing} onChange={(e) => setMarginSwing(Number(e.target.value))}
            style={{ width: '100px', backgroundColor: '#111720', border: '1px solid #1A2030', color: '#F8FAFC', padding: '0.4rem', borderRadius: '4px' }} />
        </label>
      </div>

      {!projections ? (
        <div style={{ color: '#94A3B8' }}>Not enough data to project.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.6rem', color: '#94A3B8', borderBottom: '1px solid #1A2030' }}>Scenario</th>
                <th style={{ textAlign: 'left', padding: '0.6rem', color: '#94A3B8', borderBottom: '1px solid #1A2030' }}>Horizon</th>
                <th style={{ textAlign: 'right', padding: '0.6rem', color: '#94A3B8', borderBottom: '1px solid #1A2030' }}>Net Sales</th>
                <th style={{ textAlign: 'right', padding: '0.6rem', color: '#94A3B8', borderBottom: '1px solid #1A2030' }}>Net Profit</th>
                <th style={{ textAlign: 'right', padding: '0.6rem', color: '#94A3B8', borderBottom: '1px solid #1A2030' }}>PAT Margin</th>
                <th style={{ textAlign: 'right', padding: '0.6rem', color: '#94A3B8', borderBottom: '1px solid #1A2030' }}>Projected DSCR</th>
              </tr>
            </thead>
            <tbody>
              {projections.map((p) => p.years.map((y, i) => (
                <tr key={`${p.scenario}-${y.label}`}>
                  {i === 0 && (
                    <td rowSpan={2} style={{ padding: '0.6rem', color: SCENARIO_COLOR[p.scenario], fontWeight: 600, borderBottom: '1px solid #1A2030', verticalAlign: 'top' }}>
                      {SCENARIO_LABEL[p.scenario]}
                    </td>
                  )}
                  <td style={{ padding: '0.6rem', color: '#E2E8F0', borderBottom: '1px solid #1A2030' }}>{y.label}</td>
                  <td style={{ padding: '0.6rem', color: '#E2E8F0', textAlign: 'right', borderBottom: '1px solid #1A2030', fontFamily: 'monospace' }}>{fmt(y.netSales)}</td>
                  <td style={{ padding: '0.6rem', color: '#E2E8F0', textAlign: 'right', borderBottom: '1px solid #1A2030', fontFamily: 'monospace' }}>{fmt(y.netProfit)}</td>
                  <td style={{ padding: '0.6rem', color: '#E2E8F0', textAlign: 'right', borderBottom: '1px solid #1A2030', fontFamily: 'monospace' }}>{(y.margin * 100).toFixed(1)}%</td>
                  <td style={{ padding: '0.6rem', textAlign: 'right', borderBottom: '1px solid #1A2030', fontFamily: 'monospace', color: y.dscr >= 1.5 ? '#22C55E' : y.dscr >= 1.2 ? '#F59E0B' : '#EF4444' }}>
                    {y.dscr.toFixed(2)}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
