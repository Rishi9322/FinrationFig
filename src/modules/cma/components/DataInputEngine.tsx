import React, { useState, useRef, useEffect } from 'react';
import { useCma } from '../context/CmaContext';
import { buildCmaExportPayload, classifyFinancialDocument, parseCmaFinancialData, recordCmaLearningExample } from '../../../lib/ai/openrouter';
import { uploadBalanceSheetFile } from '../../../lib/uploadStorage';
import { saveCmaDocument, getSavedCmaDocuments, updateCmaCaseMeta, EMPTY_CASE_META, type SavedCmaDocument, type CaseMeta, type CaseStatus } from '../../../lib/cmaDocumentStorage';
import { useAuth } from '../../../app/hooks/useAuth';
import { ManualReview } from './ManualReview';

const CASE_STATUSES: CaseStatus[] = ["New", "Under Review", "Awaiting Docs", "Memo Ready", "Approved", "Declined"];

export function DataInputEngine() {
  const { loadSampleData, setParsedData, setIsLoading, isLoading, parsedData, computedData, balanceCheck, creditOpinion, classification, setClassification, sourceMeta, setSourceMeta, loadSavedDocument, recommendation } = useCma();
  const { user } = useAuth();
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [sourceFormat, setSourceFormat] = useState<string>("txt");
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [savedDocuments, setSavedDocuments] = useState<SavedCmaDocument[]>([]);
  const [caseMeta, setCaseMeta] = useState<CaseMeta>(EMPTY_CASE_META);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const handleStatusChange = async (doc: SavedCmaDocument, status: CaseStatus) => {
    setStatusUpdatingId(doc.id);
    // Optimistic - the case list is the whole point of this control, so it
    // should feel instant even though the PUT is a real network round trip.
    setSavedDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, caseMeta: { ...d.caseMeta, status } } : d));
    try {
      await updateCmaCaseMeta(doc, { status });
    } catch {
      // Revert on failure rather than leave the UI claiming a status that
      // didn't actually save.
      setSavedDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, caseMeta: doc.caseMeta } : d));
    } finally {
      setStatusUpdatingId(null);
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      setSavedDocuments([]);
      return;
    }
    getSavedCmaDocuments(user.id).then(setSavedDocuments).catch(() => setSavedDocuments([]));
  }, [user]);

  const inferSourceFormat = (fileName: string) => {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.pdf')) return 'pdf';
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) return 'xlsx';
    if (lowerName.endsWith('.docx')) return 'docx';
    if (lowerName.endsWith('.csv')) return 'csv';
    if (lowerName.endsWith('.txt')) return 'txt';
    return 'other';
  };

  const extractFileText = async (file: File) => {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.pdf')) {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const loadingTask = pdfjs.getDocument({ data: uint8 });
      const doc = await loadingTask.promise;
      const textParts: string[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        try {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          const itemMap = new Map<number, any[]>();

          content.items.forEach((item: any) => {
            if (!item.str.trim()) return;
            const y = Math.round(item.transform[5]);
            const bucketY = Math.round(y / 4) * 4;

            if (!itemMap.has(bucketY)) itemMap.set(bucketY, []);
            itemMap.get(bucketY)!.push(item);
          });

          const sortedY = Array.from(itemMap.keys()).sort((a, b) => b - a);
          for (const y of sortedY) {
            const rowItems = itemMap.get(y)!;
            rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
            textParts.push(rowItems.map((it) => it.str).join(' | '));
          }
          textParts.push(`--- PAGE ${i} ---`);
        } catch (pageError) {
          console.error('Page extraction error:', pageError);
        }
      }

      return textParts.join('\n');
    }

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const wb = XLSX.read(data, { type: 'array' });
      const sheetParts: string[] = [];

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const sheetCsv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
        sheetParts.push(`--- SHEET: ${sheetName} ---`);
        sheetParts.push(sheetCsv);
      }

      return sheetParts.join('\n');
    }

    if (lowerName.endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const buffer = await file.arrayBuffer();
      const res = await mammoth.extractRawText({ arrayBuffer: buffer });
      return String(res.value || '');
    }

    if (lowerName.endsWith('.doc')) {
      throw new Error('Legacy .doc files are not supported. Please convert to .docx or PDF and re-upload.');
    }

    if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
      return await file.text();
    }

    throw new Error('Unsupported file format. Please upload PDF, DOCX, XLS/XLSX, or CSV.');
  };

  const downloadJson = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setIsLoading(true);
    setError("");
    setIsClassifying(true);
    try {
      const [classificationResult, parsed] = await Promise.all([
        classifyFinancialDocument(rawText, sourceName || undefined).catch(() => null),
        parseCmaFinancialData(rawText, {
          sourceFormat,
          sourceName: sourceName || undefined,
        }),
      ]);

      setClassification(classificationResult);
      setParsedData(parsed);
      setSourceMeta({ sourceName, sourceFormat });
    } catch (err: any) {
      setError(err.message || "Failed to parse data");
    } finally {
      setIsClassifying(false);
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError("");
    setUploadStatus(null);
    setClassification(null);

    try {
      try {
        await uploadBalanceSheetFile(file);
        setUploadStatus(`Stored ${file.name} in the file uploads table.`);
      } catch (uploadErr: any) {
        setUploadStatus(uploadErr?.message ? `File parsed locally, but upload storage was skipped: ${uploadErr.message}` : 'File parsed locally, but upload storage was skipped.');
      }

      const extractedText = await extractFileText(file);
      setRawText(extractedText);
      setSourceName(file.name);
      setSourceFormat(inferSourceFormat(file.name));
    } catch (err: any) {
      setError(err.message || "Failed to extract text from file");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="cma-input-engine">
      {user && savedDocuments.length > 0 && (
        <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#111720', borderRadius: '6px', border: '1px solid #1A2030' }}>
          <h3 style={{ marginBottom: '1rem', color: '#F8FAFC' }}>Your Cases</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {savedDocuments.map((doc) => {
              // Status is read off what's already stored - no separate
              // workflow-state field to keep in sync.
              const analyzed = Boolean(doc.computedData);
              const memoReady = Boolean(doc.creditOpinion);
              const meta = doc.caseMeta;
              return (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1A2030', paddingBottom: '0.5rem' }}>
                  <div>
                    <div style={{ color: '#E2E8F0', fontWeight: 500 }}>
                      {meta?.borrowerName || doc.sourceName || doc.parsedData?.company || 'Untitled case'}
                    </div>
                    <div style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      {[meta?.sector, meta?.facilityType, doc.classification?.docType].filter(Boolean).join(' · ') || 'Financial document'}
                      {' · '}{new Date(doc.createdAt).toLocaleString()}
                      {meta?.relationshipManager ? ` · RM: ${meta.relationshipManager}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                      <select
                        value={meta?.status || 'New'}
                        disabled={statusUpdatingId === doc.id}
                        onChange={(e) => handleStatusChange(doc, e.target.value as CaseStatus)}
                        style={{
                          backgroundColor: '#2563EB22', color: '#60A5FA', border: '1px solid #2563EB55',
                          borderRadius: '999px', fontSize: '0.75rem', padding: '0.15rem 0.5rem', cursor: 'pointer',
                        }}
                      >
                        {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span className="cma-badge badge-green">Docs received</span>
                      <span className={analyzed ? 'cma-badge badge-green' : 'cma-badge badge-amber'}>
                        {analyzed ? 'Analysis complete' : 'Analysis pending'}
                      </span>
                      <span className={memoReady ? 'cma-badge badge-green' : 'cma-badge badge-amber'}>
                        {memoReady ? 'Memo ready' : 'Memo pending'}
                      </span>
                    </div>
                  </div>
                  <button className="cma-btn cma-btn-outline" onClick={() => loadSavedDocument(doc)}>
                    Open
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>New Case: Upload Financials</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="file"
            accept=".pdf,.docx,.csv,.xlsx,.xls,.txt"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button 
            className="cma-btn cma-btn-outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            Upload File
          </button>
          <button className="cma-btn cma-btn-outline" onClick={loadSampleData}>
            Load Sample Data
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <p style={{ color: '#94A3B8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
          Paste raw balance sheet and P&L data below, or upload a PDF/DOCX/XLS/CSV file. The AI will auto-detect the document type and parse it into the RBI CMA format.
        </p>
        {uploadStatus && (
          <p style={{ color: '#94A3B8', marginBottom: '0.5rem', fontSize: '0.8rem' }}>{uploadStatus}</p>
        )}
        <textarea 
          style={{
            width: '100%',
            height: '250px',
            backgroundColor: '#111720',
            border: '1px solid #1A2030',
            color: '#E2E8F0',
            padding: '1rem',
            borderRadius: '6px',
            fontFamily: 'monospace',
            resize: 'vertical'
          }}
          placeholder="Paste raw financial text here..."
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button 
          className="cma-btn" 
          onClick={handleParse} 
          disabled={isLoading || !rawText.trim()}
        >
          {isLoading ? "Processing..." : "Parse & Structure Data"}
        </button>
        {error && <span style={{ color: '#EF4444', fontSize: '0.875rem' }}>{error}</span>}
      </div>

      {isClassifying && (
        <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginTop: '0.75rem' }}>Checking document type…</p>
      )}
      {classification && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          border: `1px solid ${classification.isFinancialDocument ? '#1A2030' : '#EF4444'}`,
          backgroundColor: '#111720',
        }}>
          <span className={classification.isFinancialDocument ? 'cma-badge badge-green' : 'cma-badge badge-red'}>
            {classification.isFinancialDocument ? classification.docType : 'Not a financial document'}
          </span>
          <span style={{ color: '#94A3B8', fontSize: '0.8rem', marginLeft: '0.75rem' }}>
            Confidence: {Math.round(classification.confidence * 100)}% — {classification.reason}
          </span>
          {!classification.isFinancialDocument && (
            <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              This doesn't look like a balance sheet or financial statement. You can still proceed, but the extracted CMA data may be inaccurate.
            </p>
          )}
        </div>
      )}

      {parsedData && (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#111720', borderRadius: '6px', border: '1px solid #1A2030' }}>
          <h3 style={{ marginBottom: '1rem', color: '#F8FAFC' }}>
            Data Parsed Successfully for {parsedData.company || '(company not identified)'} ({parsedData.unit})
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#94A3B8' }}>Balance Check:</span>
            {balanceCheck.isBalanced ? (
              <span className="cma-badge badge-green">✓ Balanced</span>
            ) : (
              <span className="cma-badge badge-red">✗ Unbalanced</span>
            )}
          </div>
          {!balanceCheck.isBalanced && (
            <p style={{ color: '#EF4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Warning: Total Assets and Total Liabilities do not match in some years.
            </p>
          )}

          {/* Consolidates real review signals already computed elsewhere - no
              fabricated per-field confidence scores, only things we actually know. */}
          {(() => {
            const reviewItems: string[] = [];
            if (!parsedData.company) {
              reviewItems.push('Company name could not be verified against the source document - confirm manually.');
            }
            if (!balanceCheck.isBalanced) {
              reviewItems.push('Balance sheet does not tie out for one or more years.');
            }
            if (classification && classification.confidence < 0.6) {
              reviewItems.push(`Document type detection confidence is low (${Math.round(classification.confidence * 100)}%) - verify this is the intended statement.`);
            }
            if (classification && !classification.isFinancialDocument) {
              reviewItems.push('This document was not identified as a financial statement.');
            }
            if (reviewItems.length === 0) return null;
            return (
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #F59E0B55', backgroundColor: '#F59E0B11' }}>
                <div style={{ color: '#F59E0B', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>NEEDS REVIEW</div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#E2E8F0', fontSize: '0.85rem' }}>
                  {reviewItems.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            );
          })()}

          <ManualReview />

          {user && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', backgroundColor: '#0E1218', borderRadius: '6px', border: '1px solid #1A2030' }}>
              <div style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Case Details
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {([
                  ['borrowerName', 'Borrower Name'],
                  ['sector', 'Sector'],
                  ['facilityType', 'Facility Type'],
                  ['sanctionAmount', 'Sanction Amount (₹ Lakhs)'],
                  ['relationshipManager', 'Relationship Manager'],
                  ['assignedAnalyst', 'Assigned Analyst'],
                ] as const).map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem', color: '#94A3B8' }}>
                    {label}
                    <input
                      value={caseMeta[key]}
                      onChange={(e) => setCaseMeta((prev) => ({ ...prev, [key]: e.target.value }))}
                      style={{ backgroundColor: '#111720', border: '1px solid #1A2030', color: '#F8FAFC', padding: '0.45rem', borderRadius: '4px' }}
                    />
                  </label>
                ))}
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem', color: '#94A3B8' }}>
                  Status
                  <select
                    value={caseMeta.status}
                    onChange={(e) => setCaseMeta((prev) => ({ ...prev, status: e.target.value as CaseStatus }))}
                    style={{ backgroundColor: '#111720', border: '1px solid #1A2030', color: '#F8FAFC', padding: '0.45rem', borderRadius: '4px' }}
                  >
                    {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.75rem' }}>
                Internal Notes
                <textarea
                  value={caseMeta.notes}
                  onChange={(e) => setCaseMeta((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  style={{ backgroundColor: '#111720', border: '1px solid #1A2030', color: '#F8FAFC', padding: '0.45rem', borderRadius: '4px', resize: 'vertical' }}
                />
              </label>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              className="cma-btn cma-btn-outline"
              onClick={() => downloadJson(`${sourceName || parsedData.company || 'cma'}-export.json`, buildCmaExportPayload(parsedData as Record<string, unknown>, {
                sourceName,
                sourceFormat,
                balanceCheck,
              }))}
            >
              Download CMA JSON
            </button>
            <button
              className="cma-btn cma-btn-outline"
              onClick={() => {
                recordCmaLearningExample(rawText, parsedData as Record<string, unknown>, {
                  sourceFormat,
                  model: 'openrouter',
                  sourceName: sourceName || undefined,
                });
                setError('');
              }}
            >
              Save as learning example
            </button>
            <button
              className="cma-btn cma-btn-outline"
              disabled={!user || isSaving}
              onClick={async () => {
                if (!user) {
                  setSaveStatus('Sign in to save this document to your account.');
                  return;
                }
                setIsSaving(true);
                setSaveStatus(null);
                try {
                  await saveCmaDocument(user.id, {
                    sourceName,
                    sourceFormat,
                    classification,
                    parsedData,
                    computedData,
                    creditOpinion,
                    caseMeta,
                    recommendation,
                  });
                  setSaveStatus('Saved to your account.');
                  const docs = await getSavedCmaDocuments(user.id);
                  setSavedDocuments(docs);
                } catch (err: any) {
                  setSaveStatus(err?.message || 'Failed to save document.');
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving ? 'Saving…' : 'Save to My Documents'}
            </button>
          </div>
          {saveStatus && <p style={{ color: '#94A3B8', fontSize: '0.8rem', marginTop: '0.5rem' }}>{saveStatus}</p>}
        </div>
      )}

    </div>
  );
}
