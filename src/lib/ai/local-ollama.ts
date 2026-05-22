/// <reference types="vite/client" />
/**
 * Frontend client for the local Financial AI Expert server (port 3001).
 * Provides the same interface as openrouter.ts so components can switch between them.
 */

const LOCAL_API = import.meta.env.VITE_LOCAL_AI_URL ?? 'http://localhost:3001';

export async function checkLocalAiHealth(): Promise<{ ready: boolean; model: string }> {
  try {
    const res = await fetch(`${LOCAL_API}/api/health`);
    const data = await res.json();
    return { ready: data.status === 'ready', model: data.model ?? 'unknown' };
  } catch {
    return { ready: false, model: 'offline' };
  }
}

/**
 * Parse raw text / financial data using the local extraction pipeline.
 * Accepts a list of { label, value, year, source_file } items.
 */
export async function extractAndComputeCma(
  items: Array<{ label: string; value: number; year?: string; source_file?: string }>,
  years: string[]
) {
  const res = await fetch(`${LOCAL_API}/api/cma/extract-and-compute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, years }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Local AI error ${res.status}`);
  }
  return res.json();
}

/**
 * Same interface as parseCmaFinancialData from openrouter.ts but routes to local Qwen model.
 * Accepts raw text, sends to the local server's analyze endpoint.
 */
export async function parseCmaFinancialDataLocal(rawText: string) {
  const res = await fetch(`${LOCAL_API}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: rawText, analysisType: 'comprehensive' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Local AI error ${res.status}`);
  }
  const data = await res.json();
  return data.analysis;
}

/**
 * Streaming credit opinion from local Qwen model.
 * Yields text chunks just like the OpenRouter streaming version.
 */
export async function* streamCmaCreditOpinionLocal(cmaData: {
  model: object;
  years: string[];
  companyName?: string;
}): AsyncGenerator<string> {
  const res = await fetch(`${LOCAL_API}/api/cma/credit-opinion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cmaData),
  });

  if (!res.ok) throw new Error(`Local AI server error ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        if (json.chunk) yield json.chunk;
        if (json.error) throw new Error(json.error);
      } catch { /* ignore malformed chunks */ }
    }
  }
}
