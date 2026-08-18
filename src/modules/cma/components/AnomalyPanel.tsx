import React, { useMemo } from 'react';
import { useCma } from '../context/CmaContext';
import { findAnomalies } from '../../../lib/finance/anomalies';

export function AnomalyPanel() {
  const { parsedData } = useCma();
  const anomalies = useMemo(() => (parsedData ? findAnomalies(parsedData) : []), [parsedData]);

  if (!parsedData || anomalies.length === 0) return null;

  return (
    <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #EF444455', backgroundColor: '#EF44440d' }}>
      <div style={{ color: '#EF4444', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
        ANOMALIES ({anomalies.length})
      </div>
      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem', color: '#E2E8F0' }}>
        {anomalies.map((a, i) => (
          <li key={i} style={{ marginBottom: '0.2rem' }}>
            <span style={{ color: '#94A3B8' }}>[{a.year}]</span> {a.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
