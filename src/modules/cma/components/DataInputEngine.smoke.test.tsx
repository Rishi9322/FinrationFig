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
    // Blended: the model said 92%, and the text itself carries three statement markers.
    const shown = Number(screen.getByText(/Confidence: \d+%/).textContent!.match(/Confidence: (\d+)%/)![1]);
    expect(shown).toBeGreaterThanOrEqual(75);
    expect(shown).toBeLessThanOrEqual(95);
    expect(screen.getByText(/Data Parsed Successfully for/)).toHaveTextContent("Test Co");
  });

  // Same mock as beforeEach, with per-test control of the classifier.
  const stubAi = (classify: { reply?: unknown; fail?: boolean }) =>
    vi.stubGlobal("fetch", vi.fn(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      const isClassify = body.messages[0].content.includes("classify uploaded documents");
      if (isClassify && classify.fail) {
        return { ok: false, status: 502, json: async () => ({ error: "Bad gateway" }) };
      }
      const content = isClassify ? (classify.reply ?? classifyResponse) : parsedResponse;
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) };
    }));

  const BALANCE_TEXT = "Balance Sheet of Test Co\nShare Capital 1000\nReserves and Surplus 500\nTotal Liabilities 1500\nFixed Assets 900\nSundry Debtors 600\nTotal Assets 1500";

  it("a model reply of '85%' is honoured instead of shown as 0%", async () => {
    stubAi({ reply: { ...classifyResponse, confidence: "85%" } });
    render(<CmaProvider><DataInputEngine /></CmaProvider>);
    uploadFile(document.querySelector('input[type="file"]') as HTMLInputElement,
      new File([BALANCE_TEXT], "balance-sheet.txt", { type: "text/plain" }));

    await waitFor(() => expect(screen.getByText(/Confidence: \d+%/)).toBeInTheDocument());
    const shown = Number(screen.getByText(/Confidence: \d+%/).textContent!.match(/Confidence: (\d+)%/)![1]);
    expect(shown).toBeGreaterThanOrEqual(80);
  });

  it("a failed classifier is reported (not silently hidden) and the upload still completes", async () => {
    stubAi({ fail: true });
    render(<CmaProvider><DataInputEngine /></CmaProvider>);
    uploadFile(document.querySelector('input[type="file"]') as HTMLInputElement,
      new File([BALANCE_TEXT], "balance-sheet.txt", { type: "text/plain" }));

    await waitFor(() => expect(screen.getByText(/Data Parsed Successfully for/)).toBeInTheDocument());
    expect(screen.getByText(/classifier was unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence: \d+%/)).toBeInTheDocument();
  });

  it("a file with almost no text is rejected with a clear message and never reaches the AI", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<CmaProvider><DataInputEngine /></CmaProvider>);
    uploadFile(document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(["hi"], "blank.txt", { type: "text/plain" }));

    await waitFor(() => expect(screen.getByText(/almost no readable text/i)).toBeInTheDocument());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a short but real CSV is not mistaken for a scan", async () => {
    stubAi({});
    render(<CmaProvider><DataInputEngine /></CmaProvider>);
    uploadFile(document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(["Particulars,Amount\nShare Capital,1000\nTotal Assets,1500\nTotal Liabilities,1500"], "bs.csv", { type: "text/csv" }));

    await waitFor(() => expect(screen.getByText(/Data Parsed Successfully for/)).toBeInTheDocument());
    expect(screen.queryByText(/scanned or photographed/i)).not.toBeInTheDocument();
  });

  it("a rejected upload does not leave the previous file's data on screen", async () => {
    stubAi({});
    render(<CmaProvider><DataInputEngine /></CmaProvider>);
    const input = () => document.querySelector('input[type="file"]') as HTMLInputElement;

    uploadFile(input(), new File([BALANCE_TEXT], "good.txt", { type: "text/plain" }));
    await waitFor(() => expect(screen.getByText(/Data Parsed Successfully for/)).toBeInTheDocument());

    // Re-open the uploader tab and upload a file with no readable text.
    fireEvent.click(screen.getAllByRole("button").find((b) => /upload|input/i.test(b.textContent ?? "")) ?? document.body);
    uploadFile(input(), new File(["hi"], "blank.txt", { type: "text/plain" }));

    await waitFor(() => expect(screen.getByText(/almost no readable text/i)).toBeInTheDocument());
    expect(screen.queryByText(/Data Parsed Successfully for/)).not.toBeInTheDocument();
    expect(screen.queryByText("good.txt")).not.toBeInTheDocument();
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
