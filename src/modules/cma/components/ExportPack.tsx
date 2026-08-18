import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCma } from '../context/CmaContext';
import { ScenarioProjections } from './ScenarioProjections';
import { extractMemoSummary } from '../../../lib/finance/creditMemoSummary';

// Composes the sections that already exist elsewhere in the workflow into one
// printable document, instead of recomputing anything - this is a view, not a
// new source of truth.
export function ExportPack() {
  const { parsedData, creditOpinion, sourceMeta, recommendation } = useCma();

  if (!parsedData) {
    return <div style={{ color: '#94A3B8' }}>Please parse financial data first.</div>;
  }

  // Prefer the structured recommendation - same reasoning as AiCreditMemorandum.
  const summary = recommendation
    ? { recommendation: recommendation.recommendation, ccLimit: recommendation.ccLimit?.toString() ?? null, tlLimit: recommendation.tlLimit?.toString() ?? null }
    : creditOpinion ? extractMemoSummary(creditOpinion) : null;

  return (
    <div className="cma-form-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#F8FAFC' }}>Export Pack</h2>
        <button className="cma-btn no-print" onClick={() => window.print()}>
          Print This Pack
        </button>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', color: '#F8FAFC', marginBottom: '0.25rem' }}>
          {parsedData.company || 'Credit Analysis'}
        </h1>
        <p style={{ color: '#94A3B8', fontSize: '0.85rem' }}>
          {sourceMeta.sourceName ? `Source: ${sourceMeta.sourceName} · ` : ''}
          Generated {new Date().toLocaleDateString()}
        </p>
      </div>

      {summary && (summary.recommendation || summary.ccLimit || summary.tlLimit) && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#94A3B8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Executive Summary
          </h3>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Recommendation</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}>{summary.recommendation ?? 'Pending'}</div>
            </div>
            {summary.ccLimit && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>CC Limit</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#F8FAFC' }}>₹ {summary.ccLimit} Lakhs</div>
              </div>
            )}
            {summary.tlLimit && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Term Loan Eligibility</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#F8FAFC' }}>₹ {summary.tlLimit} Lakhs</div>
              </div>
            )}
          </div>
          {recommendation && recommendation.rationale && (
            <p style={{ color: '#E2E8F0', fontSize: '0.85rem', marginTop: '0.75rem' }}>{recommendation.rationale}</p>
          )}
          {recommendation && recommendation.conditionsPrecedent.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conditions Precedent</div>
              <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1.1rem', color: '#E2E8F0', fontSize: '0.85rem' }}>
                {recommendation.conditionsPrecedent.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          {recommendation && recommendation.monitoringPoints.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Post-Disbursement Monitoring</div>
              <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1.1rem', color: '#E2E8F0', fontSize: '0.85rem' }}>
                {recommendation.monitoringPoints.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Risk Picture, Document Completeness, and Anomalies already render in
          the persistent header above every tab - not repeated here to avoid
          printing the same panels twice. */}

      <section style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ color: '#94A3B8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
          Projections
        </h3>
        <ScenarioProjections />
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ color: '#94A3B8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
          Credit Memorandum
        </h3>
        {creditOpinion ? (
          <div style={{ color: '#E2E8F0', lineHeight: 1.6, fontSize: '0.95rem' }}>
            <Markdown remarkPlugins={[remarkGfm]}>{creditOpinion}</Markdown>
          </div>
        ) : (
          <p style={{ color: '#64748B', fontStyle: 'italic' }}>
            No memo generated yet - go to "Generate Credit Note" first.
          </p>
        )}
      </section>

      <footer style={{ borderTop: '1px solid #1A2030', paddingTop: '0.75rem', fontSize: '0.75rem', color: '#64748B' }}>
        Assumptions: projections use the growth/margin inputs set on the Projections tab at export time. Risk
        thresholds follow RBI norms (Current Ratio 1.33, TOL/TNW 3.0, DSCR 1.5). Figures are drawn from the
        uploaded source document{sourceMeta.sourceName ? ` (${sourceMeta.sourceName})` : ''}; AI-generated sections
        are marked as such above.
      </footer>
    </div>
  );
}
