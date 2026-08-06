# FinRatio UI/UX Backlog

Derived from the source-based UI/UX audit (2026-08-06). Ordered by severity × effort —
within each severity band, cheapest first, so the top of the list is always the next
thing worth picking up.

Effort scale: **XS** <1h · **S** ~half day · **M** 1–3 days · **L** ~1 week · **XL** multi-week.

Status legend: `open` · `in progress` · `done`

---

## P0 — Critical

### UX-001 · ~~Fix character-encoding corruption in customer-facing copy~~
**Effort:** XS · **Status:** INVALID — not a real defect

**This was a false finding in the audit.** Verified against the source:

- `file src/app/pages/HomePage.tsx` → "Unicode text, UTF-8 text"
- A byte-level sweep for `â€`/`Â`/`Ã`/`Î` across all of `src/` matches nothing (the only
  hit is `src/imports/image.png`, a binary false positive)
- The characters are present and correct: `—`, `₹`, `β` all render from valid UTF-8
- `index.html:4` already declares `<meta charset="UTF-8" />`

The mojibake was an artifact of the audit's own file reading — UTF-8 bytes displayed as
Latin-1 in the reading pipeline, not in the app. Nothing to fix.

---

### UX-002 · Admin mutations fail silently
**Effort:** S · **Status:** done
Every admin write is a bare `await fetch(...)` with no `response.ok` check. A 4xx/5xx
returns, the list refetches, and the operator sees a screen that looks like success.
Errors go to `console.error` where nobody is looking.

- Files: `src/app/pages/admin/AdminPermissionsPage.tsx`,
  `src/app/pages/admin/AdminSettingsPage.tsx`,
  `src/app/components/admin/CalculatorsManagement.tsx`
- Route all admin writes through one helper that throws on `!res.ok` and surfaces the
  outcome as a toast (`sonner` is already mounted in `App.tsx`)
- Accept: a forced 500 on each mutation shows an error toast and does not read as success

**Why P0:** this is a correctness bug wearing a UI costume. An admin can revoke access,
see no error, and believe it worked.

---

### UX-003 · Replace native `confirm()`/`alert()` on admin destructive actions
**Effort:** S · **Status:** done
Blocking browser dialogs for high-impact operations — unstyled, unbrandable, suppressible
by the browser, and invisible to the app's own state.

- `CalculatorsManagement.tsx:63` — "unlock all calculators"
- `AdminSettingsPage.tsx:10` — "unlock all features for all users"
- `AdminSettingsPage.tsx:34` — "archive all calculation history"
- `AdminPermissionsPage.tsx:37` — validation via `alert()`
- **Also:** `AdminPermissionsPage.handleRevokeAccess` has *no* confirmation at all —
  one click permanently revokes a role's calculator access
- Use the existing `src/app/components/ui/alert-dialog.tsx`; use inline field validation,
  not a dialog, for the "select a calculator" case
- Accept: every destructive admin action is gated by a styled dialog naming the specific
  consequence; no `confirm`/`alert` remains in `src/`

**Depends on:** UX-002 (share the same mutation helper)

---

### UX-004 · Doc parser is a debug UI shipped to customers
**Effort:** L · **Status:** open
Raw JSON in `<pre>` blocks, emoji section headings, no guidance through the
parse → map → run → save sequence, no extraction-confidence signal.

- Files: `src/app/pages/BalanceSheetAnalysisPage.tsx`,
  `src/app/components/BalanceSheetUpload.tsx`
- Redesign as a stepper: upload → review extraction → confirm field mapping (with
  per-field confidence) → run → save
- Replace JSON dumps with a labelled review table; keep the raw view behind a
  "developer details" disclosure rather than deleting it
- Accept: a first-time user completes an analysis without seeing raw JSON, and knows at
  each step what was extracted and how confident the parse was

**Why P0 despite the cost:** this surface handles the user's financial documents. It is
where trust is won or lost, and it currently reads as an internal tool.

---

## P1 — High

### UX-005 · Admin nav/route role mismatch
**Effort:** XS · **Status:** done
Corrected on inspection — the audit had the direction wrong. Three *different*
predicates existed for one concept:

- `routes.tsx:226` → `requiredRole="SUPER_ADMIN"` (strictest, and what actually applied)
- `AdminLayout.tsx:10` → admitted `ADMIN` **or** `SUPER_ADMIN` — dead permissive code,
  since the route already rejected `ADMIN` before the layout rendered
