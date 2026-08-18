import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCma } from '../context/CmaContext';
import { streamCmaCreditOpinion, generateCreditRecommendation } from '../../../lib/ai/openrouter';
import { extractMemoSummary as extractSummary, riskLevelColor as riskColor } from '../../../lib/finance/creditMemoSummary';

export function AiCreditMemorandum() {
  const {
    parsedData, computedData, creditOpinion, setCreditOpinion, isStreaming, setIsStreaming,
    recommendation, setRecommendation, isGeneratingRecommendation, setIsGeneratingRecommendation,
    isVerified,
  } = useCma();
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingTextRef = useRef('');
  const flushTimerRef = useRef<number | null>(null);

  const flushPendingText = () => {
    if (!pendingTextRef.current) return;
    const text = pendingTextRef.current;
    pendingTextRef.current = '';
    setCreditOpinion((prev) => prev + text);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [creditOpinion]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  const handleGenerate = async () => {
    if (!parsedData || !computedData) return;

    setIsStreaming(true);
    setCreditOpinion('');
    setRecommendation(null);
    setError('');
    pendingTextRef.current = '';
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    // Structured recommendation and narrative memo are independent AI calls -
    // run them in parallel rather than making the user wait for one before
    // the other starts.
    setIsGeneratingRecommendation(true);
    generateCreditRecommendation({ parsedData, computedData })
      .then(setRecommendation)
      .catch(() => {
        // Non-fatal: the narrative memo still has its own regex-derived
        // fallback summary if the structured call fails.
      })
      .finally(() => setIsGeneratingRecommendation(false));

    try {
      const stream = await streamCmaCreditOpinion({ parsedData, computedData });
      for await (const chunk of stream) {
        pendingTextRef.current += chunk;
        if (flushTimerRef.current === null) {
          flushTimerRef.current = window.setTimeout(() => {
            flushTimerRef.current = null;
            flushPendingText();
          }, 40);
        }
      }
      flushPendingText();
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate credit opinion.');
    } finally {
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      flushPendingText();
      setIsStreaming(false);
    }
  };

  if (!parsedData) {
    return <div style={{ color: '#94A3B8' }}>Please parse financial data first.</div>;
  }

  // Prefer the structured, schema-validated recommendation. Fall back to
  // regex-extracted values from the narrative memo only when it isn't
  // available yet (still generating, or the call failed).
  const fallbackSummary = !recommendation && creditOpinion ? extractSummary(creditOpinion) : null;
  const riskLevel = recommendation ? recommendation.riskRating.toLowerCase() as 'low' | 'moderate' | 'high' : fallbackSummary?.riskLevel ?? null;
  const riskBadge = riskLevel ? (
    <span className="cma-badge" style={{ backgroundColor: `${riskColor(riskLevel)}22`, color: riskColor(riskLevel) }}>
      {riskLevel.toUpperCase()} RISK
    </span>
  ) : null;

  return (
    <div className="cma-form-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#F8FAFC' }}>
          AI CREDIT MEMORANDUM
        </h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {riskBadge}
          <button className="cma-btn" onClick={handleGenerate} disabled={isStreaming}>
            {isStreaming ? 'Generating…' : (creditOpinion ? 'Regenerate' : 'Generate Opinion')}
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#EF4444', marginBottom: '1rem' }}>{error}</div>}

      {!isVerified && (
        <div style={{ color: '#F59E0B', fontSize: '0.85rem', marginBottom: '1rem', padding: '0.6rem 0.9rem', border: '1px solid #F59E0B55', borderRadius: '6px', backgroundColor: '#F59E0B11' }}>
          Data has not been marked verified on the Data Input tab. You can still generate a memo, but confirm the
          key figures first - the memo is only as reliable as the numbers behind it.
        </div>
      )}

      {recommendation ? (
        <div style={{
          backgroundColor: '#0E1218', border: `1px solid ${riskColor(riskLevel)}55`,
          borderRadius: '8px', padding: '1.1rem 1.25rem', marginBottom: '1rem',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recommendation</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}>{recommendation.recommendation}</div>
            </div>
            {recommendation.ccLimit !== null && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>CC Limit</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#F8FAFC' }}>₹ {recommendation.ccLimit.toLocaleString('en-IN')} Lakhs</div>
              </div>
            )}
            {recommendation.tlLimit !== null && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Term Loan Eligibility</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#F8FAFC' }}>₹ {recommendation.tlLimit.toLocaleString('en-IN')} Lakhs</div>
              </div>
            )}
          </div>
          {recommendation.rationale && (
            <p style={{ color: '#E2E8F0', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{recommendation.rationale}</p>
          )}
          {recommendation.conditionsPrecedent.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Conditions Precedent</div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#E2E8F0', fontSize: '0.85rem' }}>
                {recommendation.conditionsPrecedent.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          {recommendation.monitoringPoints.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Post-Disbursement Monitoring</div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#E2E8F0', fontSize: '0.85rem' }}>
                {recommendation.monitoringPoints.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : isGeneratingRecommendation ? (
        <div style={{ color: '#94A3B8', fontSize: '0.85rem', marginBottom: '1rem' }}>Generating structured recommendation…</div>
      ) : fallbackSummary && (fallbackSummary.recommendation || fallbackSummary.ccLimit || fallbackSummary.tlLimit) ? (
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center',
            backgroundColor: '#0E1218', border: `1px solid ${riskColor(fallbackSummary.riskLevel)}55`,
            borderRadius: '8px', padding: '1.1rem 1.25rem', marginBottom: '1rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recommendation</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}>{fallbackSummary.recommendation ?? 'Pending'}</div>
          </div>
          {fallbackSummary.ccLimit && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>CC Limit</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#F8FAFC' }}>₹ {fallbackSummary.ccLimit} Lakhs</div>
            </div>
          )}
          {fallbackSummary.tlLimit && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Term Loan Eligibility</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#F8FAFC' }}>₹ {fallbackSummary.tlLimit} Lakhs</div>
            </div>
          )}
        </div>
      ) : null}

      <details className="cma-memo-details" open={isStreaming || !recommendation}>
        <summary style={{ cursor: 'pointer', color: '#94A3B8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          {creditOpinion ? 'Full memorandum' : 'Memo output'}
        </summary>
        <div
          ref={scrollRef}
          className="cma-memo"
          style={{
            backgroundColor: '#0E1218', border: '1px solid #1A2030', borderRadius: '8px',
            padding: '2rem', minHeight: '400px', maxHeight: '600px', overflowY: 'auto',
            lineHeight: '1.6', color: '#E2E8F0', fontSize: '0.95rem',
          }}
        >
          {creditOpinion ? (
            // The model replies in Markdown. react-markdown escapes HTML by
            // default, which matters because this is untrusted model output.
            <Markdown remarkPlugins={[remarkGfm]}>{creditOpinion}</Markdown>
          ) : (
            <div style={{ color: '#64748B', fontStyle: 'italic', display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              Click "Generate Opinion" to stream a credit memorandum from the cloud AI.
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
