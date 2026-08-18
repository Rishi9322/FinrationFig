import React from 'react';
import { useCma } from '../context/CmaContext';

// Deterministic checks only - no AI call, no fabricated "we detected a missing
// bank statement" claim we can't back up. Everything here is read off the
// parsed structure itself: year coverage, document classification, and
// sections that are suspiciously all-zero (a common sign extraction missed a
// page rather than the business genuinely having no receivables/fixed assets).
type Severity = 'info' | 'warn';

interface CompletenessItem {
  severity: Severity;
  message: string;
}

const allZero = (arr: number[] | undefined) => !arr || arr.every((v) => !v);

export function DocumentCompleteness() {
  const { parsedData, classification } = useCma();
  if (!parsedData) return null;

  const items: CompletenessItem[] = [];
  const { years, yearTypes, operatingStatement, balanceSheet } = parsedData;

  // Year coverage - a standard RBI CMA runs 2 actual + current + 2 projected (5 years).
  if (years.length < 5) {
    items.push({ severity: 'info', message: `Only ${years.length} year(s) of data present - a standard CMA covers 5 (2 actual, 1 current, 2 projected).` });
  }
  if (!yearTypes.includes('Actual')) {
    items.push({ severity: 'warn', message: 'No year is marked "Actual" - CMA submissions need at least one audited/actual year.' });
  }
  if (!yearTypes.includes('Projected')) {
    items.push({ severity: 'info', message: 'No "Projected" years present - add projections if this is for a term loan or renewal assessment.' });
  }

  // Sections that should essentially never be genuinely zero for an operating
  // business - a zero here more likely means the source page wasn't captured.
  if (allZero(operatingStatement?.netSales)) {
    items.push({ severity: 'warn', message: 'Net Sales is zero across all years - the Operating Statement page may not have been extracted.' });
  }
  if (allZero(balanceSheet?.fixedAssets?.grossBlock) && allZero(balanceSheet?.totalAssets)) {
    items.push({ severity: 'warn', message: 'Total Assets and Gross Block are both zero - the Balance Sheet page may not have been extracted.' });
  }

  // Document coverage - what was actually uploaded vs what a full CMA needs.
  if (classification && classification.docType !== 'CMA Form') {
    items.push({
      severity: 'info',
      message: `This upload was classified as "${classification.docType}". A complete credit file typically also includes Bank Statements, GST/ITR filings, and a Stock Statement alongside this.`,
    });
  }

  if (items.length === 0) {
    return (
      <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #1A2030', backgroundColor: '#111720', color: '#64748B', fontSize: '0.85rem' }}>
        Document coverage looks complete - full year range and no zero-filled core sections.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #2563EB55', backgroundColor: '#2563EB0d' }}>
      <div style={{ color: '#60A5FA', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>DOCUMENT COMPLETENESS</div>
      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
        {items.map((item, i) => (
          <li key={i} style={{ color: item.severity === 'warn' ? '#F59E0B' : '#E2E8F0', marginBottom: '0.2rem' }}>
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
