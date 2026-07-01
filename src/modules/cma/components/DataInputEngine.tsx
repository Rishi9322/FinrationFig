import React, { useState, useRef, useEffect } from 'react';
import { useCma } from '../context/CmaContext';
import { buildCmaExportPayload, classifyFinancialDocument, parseCmaFinancialData, recordCmaLearningExample } from '../../../lib/ai/openrouter';
import { uploadBalanceSheetFile } from '../../../lib/uploadStorage';
import { saveCmaDocument, getSavedCmaDocuments, type SavedCmaDocument } from '../../../lib/cmaDocumentStorage';
import { useAuth } from '../../../app/hooks/useAuth';

export function DataInputEngine() {
  const { loadSampleData, setParsedData, setIsLoading, isLoading, parsedData, computedData, balanceCheck, creditOpinion, classification, setClassification, sourceMeta, setSourceMeta, loadSavedDocument } = useCma();
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
    try {
      setIsClassifying(true);
      try {
        const result = await classifyFinancialDocument(rawText, sourceName || undefined);
        setClassification(result);
      } catch (classifyErr) {
        setClassification(null);
      } finally {
        setIsClassifying(false);
      }

      const parsed = await parseCmaFinancialData(rawText, {
        sourceFormat,
        sourceName: sourceName || undefined,
      });
      setParsedData(parsed);
      setSourceMeta({ sourceName, sourceFormat });
    } catch (err: any) {
      setError(err.message || "Failed to parse data");
    } finally {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Data Input Engine</h2>
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
            Data Parsed Successfully for {parsedData.company} ({parsedData.unit})
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

      {user && savedDocuments.length > 0 && (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#111720', borderRadius: '6px', border: '1px solid #1A2030' }}>
          <h3 style={{ marginBottom: '1rem', color: '#F8FAFC' }}>My Saved Documents</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {savedDocuments.map((doc) => (
              <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1A2030', paddingBottom: '0.5rem' }}>
                <div>
                  <div style={{ color: '#E2E8F0' }}>{doc.sourceName || doc.parsedData?.company || 'Untitled document'}</div>
                  <div style={{ color: '#64748B', fontSize: '0.75rem' }}>
                    {doc.classification?.docType || 'Financial document'} · {new Date(doc.createdAt).toLocaleString()}
                  </div>
                </div>
                <button className="cma-btn cma-btn-outline" onClick={() => loadSavedDocument(doc)}>
                  Load
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
