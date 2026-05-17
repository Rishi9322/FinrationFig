import React from 'react';
import { CmaProvider, useCma } from '../context/CmaContext';
import { DataInputEngine } from '../components/DataInputEngine';
import { Form2OperatingStatement } from '../components/Form2OperatingStatement';
import { Form3BalanceSheet } from '../components/Form3BalanceSheet';
import { Form4HoldingPeriod } from '../components/Form4HoldingPeriod';
import { Form5Mpbf } from '../components/Form5Mpbf';
import { Form6FinancialPosition } from '../components/Form6FinancialPosition';
import { AiCreditMemorandum } from '../components/AiCreditMemorandum';
import '../../../styles/cma.css';

function CmaContent() {
  const { activeTab, setActiveTab } = useCma();

  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    "1. Data Input",
    "2. Operating Statement",
    "3. Balance Sheet",
    "4. Holding Period",
    "5. MPBF",
    "6. Ratios & DSCR",
    "7. AI Opinion"
  ];

  return (
    <div className="cma-container">
      <div className="cma-header">
        <div className="cma-title">Finratio CMA Engine</div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="cma-btn cma-btn-outline no-print" onClick={handlePrint}>
            Export / Print
          </button>
        </div>
      </div>
      
      <div className="cma-tabs no-print">
        {tabs.map((tab, i) => (
          <button 
            key={i} 
            className={`cma-tab ${activeTab === i ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="cma-content">
        {activeTab === 0 && <DataInputEngine />}
        {activeTab === 1 && <Form2OperatingStatement />}
        {activeTab === 2 && <Form3BalanceSheet />}
        {activeTab === 3 && <Form4HoldingPeriod />}
        {activeTab === 4 && <Form5Mpbf />}
        {activeTab === 5 && <Form6FinancialPosition />}
        {activeTab === 6 && <AiCreditMemorandum />}
      </div>
    </div>
  );
}

export default function CmaGeneratorPage() {
  return (
    <CmaProvider>
      <CmaContent />
    </CmaProvider>
  );
}
