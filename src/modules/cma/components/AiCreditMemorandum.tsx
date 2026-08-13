import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCma } from '../context/CmaContext';
import { streamCmaCreditOpinion } from '../../../lib/ai/openrouter';

export function AiCreditMemorandum() {
  const { parsedData, computedData, creditOpinion, setCreditOpinion, isStreaming, setIsStreaming } = useCma();
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [creditOpinion]);

  const handleGenerate = async () => {
    if (!parsedData || !computedData) return;

    setIsStreaming(true);
    setCreditOpinion('');
    setError('');

    try {
      const stream = await streamCmaCreditOpinion({ parsedData, computedData });
      for await (const chunk of stream) {
        setCreditOpinion((prev) => prev + chunk);
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

      {error && <div style={{ color: '#EF4444', marginBottom: '1rem' }}>{error}</div>}

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

    </div>
  );
}
