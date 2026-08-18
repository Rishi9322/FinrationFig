import React from 'react';
import { CmaProvider, useCma } from '../context/CmaContext';
import { DataInputEngine } from '../components/DataInputEngine';
import { Form2OperatingStatement } from '../components/Form2OperatingStatement';
import { Form3BalanceSheet } from '../components/Form3BalanceSheet';
import { Form4HoldingPeriod } from '../components/Form4HoldingPeriod';
import { Form5Mpbf } from '../components/Form5Mpbf';
import { Form6FinancialPosition } from '../components/Form6FinancialPosition';
import { AiCreditMemorandum } from '../components/AiCreditMemorandum';
import { ScenarioProjections } from '../components/ScenarioProjections';
import { FacilityStructuring } from '../components/FacilityStructuring';
import { RiskSnapshot } from '../components/RiskSnapshot';
import { DocumentCompleteness } from '../components/DocumentCompleteness';
import { AnomalyPanel } from '../components/AnomalyPanel';
import { ExportPack } from '../components/ExportPack';
import '../../../styles/cma.css';

function CmaContent() {
  const { activeTab, setActiveTab, parsedData, creditOpinion } = useCma();

  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    "1. Upload & Validate",
    "2. Operating Statement",
    "3. Balance Sheet",
    "4. Holding Period",
    "5. MPBF",
    "6. Ratios & DSCR",
    "7. Projections",
    "8. Facility Structuring",
    "9. Generate Credit Note",
    "10. Export Pack"
  ];

  // Steps beyond Data Input need parsed financials to mean anything - gate
  // them so the flow reads as a sequence, not seven equally-valid tabs.
  const isTabLocked = (i: number) => i > 0 && !parsedData;
  const isTabDone = (i: number) => (i === 0 ? Boolean(parsedData) : i === 8 ? Boolean(creditOpinion) : Boolean(parsedData));

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
        {tabs.map((tab, i) => {
          const locked = isTabLocked(i);
          return (
            <button
              key={i}
              className={`cma-tab ${activeTab === i ? 'active' : ''}`}
              onClick={() => !locked && setActiveTab(i)}
              disabled={locked}
              title={locked ? 'Upload and parse financials first' : undefined}
              style={locked ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >
              {isTabDone(i) ? `✓ ${tab}` : tab}
            </button>
          );
        })}
      </div>

      <DocumentCompleteness />
      <AnomalyPanel />
      <RiskSnapshot />

      <div className="cma-content">
        {activeTab === 0 && <DataInputEngine />}
        {activeTab === 1 && <Form2OperatingStatement />}
        {activeTab === 2 && <Form3BalanceSheet />}
        {activeTab === 3 && <Form4HoldingPeriod />}
        {activeTab === 4 && <Form5Mpbf />}
        {activeTab === 5 && <Form6FinancialPosition />}
        {activeTab === 6 && <ScenarioProjections />}
        {activeTab === 7 && <FacilityStructuring />}
        {activeTab === 8 && <AiCreditMemorandum />}
        {activeTab === 9 && <ExportPack />}
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
