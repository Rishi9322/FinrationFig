import React from 'react';
import { useCma, EDITABLE_KEY_FIELDS } from '../context/CmaContext';

// Scoped override layer: editable inputs for the fields most likely to carry
// an extraction error (the same ones Needs Review/Anomalies scrutinize), plus
// a verification lock. Not a general editable grid over every leaf field -
// see EDITABLE_KEY_FIELDS for why.
export function ManualReview() {
  const { parsedData, computedData, isVerified, setIsVerified, updateCompanyName, updateKeyFieldValue } = useCma();

  if (!parsedData || !computedData) return null;

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#0E1218', borderRadius: '6px', border: '1px solid #1A2030' }}>
      <div style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Review &amp; Correct
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem', color: '#94A3B8', maxWidth: '320px', marginBottom: '1rem' }}>
        Company Name
        <input
          value={parsedData.company}
          onChange={(e) => updateCompanyName(e.target.value)}
          style={{ backgroundColor: '#111720', border: '1px solid #1A2030', color: '#F8FAFC', padding: '0.45rem', borderRadius: '4px' }}
        />
      </label>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.4rem', color: '#94A3B8' }}>Field</th>
              {parsedData.years.map((y) => (
                <th key={y} style={{ textAlign: 'right', padding: '0.4rem', color: '#94A3B8', minWidth: '90px' }}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EDITABLE_KEY_FIELDS.map(({ section, field, label }) => {
              const values = (parsedData[section] as unknown as Record<string, number[]>)[field] || [];
              return (
                <tr key={field}>
                  <td style={{ padding: '0.4rem', color: '#E2E8F0' }}>{label}</td>
                  {parsedData.years.map((_, i) => (
                    <td key={i} style={{ padding: '0.25rem' }}>
                      <input
                        type="number"
                        value={values[i] ?? 0}
                        onChange={(e) => updateKeyFieldValue(section, field, i, Number(e.target.value))}
                        style={{
                          width: '100%', textAlign: 'right', backgroundColor: '#111720', border: '1px solid #1A2030',
                          color: '#F8FAFC', padding: '0.3rem', borderRadius: '4px', fontFamily: 'monospace',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          className="cma-btn"
          onClick={() => setIsVerified(true)}
          disabled={isVerified}
          style={isVerified ? { backgroundColor: '#22C55E22', color: '#22C55E', border: '1px solid #22C55E55' } : undefined}
        >
          {isVerified ? '✓ Data Verified' : 'Mark Data Verified'}
        </button>
        {!isVerified && (
          <span style={{ color: '#F59E0B', fontSize: '0.8rem' }}>
            Editing any field un-verifies the data - re-confirm before generating the credit memo.
          </span>
        )}
      </div>
    </div>
  );
}
