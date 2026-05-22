import React, { useState, useEffect, useRef } from 'react';
import { useCma } from '../context/CmaContext';
import { streamCmaCreditOpinion } from '../../../lib/ai/openrouter';
import { streamCmaCreditOpinionLocal, checkLocalAiHealth } from '../../../lib/ai/local-ollama';

type AiMode = 'cloud' | 'local';

export function AiCreditMemorandum() {
  const { parsedData, computedData, creditOpinion, setCreditOpinion, isStreaming, setIsStreaming } = useCma();
  const [error, setError] = useState('');
  const [mode, setMode] = useState<AiMode>('cloud');
  const [localStatus, setLocalStatus] = useState<{ ready: boolean; model: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkLocalAiHealth().then(setLocalStatus);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [creditOpinion]);

  const handleGenerate = async () => {
    if (!parsedData || !computedData) return;

    setIsStreaming(true);
    setCreditOpinion('');
    setError('');

    try {
      if (mode === 'local') {
        const stream = streamCmaCreditOpinionLocal({
          model: computedData,
          years: parsedData.years ?? [],
          companyName: parsedData.company ?? 'the borrower',
        });
        for await (const chunk of stream) {
          setCreditOpinion((prev) => prev + chunk);
        }
      } else {
        const stream = await streamCmaCreditOpinion({ parsedData, computedData });
        for await (const chunk of stream) {
          setCreditOpinion((prev) => prev + chunk);
        }
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate credit opinion.');
    } finally {
      setIsStreaming(false);
    }
  };

  if (!parsedData) {
    return <div style={{ color: '#94A3B8' }}>Please parse financial data first.</div>;
  }

  const lowerOpinion = creditOpinion.toLowerCase();
  let riskBadge = null;
  if (lowerOpinion.includes('risk rating: high') || lowerOpinion.includes('credit risk rating: high')) {
    riskBadge = <span className="cma-badge badge-red">HIGH RISK</span>;
  } else if (lowerOpinion.includes('risk rating: moderate') || lowerOpinion.includes('credit risk rating: moderate')) {
    riskBadge = <span className="cma-badge badge-amber">MODERATE RISK</span>;
  } else if (lowerOpinion.includes('risk rating: low') || lowerOpinion.includes('credit risk rating: low')) {
    riskBadge = <span className="cma-badge badge-green">LOW RISK</span>;
  }

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

      {/* AI source toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>AI source:</span>
        <button
          onClick={() => setMode('cloud')}
          style={{
            padding: '0.25rem 0.75rem', borderRadius: '6px', border: '1px solid',
            borderColor: mode === 'cloud' ? '#6366F1' : '#2D3748',
            backgroundColor: mode === 'cloud' ? '#1E1B4B' : 'transparent',
            color: mode === 'cloud' ? '#A5B4FC' : '#64748B', fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          ☁ Cloud (OpenRouter)
        </button>
        <button
          onClick={() => setMode('local')}
          title={localStatus?.ready ? `Model: ${localStatus.model}` : 'Start financial-ai-expert server first'}
          style={{
            padding: '0.25rem 0.75rem', borderRadius: '6px', border: '1px solid',
            borderColor: mode === 'local' ? '#10B981' : '#2D3748',
            backgroundColor: mode === 'local' ? '#064E3B' : 'transparent',
            color: mode === 'local' ? '#6EE7B7' : '#64748B', fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          {localStatus?.ready ? `⚡ Local (${localStatus.model})` : '⚡ Local (offline)'}
        </button>
        {mode === 'local' && !localStatus?.ready && (
          <span style={{ color: '#F59E0B', fontSize: '0.78rem' }}>
            Run: <code style={{ background: '#1C1917', padding: '1px 4px', borderRadius: 3 }}>
              cd financial-ai-expert &amp;&amp; npm start
            </code>
          </span>
        )}
      </div>

      {error && <div style={{ color: '#EF4444', marginBottom: '1rem' }}>{error}</div>}

      <div
        ref={scrollRef}
        style={{
          backgroundColor: '#0E1218', border: '1px solid #1A2030', borderRadius: '8px',
          padding: '2rem', minHeight: '400px', maxHeight: '600px', overflowY: 'auto',
          whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#E2E8F0', fontSize: '0.95rem',
        }}
      >
        {creditOpinion || (
          <div style={{ color: '#64748B', fontStyle: 'italic', display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            {mode === 'local'
              ? 'Click "Generate Opinion" to run Qwen 2.5 7B locally on your GPU — no data leaves your machine.'
              : 'Click "Generate Opinion" to stream a credit memorandum from the cloud AI.'}
          </div>
        )}
      </div>

      {mode === 'local' && localStatus?.ready && (
        <div style={{ marginTop: '0.5rem', color: '#6B7280', fontSize: '0.78rem' }}>
          Privacy: all processing on your machine. No external API calls.
        </div>
      )}
    </div>
  );
}
