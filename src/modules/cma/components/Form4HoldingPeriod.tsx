import React from 'react';
import { useCma } from '../context/CmaContext';

export function Form4HoldingPeriod() {
  const { parsedData } = useCma();

  if (!parsedData) {
    return <div style={{ color: 'var(--cma-text-muted)' }}>Please load or parse data first.</div>;
  }

  return (
    <div className="cma-form-container">
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--cma-text-strong)' }}>
        FORM IV - COMPARATIVE STATEMENT OF CA & CL (Holding Period Analysis)
      </h2>
      <div style={{ color: 'var(--cma-text-muted)', fontStyle: 'italic', padding: '2rem', backgroundColor: 'var(--cma-panel-bg)', borderRadius: '8px', border: '1px solid var(--cma-border)' }}>
        Holding period analysis logic goes here... (e.g. Debtors = X Months, Creditors = Y Months).
      </div>
    </div>
  );
}
