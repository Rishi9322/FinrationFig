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
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
}))

vi.mock("../../../lib/cmaDocumentStorage", () => ({
  saveCmaDocument: vi.fn().mockResolvedValue({ id: "doc-1" }),
  getSavedCmaDocuments: vi.fn().mockResolvedValue([]),
  updateCmaCaseMeta: vi.fn().mockResolvedValue(undefined),
  EMPTY_CASE_META: {
    borrowerName: "", sector: "", facilityType: "", sanctionAmount: "",
    relationshipManager: "", assignedAnalyst: "", status: "New", notes: "",
  },
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

function uploadFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { value: [file], configurable: true })
  fireEvent.change(input)
}

describe("DataInputEngine classification + save flow", () => {
  it("classifies an uploaded file as a financial document and shows the badge", async () => {
    render(
      <CmaProvider>
        <DataInputEngine />
      </CmaProvider>
    );

    // The company name must appear in the source: a parsed name that is absent
    // from the document is treated as leaked from a training example and blanked.
    const file = new File(
      ["Balance Sheet of Test Co\nTotal Assets 500\nTotal Liabilities 500"],
      "balance-sheet.txt",
      { type: "text/plain" },
    )
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    uploadFile(input, file)

    await waitFor(() => expect(screen.getByText("Balance Sheet")).toBeInTheDocument());
    expect(screen.getByText(/Confidence: 92%/)).toBeInTheDocument();
    expect(screen.getByText(/Data Parsed Successfully for/)).toHaveTextContent("Test Co");
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

  it("rejects a file over the upload size limit before parsing", async () => {
    render(
      <CmaProvider>
        <DataInputEngine />
      </CmaProvider>
    );
    const oversized = new File(["x"], "huge.txt", { type: "text/plain" })
    Object.defineProperty(oversized, "size", { value: 11 * 1024 * 1024 })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    uploadFile(input, oversized)

    await waitFor(() => expect(screen.getByText(/exceeds the 10 MB limit/i)).toBeInTheDocument());
  });
});
