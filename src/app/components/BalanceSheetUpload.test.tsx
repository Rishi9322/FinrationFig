import React from "react"
import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import BalanceSheetUpload from "./BalanceSheetUpload"

// The screen as a user meets it: drop a file, read the report. Only storage and the session are faked.
vi.mock("../../lib/auth", () => {
  const user = { id: "u1", email: "t@example.com", businessConstitution: "Private Limited" }
  return { getCurrentUser: () => user }
})
vi.mock("../../lib/uploadStorage", () => ({
  uploadBalanceSheetFile: vi.fn().mockResolvedValue({ id: "up-1" }),
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
}))

const STATEMENT = [
  "Share Capital 100", "Reserves and Surplus 400", "Term Loan 300", "Bank OD 100", "Sundry Creditors 300",
  "Closing Stock 500", "Sundry Debtors 400", "Cash and Bank 100", "Plant and Machinery 200",
  "Total Assets 1,200", "Total Liabilities 1,200",
  "Sales 5,000", "Interest on Term Loan 30", "Depreciation 20", "Net Profit 150",
].join("\n")

function drop(file: File) {
  const input = screen.getByLabelText("Upload balance sheet file") as HTMLInputElement
  Object.defineProperty(input, "files", { value: [file], configurable: true })
  fireEvent.change(input)
}

describe("BalanceSheetUpload", () => {
  it("turns a dropped statement into the assessment report", async () => {
    render(<BalanceSheetUpload userId="u1" />)
    drop(new File([STATEMENT], "firm.txt", { type: "text/plain" }))

    expect(await screen.findByText("Our rating", {}, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByText(/We rate these financials [ABCD]/)).toBeInTheDocument()
    expect(screen.getByText("Key financials", { exact: false })).toBeInTheDocument()
    expect(screen.getByText("How you compare with peers")).toBeInTheDocument()
    expect(screen.getByText("Our view")).toBeInTheDocument()
    // the file's own figures made it through: sales and total assets
    expect(screen.getAllByText(/5,000/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1,200/).length).toBeGreaterThan(0)
    cleanup()
  })

  it("does not offer a consolidated/standalone switch for a file that has only one set", async () => {
    render(<BalanceSheetUpload userId="u1" />)
    drop(new File([STATEMENT], "firm.txt", { type: "text/plain" }))
    await screen.findByText("Our rating", {}, { timeout: 10000 })
    expect(screen.queryByText(/both sets of statements/i)).not.toBeInTheDocument()
    cleanup()
  })

  it("says why when a file cannot be read, instead of showing a made-up report", async () => {
    render(<BalanceSheetUpload userId="u1" />)
    drop(new File(["hello world"], "notes.txt", { type: "text/plain" }))
    // nothing usable: the report still renders, but with no grade and a low-confidence warning
    expect(await screen.findByText(/Too few measures could be calculated/i, {}, { timeout: 10000 })).toBeInTheDocument()
    cleanup()
  })
})
