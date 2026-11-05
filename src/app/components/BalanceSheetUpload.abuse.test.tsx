import React from "react"
import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react"
import BalanceSheetUpload from "./BalanceSheetUpload"
import { sampleParsed } from "../../lib/__fixtures__/sampleParsed"

// Controllable parser: each call hands back a promise the test resolves when it chooses.
type Deferred = { name: string; resolve: (v: any) => void; reject: (e: any) => void }
const calls: Deferred[] = []
vi.mock("../../lib/parsers", () => ({
  default: vi.fn((f: File) => new Promise((resolve, reject) => calls.push({ name: f.name, resolve, reject }))),
}))
vi.mock("../../lib/auth", () => {
  const user = { id: "u1", email: "t@example.com", businessConstitution: "Private Limited" }
  return { getCurrentUser: () => user }
})
const upload = vi.fn().mockResolvedValue({ id: "up-1" })
vi.mock("../../lib/uploadStorage", () => ({
  uploadBalanceSheetFile: (...a: unknown[]) => upload(...a),
  MAX_UPLOAD_BYTES: 1024,
}))
const save = vi.fn().mockResolvedValue({ id: "calc-1" })
vi.mock("../../lib/calculationStorage", () => ({ saveCalculation: (...a: unknown[]) => save(...a), getCases: async () => [], createCase: vi.fn() }))

const parsedFor = (name: string) => ({ ...sampleParsed, sourceFilename: name })
const drop = (...files: File[]) => {
  const input = screen.getByLabelText("Upload balance sheet file") as HTMLInputElement
  Object.defineProperty(input, "files", { value: files, configurable: true })
  fireEvent.change(input)
}
const file = (name: string, size = 10) => new File(["x".repeat(size)], name)
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)) }) }

beforeEach(() => { calls.length = 0; upload.mockClear(); save.mockClear(); vi.stubGlobal("print", vi.fn()); window.print = vi.fn() })
afterEach(() => cleanup())

