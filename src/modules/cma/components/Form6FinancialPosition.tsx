import React from 'react';
import { useCma } from '../context/CmaContext';
import { formatCmaValue, getValueClass } from '../../../lib/finance/cmaUtils';

export function Form6FinancialPosition() {
  const { parsedData, computedData } = useCma();

  if (!parsedData || !computedData) {
    return <div style={{ color: '#94A3B8' }}>Please load or parse data first.</div>;
  }

  const { years, yearTypes } = parsedData;
  const { dscr, ratios, financialPosition: fp } = computedData;

  const renderRow = (label: string, dataArray: number[], isRatio = false) => (
    <tr>
      <td style={{ paddingLeft: '1rem' }}>{label}</td>
      {years.map((_, i) => (
        <td key={i} className={getValueClass(dataArray[i])}>
          {formatCmaValue(dataArray[i])}{isRatio ? 'x' : ''}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="cma-form-container">
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#F8FAFC' }}>
        FORM VI - FINANCIAL POSITION & DSCR
      </h2>
      
      <div className="cma-table-container">
        <table className="cma-table">
          <thead>
            <tr>
              <th>KEY RATIOS & INDICATORS</th>
              {years.map((year, i) => (
                <th key={i} style={{ textAlign: 'right' }}>
                  <div>{yearTypes[i]}</div>
                  <div>{year}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="header-row">
              <td colSpan={years.length + 1}>Ratios</td>
            </tr>
            {renderRow("Current Ratio (Benchmark ≥ 1.33)", ratios.currentRatio, true)}
            {renderRow("TOL / TNW (Benchmark ≤ 3.0)", ratios.tolToTNW, true)}
            {renderRow("DSCR", dscr.dscrRatio, true)}
            
            <tr className="header-row">
              <td colSpan={years.length + 1}>Financial Position ({parsedData.unit})</td>
            </tr>
            {renderRow("Tangible Net Worth", fp.tangibleNetWorth)}
            {renderRow("Net Working Capital", fp.netWorkingCapital)}
            {renderRow("Total Assets", fp.totalAssets)}
            {renderRow("Net Profit", fp.netProfit)}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#F8FAFC' }}>
        DSCR CALCULATION
      </h3>
      <div className="cma-table-container">
        <table className="cma-table">
          <thead>
            <tr>
              <th>Particulars</th>
              {years.map((year, i) => (
                <th key={i} style={{ textAlign: 'right' }}>{year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderRow("A. Net Profit + Depr + Interest", dscr.dscrNumerator)}
            {renderRow("B. TL Instalment + Interest", dscr.dscrDenominator)}
            <tr className="total-row">
              <td style={{ paddingLeft: '1rem' }}>DSCR (A/B)</td>
              {years.map((_, i) => (
                <td key={i} className={dscr.dscrRatio[i] < 1.25 ? 'val-negative' : 'val-positive'}>
                  {formatCmaValue(dscr.dscrRatio[i])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
