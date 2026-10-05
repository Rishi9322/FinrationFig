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
  // mammoth's Node build only accepts a Buffer; its browser build only an ArrayBuffer.
  const isNode = typeof process !== "undefined" && !!process.versions?.node;
  const input = isNode ? ({ buffer: Buffer.from(buffer) } as any) : { arrayBuffer: buffer };
  const html = (await mammoth.convertToHtml(input)).value;
  return htmlToRows(html);
}