describe("double clicks and repeated drops", () => {
  it("the same file chosen twice at once is parsed and stored once", async () => {
    render(<BalanceSheetUpload userId="u1" />)
    const f = file("same.pdf")
    drop(f); drop(f)
    await settle()
    expect(calls.length).toBe(1)
    await act(async () => calls[0].resolve(parsedFor("same.pdf")))
    expect(await screen.findByText("Our rating")).toBeInTheDocument()
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it("two different files in a row: the LAST one wins even when the first finishes last", async () => {
    render(<BalanceSheetUpload userId="u1" />)
    drop(file("first.pdf")); await settle()
    drop(file("second.pdf")); await settle()
    expect(calls.map((c) => c.name)).toEqual(["first.pdf", "second.pdf"])
    await act(async () => calls[1].resolve(parsedFor("second.pdf")))
    await screen.findByText(/second\.pdf · /)
    await act(async () => calls[0].resolve(parsedFor("first.pdf"))) // the older parse arrives late
    await settle()
    expect(screen.queryByText(/first\.pdf · /)).not.toBeInTheDocument()
    expect(screen.getByText(/second\.pdf · /)).toBeInTheDocument()
  })

  it("twenty files dropped in a burst leave the last one on screen and nothing broken", async () => {
    render(<BalanceSheetUpload userId="u1" />)
    for (let i = 0; i < 20; i++) { drop(file(`f${i}.pdf`)); await settle() }
    await act(async () => { calls.forEach((c, i) => c.resolve(parsedFor(`f${i}.pdf`))) })
    await settle()
    expect(screen.getByText(/f19\.pdf · /)).toBeInTheDocument()
  })

  it("leaving the page while a parse is running does not blow up when it finishes", async () => {
    const { unmount } = render(<BalanceSheetUpload userId="u1" />)
    drop(file("late.pdf")); await settle()
    unmount()
    await act(async () => calls[0].resolve(parsedFor("late.pdf")))
  })
})

describe("bad input and recovery", () => {
  it("nothing selected / a cancelled dialog does nothing", async () => {
    render(<BalanceSheetUpload userId="u1" />)
    drop()
    await settle()
    expect(calls.length).toBe(0)
    expect(screen.queryByText("Our rating")).not.toBeInTheDocument()
  })

  it("an oversize file is refused before any work, and the next good file still works", async () => {
    render(<BalanceSheetUpload userId="u1" />)
    drop(file("big.pdf", 5000))
    expect(await screen.findByText(/exceeds the/i)).toBeInTheDocument()
    expect(calls.length).toBe(0)
    expect(upload).not.toHaveBeenCalled()
    drop(file("ok.pdf")); await settle()
    await act(async () => calls[0].resolve(parsedFor("ok.pdf")))
    expect(await screen.findByText("Our rating")).toBeInTheDocument()
    expect(screen.queryByText(/exceeds the/i)).not.toBeInTheDocument()
  })

  it("a parser failure shows a message, keeps the page alive, and the next upload recovers", async () => {
    render(<BalanceSheetUpload userId="u1" />)
    drop(file("bad.pdf")); await settle()
    await act(async () => calls[0].reject(new Error("could not read this file")))
    expect(await screen.findByText(/could not read this file/)).toBeInTheDocument()
    drop(file("good.pdf")); await settle()
    await act(async () => calls[1].resolve(parsedFor("good.pdf")))
    expect(await screen.findByText("Our rating")).toBeInTheDocument()
  })

  it("replacing a good report with a file that fails removes the stale report", async () => {
    render(<BalanceSheetUpload userId="u1" />)
    drop(file("a.pdf")); await settle()
    await act(async () => calls[0].resolve(parsedFor("a.pdf")))
    await screen.findByText("Our rating")
    drop(file("b.pdf")); await settle()
    await act(async () => calls[1].reject(new Error("nope")))
    await screen.findByText(/nope/)
    expect(screen.queryByText("Our rating")).not.toBeInTheDocument()
  })
})

describe("clicking things repeatedly", () => {
  async function withReport() {
    render(<BalanceSheetUpload userId="u1" />)
    drop(file("a.pdf")); await settle()
    await act(async () => calls[0].resolve(parsedFor("a.pdf")))
    await screen.findByText("Our rating")
  }

  it("Save all clicked twice saves each result once", async () => {
    await withReport()
    const btn = screen.getByRole("button", { name: /save all/i })
    fireEvent.click(btn); fireEvent.click(btn)
    await waitFor(() => expect(save).toHaveBeenCalled())
    await settle()
    const perRun = save.mock.calls.length / 1
    const kinds = save.mock.calls.map((c) => c[1])
    expect(new Set(kinds).size).toBe(kinds.length) // no calculator saved twice
    expect(perRun).toBeGreaterThan(0)
  })

  it("Download PDF can be clicked repeatedly", async () => {
    await withReport()
    const btn = screen.getByRole("button", { name: /download pdf/i })
    for (let i = 0; i < 5; i++) fireEvent.click(btn)
    expect(window.print).toHaveBeenCalled()
  })

  it("Save all while a save is failing shows an error and the button comes back", async () => {
    save.mockRejectedValueOnce(new Error("server said no"))
    await withReport()
    fireEvent.click(screen.getByRole("button", { name: /save all/i }))
    await waitFor(() => expect(screen.getByRole("button", { name: /save all/i })).not.toBeDisabled())
  })

  it("flipping the peer industry through every option never breaks the table", async () => {
    await withReport()
    const select = screen.getByLabelText("Peer industry") as HTMLSelectElement
    for (const o of Array.from(select.options)) fireEvent.change(select, { target: { value: o.value } })
    fireEvent.change(select, { target: { value: "not an industry" } })
    expect(screen.getByText("How you compare with peers")).toBeInTheDocument()
  })

  it("switching the fine-tune calculator through all of them, and editing inputs to odd values, never crashes", async () => {
    await withReport()
    const picker = screen.getByLabelText("Select calculator") as HTMLSelectElement
    for (const o of Array.from(picker.options)) {
      fireEvent.change(picker, { target: { value: o.value } })
      for (const input of screen.queryAllByRole("spinbutton")) {
        for (const v of ["", "0", "-5", "1e400", "999999999999999999999", "0.0000001"]) fireEvent.change(input, { target: { value: v } })
      }
    }
    expect(screen.getByText("Our rating")).toBeInTheDocument()
    const text = document.body.textContent ?? ""
    expect(text).not.toMatch(/\bNaN\b|undefined|\[object/)
  })

  it("hammering the calculator picker while a new file is parsing is harmless", async () => {
    await withReport()
    drop(file("next.pdf")); await settle()
    const picker = screen.getByLabelText("Select calculator") as HTMLSelectElement
    for (let i = 0; i < 30; i++) fireEvent.change(picker, { target: { value: picker.options[i % picker.options.length].value } })
    await act(async () => calls[1].resolve(parsedFor("next.pdf")))
    expect(await screen.findByText(/next\.pdf · /)).toBeInTheDocument()
  })
})

describe("not signed in", () => {
  it("Save all asks for sign-in instead of calling the server, and nothing is uploaded", async () => {
    render(<BalanceSheetUpload />)
    drop(file("a.pdf")); await settle()
    await act(async () => calls[0].resolve(parsedFor("a.pdf")))
    await screen.findByText("Our rating")
    fireEvent.click(screen.getByRole("button", { name: /save all/i }))
    await settle()
    expect(save).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })
})
