import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BalanceSheetReport } from "./BalanceSheetReport";
import { sampleParsed as parsed } from "../../../lib/__fixtures__/sampleParsed";

describe("BalanceSheetReport as a document", () => {
  const html = renderToStaticMarkup(<BalanceSheetReport parsed={parsed} />);

  it("shows our rating, the key financials with their unit, and the reasoning", () => {
    expect(html).toContain("Our rating");
    expect(html).toMatch(/We rate these financials [ABCD]/);
    expect(html).toContain("Key financials");
    expect(html).toContain("₹ lakhs, as stated in the file");
    expect(html).toContain("4,200");
    expect(html).toContain("How the rating is built");
    expect(html).toContain("not a credit rating or a lending decision");
  });

  it("labels rupee amounts with the statement's unit, so lakhs are not read as rupees", () => {
    expect(html).toContain("₹2,340.00 lakhs"); // net working capital
    expect(html).not.toMatch(/₹[\d,.]+(?! lakhs)[^\d,.]/);
  });

  it("places the business against listed peers", () => {
    expect(html).toContain("How you compare with peers");
    expect(html).toContain("Better than");
    expect(html).toContain("All listed non-financial companies");
    expect(html).toContain("Operating Margin");
  });

  it("has a print-only title for the exported PDF", () => {
    expect(html).toContain("print-only");
    expect(html).toContain("Financial Assessment Report");
    expect(html).toContain("sample-traders-fy2025-26.pdf");
  });
});
