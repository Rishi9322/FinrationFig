import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"

const sessionUser = vi.fn()

// Only the two functions the component calls. Importing the real module would
// pull in the Firebase client, which never settles under jsdom.
vi.mock("../../lib/auth", () => ({
  getCurrentUser: () => sessionUser(),
  fetchCurrentUser: async () => sessionUser(),
}))

import { ProtectedRoute } from "./ProtectedRoute"

function asUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    name: "Test",
    email: "t@example.com",
    role: "USER",
    businessConstitution: "Proprietorship",
    calculatorAccess: [],
    ...overrides,
  }
}

function renderGated(user: Record<string, unknown>) {
  sessionUser.mockReturnValue(user)
  render(
    <MemoryRouter>
      <ProtectedRoute requiredFeature="cma-generator">
        <div>CMA ENGINE CONTENTS</div>
      </ProtectedRoute>
    </MemoryRouter>,
  )
}

describe("ProtectedRoute restricted tools", () => {
  beforeEach(() => sessionUser.mockReset())

  it("shows coming soon instead of the tool when the grant is missing", async () => {
    renderGated(asUser({ calculatorAccess: ["dscr"] }))

    expect(await screen.findByText(/Coming Soon/i)).toBeInTheDocument()
    // The point of the gate: the tool itself must not render.
    expect(screen.queryByText("CMA ENGINE CONTENTS")).not.toBeInTheDocument()
  })

  it("renders the tool once the feature has been granted", async () => {
    renderGated(asUser({ calculatorAccess: ["cma-generator"] }))

    expect(await screen.findByText("CMA ENGINE CONTENTS")).toBeInTheDocument()
  })

  it("lets an admin through without an explicit grant", async () => {
    renderGated(asUser({ role: "ADMIN", calculatorAccess: [] }))

    await waitFor(() => expect(screen.getByText("CMA ENGINE CONTENTS")).toBeInTheDocument())
  })
})
