// Word statements -> text rows. mammoth's raw-text mode puts every table cell on
// its own line, which destroys the label/amount pairing; converting to HTML
// keeps the table rows intact so each becomes one "label | amount | ..." line.

/** HTML from mammoth -> one line per paragraph, one " | "-joined line per table row. */
export function htmlToRows(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines: string[] = [];
  for (const el of Array.from(doc.body.children)) {
    if (el.tagName === "TABLE") {
      for (const tr of Array.from(el.querySelectorAll("tr"))) {
        const cells = Array.from(tr.children).map((c) => (c.textContent ?? "").trim()).filter(Boolean);
        if (cells.length) lines.push(cells.join(" | "));
      }
    } else {
      const text = (el.textContent ?? "").trim();
      if (text) lines.push(text);
    }
  }
  return lines.join("\n");
}

export async function docxToText(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  let html: string;
  try {
    // Browser build: reads an ArrayBuffer.
    html = (await mammoth.convertToHtml({ arrayBuffer: buffer })).value;
  } catch (err) {
    // Node build (tests): only accepts a Buffer.
    if (!/could not find file/i.test(String((err as Error)?.message)) || typeof Buffer === "undefined") throw err;
    html = (await mammoth.convertToHtml({ buffer: Buffer.from(buffer) } as any)).value;
  }
  return htmlToRows(html);
}
