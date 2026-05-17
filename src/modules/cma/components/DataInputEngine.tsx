import React, { useState, useRef } from 'react';
import { useCma } from '../context/CmaContext';
import { parseCmaFinancialData } from '../../../lib/ai/openrouter';

export function DataInputEngine() {
  const { loadSampleData, setParsedData, setIsLoading, isLoading, parsedData, balanceCheck } = useCma();
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      const parsed = await parseCmaFinancialData(rawText);
      setParsedData(parsed);
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
    
    try {
      const lowerName = file.name.toLowerCase();
      let extractedText = "";

      if (lowerName.endsWith('.pdf')) {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        
        const buffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        const loadingTask = pdfjs.getDocument({ data: uint8 });
        const doc = await loadingTask.promise;
        const maxPages = doc.numPages;
        const textParts: string[] = [];
        for (let i = 1; i <= maxPages; i++) {
          try {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            
            // Group items by Y coordinate to preserve rows
            const itemMap = new Map<number, any[]>();
            content.items.forEach((item: any) => {
              if (!item.str.trim()) return;
              // transform[5] is the Y coordinate (bottom-up), transform[4] is X coordinate
              const y = Math.round(item.transform[5]); 
              // group lines within 4 pixels of each other into the same row bucket
              const bucketY = Math.round(y / 4) * 4;
              
              if (!itemMap.has(bucketY)) itemMap.set(bucketY, []);
              itemMap.get(bucketY)!.push(item);
            });
            
            // Sort Y descending (since PDF coordinates are typically bottom-to-top)
            const sortedY = Array.from(itemMap.keys()).sort((a, b) => b - a);
            
            for (const y of sortedY) {
              const rowItems = itemMap.get(y)!;
              // Sort row elements by X coordinate ascending (left-to-right)
              rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
              // Join row with a separator that AI can easily interpret as columns
              const rowText = rowItems.map(it => it.str).join(' | ');
              textParts.push(rowText);
            }
            textParts.push("--- PAGE " + i + " ---");
          } catch (err) {
            console.error("Page extraction error:", err);
          }
        }
        extractedText = textParts.join("\n");
      } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        const wb = XLSX.read(data, { type: "array" });
        const first = wb.SheetNames[0];
        const ws = wb.Sheets[first];
        extractedText = XLSX.utils.sheet_to_csv(ws);
      } else if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
        extractedText = await file.text();
      } else {
        throw new Error("Unsupported file format. Please upload PDF, XLS/XLSX, or CSV.");
      }

      setRawText(extractedText);
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
            accept=".pdf,.csv,.xlsx,.xls,.txt" 
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
          Paste raw balance sheet and P&L data below, or upload a PDF/XLS/CSV file. The AI will parse it into the RBI CMA format.
        </p>
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
        </div>
      )}
    </div>
  );
}
