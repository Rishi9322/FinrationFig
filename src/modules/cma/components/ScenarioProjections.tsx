import React, { useMemo, useState } from 'react';
import { useCma } from '../context/CmaContext';
import { projectScenarios, ScenarioKey } from '../../../lib/finance/projections';

const SCENARIO_LABEL: Record<ScenarioKey, string> = { best: 'Best Case', base: 'Base Case', worst: 'Worst Case' };
const SCENARIO_COLOR: Record<ScenarioKey, string> = { best: '#22C55E', base: 'var(--cma-text-muted)', worst: '#EF4444' };

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
    return <div style={{ color: 'var(--cma-text-muted)' }}>Please parse financial data first.</div>;
  }

  return (
    <div className="cma-form-container">
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--cma-text-strong)', marginBottom: '0.5rem' }}>
        12–24 Month Projections
      </h2>
      <p style={{ color: 'var(--cma-text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Deterministic projection off the latest actual year - not AI-generated. Adjust the assumptions to see
        how repayment capacity moves under each scenario.
      </p>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--cma-text-muted)' }}>
          Base sales growth (% YoY)
          <input type="number" value={growthRate} onChange={(e) => setGrowthRate(Number(e.target.value))}
            style={{ width: '100px', backgroundColor: 'var(--cma-panel-bg-alt)', border: '1px solid var(--cma-border)', color: 'var(--cma-text-strong)', padding: '0.4rem', borderRadius: '4px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--cma-text-muted)' }}>
          Growth swing, best/worst (± pts)
          <input type="number" value={growthSwing} onChange={(e) => setGrowthSwing(Number(e.target.value))}
            style={{ width: '100px', backgroundColor: 'var(--cma-panel-bg-alt)', border: '1px solid var(--cma-border)', color: 'var(--cma-text-strong)', padding: '0.4rem', borderRadius: '4px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--cma-text-muted)' }}>
          Margin swing, best/worst (± pts)
          <input type="number" value={marginSwing} onChange={(e) => setMarginSwing(Number(e.target.value))}
            style={{ width: '100px', backgroundColor: 'var(--cma-panel-bg-alt)', border: '1px solid var(--cma-border)', color: 'var(--cma-text-strong)', padding: '0.4rem', borderRadius: '4px' }} />
        </label>
      </div>

      {!projections ? (
        <div style={{ color: 'var(--cma-text-muted)' }}>Not enough data to project.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.6rem', color: 'var(--cma-text-muted)', borderBottom: '1px solid var(--cma-border)' }}>Scenario</th>
                <th style={{ textAlign: 'left', padding: '0.6rem', color: 'var(--cma-text-muted)', borderBottom: '1px solid var(--cma-border)' }}>Horizon</th>
                <th style={{ textAlign: 'right', padding: '0.6rem', color: 'var(--cma-text-muted)', borderBottom: '1px solid var(--cma-border)' }}>Net Sales</th>
                <th style={{ textAlign: 'right', padding: '0.6rem', color: 'var(--cma-text-muted)', borderBottom: '1px solid var(--cma-border)' }}>Net Profit</th>
                <th style={{ textAlign: 'right', padding: '0.6rem', color: 'var(--cma-text-muted)', borderBottom: '1px solid var(--cma-border)' }}>PAT Margin</th>
                <th style={{ textAlign: 'right', padding: '0.6rem', color: 'var(--cma-text-muted)', borderBottom: '1px solid var(--cma-border)' }}>Projected DSCR</th>
              </tr>
            </thead>
            <tbody>
              {projections.map((p) => p.years.map((y, i) => (
                <tr key={`${p.scenario}-${y.label}`}>
                  {i === 0 && (
                    <td rowSpan={2} style={{ padding: '0.6rem', color: SCENARIO_COLOR[p.scenario], fontWeight: 600, borderBottom: '1px solid var(--cma-border)', verticalAlign: 'top' }}>
                      {SCENARIO_LABEL[p.scenario]}
                    </td>
                  )}
                  <td style={{ padding: '0.6rem', color: 'var(--cma-text)', borderBottom: '1px solid var(--cma-border)' }}>{y.label}</td>
                  <td style={{ padding: '0.6rem', color: 'var(--cma-text)', textAlign: 'right', borderBottom: '1px solid var(--cma-border)', fontFamily: 'monospace' }}>{fmt(y.netSales)}</td>
                  <td style={{ padding: '0.6rem', color: 'var(--cma-text)', textAlign: 'right', borderBottom: '1px solid var(--cma-border)', fontFamily: 'monospace' }}>{fmt(y.netProfit)}</td>
                  <td style={{ padding: '0.6rem', color: 'var(--cma-text)', textAlign: 'right', borderBottom: '1px solid var(--cma-border)', fontFamily: 'monospace' }}>{(y.margin * 100).toFixed(1)}%</td>
                  <td style={{ padding: '0.6rem', textAlign: 'right', borderBottom: '1px solid var(--cma-border)', fontFamily: 'monospace', color: y.dscr >= 1.5 ? '#22C55E' : y.dscr >= 1.2 ? '#F59E0B' : '#EF4444' }}>
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
