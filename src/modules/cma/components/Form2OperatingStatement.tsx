import React from 'react';
import { useCma } from '../context/CmaContext';
import { formatCmaValue, getValueClass, calculateYoY } from '../../../lib/finance/cmaUtils';

export function Form2OperatingStatement() {
  const { parsedData, computedData } = useCma();

  if (!parsedData || !computedData) {
    return <div style={{ color: '#94A3B8' }}>Please load or parse data first.</div>;
  }

  const { years, yearTypes, operatingStatement: os } = parsedData;
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
        FORM II - OPERATING STATEMENT
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
            {renderRow("1. Gross Sales", os.grossSales)}
            {renderRow("I) Domestic Sales", os.grossSales, false, 1)}
            {renderRow("II) Export Sales", os.exportSales, false, 1)}
            {renderRow("2. Less: Excise Duty", os.exciseDuty)}
            {renderRow("3. NET SALES", os.netSales, true)}
            
            {/* % Rise/Fall */}
            <tr>
              <td style={{ paddingLeft: '1rem' }}>4. % Rise/Fall in Net Sales</td>
              {years.map((_, i) => {
                const yoy = i > 0 ? calculateYoY(os.netSales[i], os.netSales[i-1]) : "-";
                return <td key={i} className={yoy.includes('(') ? 'val-negative' : 'val-positive'}>{yoy}</td>;
              })}
            </tr>

            <tr className="header-row">
              <td colSpan={years.length + 1}>COST OF SALES</td>
            </tr>
            {renderRow("I) Raw Materials", [0], false, 1)} /* Placeholder since we need combined */
            {renderRow("a) Imported", os.rawMaterials.imported, false, 2)}
            {renderRow("b) Indigenous", os.rawMaterials.indigenous, false, 2)}
            {renderRow("II) Other Spares", os.otherSpares, false, 1)}
            {renderRow("III) Power & Fuel", os.powerFuel, false, 1)}
            {renderRow("IV) Direct Labour", os.directLabour, false, 1)}
            {renderRow("V) Other Manufacturing Expenses", os.otherManufacturingExpenses, false, 1)}
            {renderRow("VI) Depreciation (Manufacturing)", os.depreciationManufacturing, false, 1)}
            
            {renderRow("VII) SUB-TOTAL (Cost of Production)", fp.costOfProduction, true)}
            
            {renderRow("VIII) Add: Opening Stock-in-Process", [0], false, 1)}
            {renderRow("IX) Deduct: Closing Stock-in-Process", [0], false, 1)}
            
            {renderRow("X) COST OF PRODUCTION", fp.costOfProduction, true)}
            
            {renderRow("XI) Add: Opening Stock of Finished Goods", os.openingStockFinishedGoods, false, 1)}
            {renderRow("XII) Deduct: Closing Stock of Finished Goods", os.closingStockFinishedGoods, false, 1)}
            
            {renderRow("XIII) Total Cost of Sales", fp.totalCostOfSales, true)}

            {renderRow("5. Selling, General & Admin Expenses", os.sellingAdminExpenses)}
            
            {renderRow("7. Operating Profit Before Interest", fp.operatingProfitBeforeInterest, true)}
            
            {renderRow("8. Interest (Total)", os.totalInterest)}
            
            {renderRow("9. Operating Profit After Interest", fp.operatingProfitBeforeInterest.map((v: number, i: number) => v - (os.totalInterest[i] || 0)), true)}
            
            <tr className="header-row">
              <td colSpan={years.length + 1}>Non-Operating</td>
            </tr>
            {renderRow("10. Add: Other Non-Operating Income", os.otherNonOperatingIncome, false, 1)}
            
            {renderRow("13. PROFIT BEFORE TAX", fp.profitBeforeTax, true)}
            
            {renderRow("14. Provision for Taxation", os.provisionForTax)}
            
            {renderRow("15. NET PROFIT / LOSS", fp.netProfit, true)}
            
            {renderRow("16. Equity Dividend", os.dividend)}
            
            {renderRow("17. RETAINED PROFIT", fp.retainedProfit, true)}
            
            <tr>
              <td style={{ paddingLeft: '1rem' }}>Retained Profit / Net Profit (%)</td>
              {years.map((_, i) => {
                const np = fp.netProfit[i];
                const rp = fp.retainedProfit[i];
                const pct = np > 0 ? (rp / np) * 100 : 0;
                return <td key={i}>{formatCmaValue(pct)}%</td>;
              })}
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  );
}
