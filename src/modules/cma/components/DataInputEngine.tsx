import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileCheck2, AlertCircle, Loader2 } from 'lucide-react';
import { useCma } from '../context/CmaContext';
import { buildCmaExportPayload, classifyFinancialDocument, parseCmaFinancialData, recordCmaLearningExample } from '../../../lib/ai/openrouter';
import { uploadBalanceSheetFile, MAX_UPLOAD_BYTES } from '../../../lib/uploadStorage';
import { saveCmaDocument, getSavedCmaDocuments, updateCmaCaseMeta, EMPTY_CASE_META, type SavedCmaDocument, type CaseMeta, type CaseStatus } from '../../../lib/cmaDocumentStorage';
import { useAuth } from '../../../app/hooks/useAuth';
import { ManualReview } from './ManualReview';

const CASE_STATUSES: CaseStatus[] = ["New", "Under Review", "Awaiting Docs", "Memo Ready", "Approved", "Declined"];

export function DataInputEngine() {
  const { setParsedData, setIsLoading, isLoading, parsedData, computedData, balanceCheck, creditOpinion, classification, setClassification, setSourceMeta, loadSavedDocument, recommendation, setActiveTab } = useCma();
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [sourceFormat, setSourceFormat] = useState<string>("txt");
  const [rawText, setRawText] = useState("");
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

  // One step: pick a file, extract its text, classify + parse it, then jump
  // straight to the Operating Statement tab. No separate "paste text" step or
  // parse button - the file IS the input.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsLoading(true);
    setError("");
    setClassification(null);

    try {
      uploadBalanceSheetFile(file).catch(() => {
        // Best-effort - parsing below doesn't depend on this succeeding.
      });

      const extractedText = await extractFileText(file);
      setRawText(extractedText);
      setSourceName(file.name);
      const format = inferSourceFormat(file.name);
      setSourceFormat(format);

      setIsClassifying(true);
      const [classificationResult, parsed] = await Promise.all([
        classifyFinancialDocument(extractedText, file.name).catch(() => null),
        parseCmaFinancialData(extractedText, { sourceFormat: format, sourceName: file.name }),
      ]);

      setClassification(classificationResult);
      setParsedData(parsed);
      setSourceMeta({ sourceName: file.name, sourceFormat: format });
      setActiveTab(1);
    } catch (err: any) {
      setError(err.message || "Failed to parse the file");
    } finally {
      setIsClassifying(false);
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      {user && savedDocuments.length > 0 && (
        <div className="bg-card border border-foreground/8 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-foreground">Your Cases</h3>
          <div className="space-y-2">
            {savedDocuments.map((doc) => {
              // Status is read off what's already stored - no separate
              // workflow-state field to keep in sync.
              const analyzed = Boolean(doc.computedData);
              const memoReady = Boolean(doc.creditOpinion);
              const meta = doc.caseMeta;
              return (
                <div key={doc.id} className="flex items-center justify-between gap-4 border-b border-foreground/8 pb-3 last:border-b-0 last:pb-0">
                  <div>
                    <div className="text-foreground font-medium text-sm">
                      {meta?.borrowerName || doc.sourceName || doc.parsedData?.company || 'Untitled case'}
                    </div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      {[meta?.sector, meta?.facilityType, doc.classification?.docType].filter(Boolean).join(' · ') || 'Financial document'}
                      {' · '}{new Date(doc.createdAt).toLocaleString()}
                      {meta?.relationshipManager ? ` · RM: ${meta.relationshipManager}` : ''}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <select
                        value={meta?.status || 'New'}
                        disabled={statusUpdatingId === doc.id}
                        onChange={(e) => handleStatusChange(doc, e.target.value as CaseStatus)}
                        className="bg-primary/10 text-link border border-primary/20 rounded-full text-xs px-2 py-0.5 cursor-pointer"
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
                  <button className="cma-btn cma-btn-outline shrink-0" onClick={() => loadSavedDocument(doc)}>
                    Open
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium text-foreground mb-1">New Case: Upload Financials</h2>
        <p className="text-sm text-muted-foreground">
          Upload a balance sheet and P&amp;L statement. The AI auto-detects the document type and parses it into the RBI CMA format.
        </p>
      </div>

      <input
        type="file"
        accept=".pdf,.docx,.csv,.xlsx,.xls,.txt"
        className="sr-only"
        ref={fileInputRef}
        onChange={handleFileUpload}
      />
      <label
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 text-center px-6 py-14 rounded-xl border border-dashed border-foreground/15 hover:border-primary/50 bg-foreground/3 cursor-pointer transition-colors"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-6 h-6 text-link animate-spin" />
            <p className="text-sm text-foreground">{isClassifying ? "Reading and parsing financials…" : `Extracting text from ${sourceName}…`}</p>
          </>
        ) : sourceName ? (
          <>
            <FileCheck2 className="w-6 h-6 text-accent" />
            <p className="text-sm text-foreground font-medium">{sourceName}</p>
            <p className="text-xs text-muted-foreground">click to upload a different file</p>
          </>
        ) : (
          <>
            <Upload className="w-6 h-6 text-link" />
            <p className="text-sm text-foreground">Drop your balance sheet here, or click to browse</p>
            <p className="text-xs text-muted-foreground">PDF, DOCX, XLS/XLSX, CSV or TXT</p>
          </>
        )}
      </label>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {classification && (
        <div className={`p-3 rounded-lg bg-foreground/3 border ${classification.isFinancialDocument ? 'border-foreground/8' : 'border-destructive/40'}`}>
          <span className={classification.isFinancialDocument ? 'cma-badge badge-green' : 'cma-badge badge-red'}>
            {classification.isFinancialDocument ? classification.docType : 'Not a financial document'}
          </span>
          <span className="text-muted-foreground text-xs ml-3">
            Confidence: {Math.round(classification.confidence * 100)}% - {classification.reason}
          </span>
          {!classification.isFinancialDocument && (
            <p className="text-destructive text-xs mt-2">
              This doesn't look like a balance sheet or financial statement. You can still proceed, but the extracted CMA data may be inaccurate.
            </p>
          )}
        </div>
      )}

      {parsedData && (
        <div className="bg-card border border-foreground/8 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-foreground font-medium text-sm mb-1">
              Data Parsed Successfully for {parsedData.company || '(company not identified)'} ({parsedData.unit})
            </h3>
            {typeof (parsedData as any)._parseDurationMs === 'number' && (
              <p className="text-muted-foreground text-xs">
                AI parse time: {(parsedData as any)._parseDurationMs}ms
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Balance Check:</span>
            {balanceCheck.isBalanced ? (
              <span className="cma-badge badge-green">✓ Balanced</span>
            ) : (
              <span className="cma-badge badge-red">✗ Unbalanced</span>
            )}
          </div>
          {!balanceCheck.isBalanced && (
            <p className="text-destructive text-sm">
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
              <div className="p-3 rounded-lg border border-warning/30 bg-warning/10">
                <div className="text-warning text-xs font-semibold mb-1">NEEDS REVIEW</div>
                <ul className="list-disc pl-5 text-foreground text-sm space-y-0.5">
                  {reviewItems.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            );
          })()}

          <ManualReview />

          {user && (
            <div className="bg-foreground/3 border border-foreground/5 rounded-lg p-4 space-y-3">
              <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Case Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  ['borrowerName', 'Borrower Name'],
                  ['sector', 'Sector'],
                  ['facilityType', 'Facility Type'],
                  ['sanctionAmount', 'Sanction Amount (₹ Lakhs)'],
                  ['relationshipManager', 'Relationship Manager'],
                  ['assignedAnalyst', 'Assigned Analyst'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {label}
                    <input
                      value={caseMeta[key]}
                      onChange={(e) => setCaseMeta((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="bg-background border border-foreground/10 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                    />
                  </label>
                ))}
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Status
                  <select
                    value={caseMeta.status}
                    onChange={(e) => setCaseMeta((prev) => ({ ...prev, status: e.target.value as CaseStatus }))}
                    className="bg-background border border-foreground/10 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                  >
                    {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Internal Notes
                <textarea
                  value={caseMeta.notes}
                  onChange={(e) => setCaseMeta((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="bg-background border border-foreground/10 rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors resize-vertical"
                />
              </label>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
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
          {saveStatus && <p className="text-muted-foreground text-xs">{saveStatus}</p>}
        </div>
      )}
    </div>
  );
}
