import React from "react"
import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { CmaProvider } from "../context/CmaContext"
import { DataInputEngine } from "./DataInputEngine"

vi.mock("../../../app/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-1", email: "test@example.com" }, isLoading: false, error: null }),
}))

vi.mock("../../../lib/uploadStorage", () => ({
  uploadBalanceSheetFile: vi.fn().mockResolvedValue({ id: "upload-1" }),
}))

vi.mock("../../../lib/cmaDocumentStorage", () => ({
  saveCmaDocument: vi.fn().mockResolvedValue({ id: "doc-1" }),
  getSavedCmaDocuments: vi.fn().mockResolvedValue([]),
}))

const classifyResponse = {
  isFinancialDocument: true,
  docType: "Balance Sheet",
  confidence: 0.92,
  reason: "Contains assets, liabilities, and net worth line items.",
}

const parsedResponse = {
  company: "Test Co",
  unit: "Rs. Lakhs",
  years: ["2024-25"],
  yearTypes: ["Actual"],
  operatingStatement: { grossSales: [100] },
  balanceSheet: { totalAssets: [500], totalLiabilities: [500] },
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, opts: any) => {
    const body = JSON.parse(opts.body);
    const isClassify = body.messages[0].content.includes("classify uploaded documents");
    const content = isClassify ? classifyResponse : parsedResponse;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    };
  }));
});

describe("DataInputEngine classification + save flow", () => {
  it("classifies pasted text as a financial document and shows the badge", async () => {
    render(
      <CmaProvider>
        <DataInputEngine />
      </CmaProvider>
    );

    const textarea = screen.getByPlaceholderText(/paste raw financial text/i);
    fireEvent.change(textarea, { target: { value: "Total Assets 500\nTotal Liabilities 500" } });

    fireEvent.click(screen.getByText("Parse & Structure Data"));

    await waitFor(() => expect(screen.getByText("Balance Sheet")).toBeInTheDocument());
    expect(screen.getByText(/Confidence: 92%/)).toBeInTheDocument();
    expect(screen.getByText(/Test Co/)).toBeInTheDocument();
  });

  it("accepts docx/pdf/xlsx/csv in the file input", () => {
    render(
      <CmaProvider>
        <DataInputEngine />
      </CmaProvider>
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toContain(".docx");
    expect(input.accept).toContain(".pdf");
  });
});
