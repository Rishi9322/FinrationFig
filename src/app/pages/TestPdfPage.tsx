import React, { useRef, useState } from "react";

export default function TestPdfPage() {
  const [result, setResult] = useState<string>("Waiting...");
  
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setResult("Loading pdfjs...");
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
      const pdfjsLib = pdfjs.default || pdfjs;
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

      setResult("Reading buffer...");
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);

      setResult("Parsing PDF...");
      const loadingTask = pdfjsLib.getDocument({ data: uint8 });
      const doc = await loadingTask.promise;
      const maxPages = doc.numPages;
      const textParts: string[] = [];
      for (let i = 1; i <= maxPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((it: any) => (it as any).str || "");
        textParts.push(strings.join(" "));
      }
      setResult("SUCCESS! First 100 chars: " + textParts.join(" \n").substring(0, 100));
    } catch (err: any) {
      setResult("ERROR: " + err.message + "\n" + err.stack);
    }
  };

  return (
    <div>
      <h1>Test PDF Upload</h1>
      <input type="file" accept=".pdf" id="pdf-upload" onChange={handleFile} />
      <pre id="result">{result}</pre>
    </div>
  );
}
