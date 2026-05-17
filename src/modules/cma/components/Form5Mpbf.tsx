import React from 'react';
import { useCma } from '../context/CmaContext';
import { formatCmaValue, getValueClass } from '../../../lib/finance/cmaUtils';

export function Form5Mpbf() {
  const { parsedData, computedData } = useCma();

  if (!parsedData || !computedData) {
    return <div style={{ color: '#94A3B8' }}>Please load or parse data first.</div>;
  }

  const { years, yearTypes } = parsedData;
  const { mpbf } = computedData;

  const renderRow = (label: string, dataArray: number[], isTotal = false) => (
    <tr className={isTotal ? "total-row" : ""}>
      <td style={{ paddingLeft: '1rem' }}>{label}</td>
      {years.map((_, i) => (
        <td key={i} className={getValueClass(dataArray[i])}>
          {formatCmaValue(dataArray[i])}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="cma-form-container">
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#F8FAFC' }}>
        FORM V - COMPUTATION OF MPBF
      </h2>
      
      <div className="cma-table-container">
        <table className="cma-table">
          <thead>
            <tr>
              <th>Particulars ({parsedData.unit})</th>
              {years.map((year, i) => (
                <th key={i} style={{ textAlign: 'right' }}>
                  <div>{yearTypes[i]}</div>
                  <div>{year}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderRow("1. Total Current Assets (TCA)", mpbf.totalCA)}
            {renderRow("2. Current Liabilities (excl. bank)", mpbf.totalCLExclBank)}
            {renderRow("3. Working Capital Gap (WCG)", mpbf.wcg, true)}
            {renderRow("4. Min Stipulated NWC (25% of TCA)", mpbf.minimumNWC)}
            {renderRow("5. Actual / Projected NWC", mpbf.actualNWC)}
            {renderRow("6. Item 3 minus Item 4", mpbf.wcg.map((w: number, i: number) => w - mpbf.minimumNWC[i]))}
            {renderRow("7. Item 3 minus Item 5", mpbf.wcg.map((w: number, i: number) => w - mpbf.actualNWC[i]))}
            {renderRow("8. MPBF (Method II)", mpbf.mpbfValue, true)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
