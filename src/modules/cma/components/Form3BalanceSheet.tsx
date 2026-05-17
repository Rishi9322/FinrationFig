import React from 'react';
import { useCma } from '../context/CmaContext';
import { formatCmaValue, getValueClass } from '../../../lib/finance/cmaUtils';

export function Form3BalanceSheet() {
  const { parsedData, computedData } = useCma();

  if (!parsedData || !computedData) {
    return <div style={{ color: '#94A3B8' }}>Please load or parse data first.</div>;
  }

  const { years, yearTypes, balanceSheet: bs } = parsedData;
  const { financialPosition: fp } = computedData;

  const renderRow = (label: string, dataArray: number[], isTotal = false, indent = 0) => (
    <tr className={isTotal ? "total-row" : ""}>
      <td style={{ paddingLeft: `${indent * 1.5 + 1}rem` }}>{label}</td>
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
        FORM III - ANALYSIS OF BALANCE SHEET
      </h2>
      
      <div className="cma-table-container">
        <table className="cma-table">
          <thead>
            <tr>
              <th>LIABILITIES ({parsedData.unit})</th>
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
              <td colSpan={years.length + 1}>CURRENT LIABILITIES</td>
            </tr>
            {renderRow("1. Short-term borrowings from banks", bs.currentLiabilities.totalBankBorrowings, false, 1)}
            {renderRow("3. Sundry Creditors", bs.currentLiabilities.sundryCreditors, false, 1)}
            {renderRow("5. Provision for Taxation & Gratuity", bs.currentLiabilities.provisionTaxGratuity, false, 1)}
            {renderRow("9. Other Current Liabilities", bs.currentLiabilities.otherCurrentLiabilities, false, 1)}
            {renderRow("10. TOTAL CURRENT LIABILITIES", bs.currentLiabilities.totalCurrentLiabilities, true)}

            <tr className="header-row">
              <td colSpan={years.length + 1}>TERM LIABILITIES</td>
            </tr>
            {renderRow("13. Term Loans", bs.termLiabilities.termLoansExclInstalment, false, 1)}
            {renderRow("16. Unsecured Loans", bs.termLiabilities.unsecuredLoans, false, 1)}
            {renderRow("17. TOTAL TERM LIABILITIES", bs.termLiabilities.totalTermLiabilities, true)}
            
            {renderRow("18. TOTAL OUTSIDE LIABILITIES", bs.totalOutsideLiabilities, true)}

            <tr className="header-row">
              <td colSpan={years.length + 1}>NET WORTH</td>
            </tr>
            {renderRow("19. Ordinary Share Capital", bs.netWorth.ordinaryShareCapital, false, 1)}
            {renderRow("23. Surplus / Deficit in P&L", bs.netWorth.surplusDeficitPL, false, 1)}
            {renderRow("24. NET WORTH", bs.netWorth.totalNetWorth, true)}

            {renderRow("25. TOTAL LIABILITIES", fp.totalLiabilities, true)}
          </tbody>
        </table>
      </div>

      <div className="cma-table-container">
        <table className="cma-table">
          <thead>
            <tr>
              <th>ASSETS ({parsedData.unit})</th>
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
              <td colSpan={years.length + 1}>CURRENT ASSETS</td>
            </tr>
            {renderRow("26. Cash & Bank Balances", bs.currentAssets.cashAndBank, false, 1)}
            {renderRow("28. Receivables", bs.currentAssets.tradeReceivablesDomestic, false, 1)}
            {renderRow("30. Inventory (Finished Goods)", bs.currentAssets.finishedGoodsStock, false, 1)}
            {renderRow("33. Other Current Assets", bs.currentAssets.otherCurrentAssets, false, 1)}
            {renderRow("34. TOTAL CURRENT ASSETS", bs.currentAssets.totalCurrentAssets, true)}

            <tr className="header-row">
              <td colSpan={years.length + 1}>FIXED ASSETS</td>
            </tr>
            {renderRow("35. Gross Block", bs.fixedAssets.grossBlock, false, 1)}
            {renderRow("36. Depreciation to date", bs.fixedAssets.depreciationToDate, false, 1)}
            {renderRow("37. NET BLOCK", bs.fixedAssets.netBlock, true)}

            {renderRow("41. TOTAL NON-CURRENT ASSETS", bs.totalNonCurrentAssets, true)}
            {renderRow("43. TOTAL ASSETS", fp.totalAssets, true)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