- `Navbar.tsx` → `SUPER_ADMIN` only

Resolved by adding `canAccessAdmin()` to `src/lib/auth.ts` and routing all three
through it. `hasAllCalculatorAccess()` was added the same way — that predicate was
duplicated across Navbar, DashboardPage, and CalculatorsIndexPage.

> **Open product decision:** the consolidated predicate preserves *today's actual*
> behaviour (`SUPER_ADMIN` only). `AdminLayout`'s intent looked like `ADMIN` should also
> have admin access, but widening a permission is not a refactor — decide deliberately
> and change the one predicate if `ADMIN` should be admitted.

### UX-006 · Mobile nav omits CMA
**Effort:** XS · **Status:** done
Mobile menu is missing the CMA destination present in desktop nav.
- File: `src/app/components/Navbar.tsx`
- Accept: desktop and mobile nav render from the same link array

### UX-007 · Restricted calculator cards are dead ends
**Effort:** S · **Status:** partially done — false affordance removed; real request flow still open
"Request Access" is static copy, not a control. The user is told what to do and given no
way to do it.
- File: `src/app/pages/calculators/CalculatorsIndexPage.tsx`
- **Done:** copy no longer promises an action it can't perform ("Not included in your
  plan"), plus a header line stating how many are locked and who can unlock them
- **Still open:** a real request flow needs two things that don't exist yet — a backend
  endpoint to record the request and notify an admin, and a support/admin contact address.
  Neither is in the codebase; both are product decisions, not implementation gaps.
- Related: `src/app/pages/AccessDeniedPage.tsx` has the same dead end
  ("contact your administrator" with no path)

### UX-008 · Focus states are color-only and faint
**Effort:** S · **Status:** done
Across auth forms and elsewhere. Fails keyboard users and anyone who can't perceive the
color shift; error states share the same weakness.
- Files: auth pages under `src/app/pages/auth/`, then global
- Define one focus-ring token and apply it via base styles rather than per-component
- Accept: every interactive element has a visible non-color focus indicator meeting
  WCAG 2.4.7 and 1.4.11

### UX-009 · Muted text contrast on dark surfaces
**Effort:** S · **Status:** done
Supporting text uses a very muted gray repeatedly against dark backgrounds; likely below
4.5:1.
- Audit computed contrast for every muted-text token pair, raise the failing ones
- Accept: all body text ≥4.5:1, large text ≥3:1

### UX-010 · Nav dropdown and modal keyboard semantics
**Effort:** S · **Status:** done
Calculator dropdown closes on `onBlur` timing — fragile for keyboard users, no menu ARIA
roles. Calculator modal lacks focus trapping and Escape handling in the component itself.
- Files: `src/app/components/Navbar.tsx`,
  `src/app/components/calculators/CalculatorShell.tsx`
- Reuse `ui/dropdown-menu.tsx` and `ui/dialog.tsx` — both already handle this correctly —
  rather than hand-rolling
- Also: the explainer panel in `CalculatorShell` is click-handled on a non-button element;
  make it a real `<button>`
- Accept: dropdown and modal are fully keyboard-operable; Escape closes; focus returns to
  the trigger

### UX-011 · Admin CRUD affordances incomplete
**Effort:** M · **Status:** open
"Add User", edit, and delete appear partially wired.
- File: `src/app/components/admin/UsersManagement.tsx`
- Either finish them or remove the controls — a button that does nothing is worse than an
  absent one
- Accept: every visible admin control performs its action and reports the outcome

### UX-012 · CMA tab bar breaks on narrow viewports
**Effort:** M · **Status:** open
Seven horizontal tabs with long labels.
- File: `src/modules/cma/pages/CmaGeneratorPage.tsx`
- Convert to a responsive pattern (scrollable tabs, or a stepper/sidebar below the md
  breakpoint)
- Accept: usable at 375px with no horizontal page scroll

### UX-013 · Dashboard lacks decision-support hierarchy
**Effort:** L · **Status:** open
"Overall Financial Health" requires a user-triggered AI call rather than surfacing
always-available KPIs, trends, anomalies, and next actions.
- File: `src/app/pages/DashboardPage.tsx`
- Rebuild around: KPI row → trend → alerts → recommended next actions, with the AI summary
  as enrichment rather than the entry point
- Accept: a returning user learns their financial position without clicking anything

