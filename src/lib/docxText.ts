import { splitSides } from "./statementParsing";

// Word statements -> text rows. mammoth's raw-text mode puts every table cell on
// its own line, which destroys the label/amount pairing; converting to HTML
// keeps the table rows intact so each becomes one "label | amount | ..." line.

/** HTML from mammoth -> one line per paragraph, one " | "-joined line per table row. */
export function htmlToRows(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines: string[] = [];
  // Tables give one row per <tr>; lists one line per <li>; containers are walked into.
  const walk = (el: Element) => {
    if (el.tagName === "TABLE") {
      // Keep empty cells while splitting, so a side-by-side (liabilities | assets) table
      // can be read one side at a time; they are dropped when the row becomes a line.
      const table = Array.from(el.querySelectorAll("tr")).map((tr) => Array.from(tr.children).map((c) => (c.textContent ?? "").trim()));
      for (const row of splitSides(table)) {
        const cells = row.filter(Boolean);
        if (cells.length) lines.push(cells.join(" | "));
      }
    } else if (el.children.length && !/^(?:P|H[1-6]|LI)$/.test(el.tagName)) {
      for (const child of Array.from(el.children)) walk(child);
    } else {
      const text = (el.textContent ?? "").trim();
      if (text) lines.push(text);
    }
  };
  for (const el of Array.from(doc.body.children)) walk(el);
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
