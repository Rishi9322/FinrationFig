import React from 'react';
import { useCma } from '../context/CmaContext';

export function Form4HoldingPeriod() {
  const { parsedData } = useCma();

  if (!parsedData) {
    return <div style={{ color: '#94A3B8' }}>Please load or parse data first.</div>;
  }

  return (
    <div className="cma-form-container">
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#F8FAFC' }}>
        FORM IV - COMPARATIVE STATEMENT OF CA & CL (Holding Period Analysis)
      </h2>
      <div style={{ color: '#94A3B8', fontStyle: 'italic', padding: '2rem', backgroundColor: '#0E1218', borderRadius: '8px', border: '1px solid #1A2030' }}>
        Holding period analysis logic goes here... (e.g. Debtors = X Months, Creditors = Y Months).
      </div>
    </div>
  );
}