### UX-014 · No shared empty/loading/error/success primitives
**Effort:** M · **Status:** partially done — primitives built, adoption incomplete
Each module invents its own — bare spinners, `console.error`, ad-hoc message strings.
- **Done:** `EmptyState` / `ErrorState` / `TableLoadingState` live in
  `src/app/components/ui/states.tsx`; adopted by `CalculatorsManagement` and
  `AdminPermissionsPage` (both now distinguish loading / failed / genuinely-empty
  instead of showing an empty table for all three)
- **Still open:** migrate the remaining callers — dashboard, CMA, doc parser, the other
  admin pages
- Accept: no route renders a bare spinner or a silently-swallowed error

---

## P2 — Medium

### UX-015 · Consolidate design tokens
**Effort:** L · **Status:** open
Spacing, radius, shadow, and type scale are re-declared per module instead of tokenized —
the mechanical root of the visual fragmentation.
- Extract the customer-app dark surface into tokens; this is the prerequisite for UX-019
  and UX-020

### UX-016 · Calculator explainer wastes above-the-fold space
**Effort:** XS · **Status:** done
Empty video placeholder renders even when no asset exists.
- File: `src/app/components/calculators/CalculatorShell.tsx`
- Accept: placeholder is conditional on an asset being present

### UX-017 · Table scanability in dashboard and admin
**Effort:** M · **Status:** open
Dense rows, muted metadata, no visual anchoring. Apply alignment (numerics right,
tabular figures), row grouping, and a clear primary column.

### UX-018 · No breadcrumb / page-context system in protected flows
**Effort:** S · **Status:** open
`ui/breadcrumb.tsx` already exists and is unused.

### UX-019 · Bring the doc parser into the product visual language
**Effort:** M · **Status:** open
Default shadcn `container`/`card` styling and emoji headings against the app's dark
premium surface.
**Depends on:** UX-015. Do alongside UX-004 rather than as a second pass.

### UX-020 · Bring admin and CMA into the product visual language
**Effort:** L · **Status:** open
Generic light CRUD dashboard and legacy-styled CMA module.
- Files: `src/app/components/admin/AdminLayout.tsx`, `AdminSidebar.tsx`,
  `src/modules/cma/pages/CmaGeneratorPage.tsx`
**Depends on:** UX-015

### UX-021 · Categorize calculators; add search/filter
**Effort:** S · **Status:** open
Nine calculators in one undifferentiated grid.
- File: `src/app/pages/calculators/CalculatorsIndexPage.tsx`

### UX-022 · Admin sidebar layout on short viewports
**Effort:** XS · **Status:** done
Fixed sidebar with absolutely-positioned logout.
- File: `src/app/components/admin/AdminSidebar.tsx`

### UX-023 · OTP recovery guidance and resend timing
**Effort:** S · **Status:** open
- File: `src/app/pages/auth/VerifyOtpPage.tsx`

### UX-024 · Onboarding uses a native `<select>`
**Effort:** XS · **Status:** done
Inconsistent with the richer components used elsewhere in auth.
- File: `src/app/pages/auth/OnboardingPage.tsx`

### UX-025 · Landing page has no proof layer
**Effort:** M · **Status:** open
Strong claims, no product screenshots, social proof, or trust scaffolding.
- File: `src/app/pages/HomePage.tsx`

---

## P3 — Low

### UX-026 · Iconography and surface density inconsistent between modules
**Effort:** S · **Status:** open
Largely absorbed by UX-015 and UX-020; track separately only if residue remains.

---

## Suggested sequencing

**Now (≈1 day):** UX-001 → UX-002 → UX-003 → UX-005 → UX-006 → UX-016 → UX-022
All XS/S, no dependencies, and UX-002/003 close a real correctness hole.

**Next (1–2 weeks):** UX-007 → UX-008 → UX-009 → UX-010 → UX-014 → UX-011 → UX-012

**Then (≈1 month):** UX-015 first, then UX-004 + UX-019 together, then UX-013, UX-020

**Later:** UX-025, UX-021, UX-017, and the guided-workspace direction — scenario
comparison, trend intelligence, reporting flows.

## Dependency notes

- UX-015 (tokens) gates UX-019 and UX-020. Doing either before it means styling twice.
- UX-002 and UX-003 share a mutation helper — one ticket's work, split for reviewability.
- UX-014 (state primitives) makes UX-011 and UX-013 substantially cheaper. Sequence it first.
