# FinRatio

FinRatio is a financial ratio analysis platform for Indian SMEs and credit teams — 12 ratio calculators (D/E, DSCR, ISCR, EBITDA, Current Ratio, Drawing Power, Ageing, Net Working Capital, Working Capital Cycle, PID, Quasi D/E, Business Valuation), a balance sheet upload that produces a graded assessment report, a CMA (Credit Monitoring Arrangement) report generator with AI extraction, calculation history, and role-based admin management — React + Vite on the front end with a Supabase backend.

## Stack

- **Frontend**: React 19, Vite, TypeScript, React Router, Tailwind + Radix UI + MUI, Recharts
- **Backend**: Supabase (Postgres, Edge Functions) — one edge function at `supabase/functions/make-server-bd792702`. Sign-in is Firebase Authentication (or a WhatsApp one-time code); the function verifies the token and is the only thing that touches user data.
- **AI**: model calls go through the edge function (`/ai/chat`), which holds the provider keys and fails over between providers. Nothing secret is shipped to the browser.
- **Document parsing**: runs in the browser — `pdfjs-dist`, `xlsx`, `mammoth`, `tesseract.js` (images)
- **Testing**: Vitest

## Features

- Sign-in with Firebase Authentication or a WhatsApp OTP; **invite-only** access (a new account needs an invite code)
- Role-based access (`SUPER_ADMIN`, `ADMIN`, `USER`) with per-user, per-calculator feature gating
- 12 financial ratio calculators with live recalculation and risk badges (Low/Moderate/High)
- Calculation history — every run saved and reloadable
- **Balance sheet upload → assessment report**: reads statements in many layouts, grades the business A–D with the reasons, highlights key financials, compares against listed peers, exports to PDF
- **CMA generator**: AI extraction of CMA data with a glossary of Indian statement terms, a cross-check against the figures printed in the document, and prompt-injection safeguards
- Admin panel: users, invites, calculators, calculations, uploads, permissions, audit log

## Project Structure

```text
src/
  app/
    pages/            top-level routes (Home, Dashboard, auth, admin, calculators, dev/ sample report)
    components/       shared UI (Navbar, ProtectedRoute, upload, report, admin, calculators)
  modules/cma/        CMA report generator (components, context, pages)
  lib/
    statementParsing.ts   reading statements: headings, synonyms, layouts, P&L, totals, units, repayments
    parsers.ts            file types -> parsed statement (PDF, Word, Excel, CSV, JSON, text, image)
    parsedToCalculatorMapper.ts   parsed statement -> calculator inputs
    financialRating.ts    the A-D grade and key figures
    finance/peerBenchmarks.ts     placement against listed peers (data: src/data/peerBenchmarks.json)
    sanitizeParsed.ts     rebuilds an uploaded JSON statement from scratch (it is user input)
    ai/                   model prompts, prompt-injection defences, source cross-check
financial-ai-expert/   standalone CMA extraction / financial analysis package
supabase/
  functions/           edge function (make-server-bd792702) + its tests
  migrations/          SQL schema + RLS migrations
docs/                  implementation notes, validation reports, formula sheet
scripts/, tools/       benchmark builder, CMA test fixtures, OCR comparison tooling
```

## Balance sheet upload and the assessment report

The page is `/doc-parser` (behind sign-in). Everything from reading the file to grading it happens in the browser; only the signed-in upload of the original file touches the server.

**Reading statements.** Firms word and lay out the same lines differently, so parsing is based on section headings, a vocabulary of synonyms and the layout, not on fixed templates:

- Headings ("Current Assets", "Non-current liabilities", "Shareholders' funds", "Secured / Unsecured Loans") decide which section a line belongs to; generic headings only place lines the wording cannot.
- Handled layouts: Schedule III (vertical, Notes column, two years); the older two-sided format (liabilities left, assets right) in PDF, Excel/CSV and Word tables; two pages printed on one sheet; a second amount column holding subtotals; `Add:` / `Less:` rows; `To,` / `By,` trading-account rows; proprietorship and partnership statements.
- A long report is cut down to the statements (auditor's letter, notes and cash flow are skipped), the unit ("Rs. in lakhs", "₹ crore") is carried to the report, and a file that has both consolidated and standalone statements offers a switch.
- Profit-and-loss lines are kept out of the balance sheet and feed EBITDA, ISCR and DSCR. DSCR uses interest plus the principal repaid in the cash flow statement; without one it is interest only and the report says so.
- Lines that cannot be placed are reported, never guessed, and the confidence score is built from checks (totals agree, line items add up) instead of a constant.

**The report.** Grade A–D with a 0–100 score, key financials, each ratio with its risk, "How you compare with peers", "Our view" (what supports the grade and what holds it back) and a table showing how the grade was built. One high-risk measure caps the grade at B and two at C; a file read with low confidence is marked provisional. The method and weights are in `docs/FORMULA_SHEET.md`.

**Peer comparison.** Debt/Equity, Current Ratio, Interest Cover and Operating Margin are placed against ~4,000 listed Indian companies (48 industries, financial companies excluded from the all-company group). Peers are mostly mid-size and large, so a small firm usually ranks below the median — the report says so. To rebuild the data:

```bash
python -m kaggle datasets download pacificrm/financial-sheets -p scratch/kaggle/financial-sheets --unzip
node scripts/build-peer-benchmarks.mjs
```

Source: Kaggle `pacificrm/financial-sheets` (CC0) — see `docs/ATTRIBUTIONS.md`.

**Previewing and exporting.** In dev, `/dev/report-sample` renders the report with made-up figures (not part of the production build). *Download PDF* uses the browser's print dialog ("Save as PDF"); the print layout forces a white page with the light palette and the FinRatio logo, whatever theme the screen is in.

## CMA generator: AI extraction

`src/lib/ai/cmaPrompt.ts` gives the model a glossary for every schema field (Sundry Debtors = trade receivables, Bank OD / CC / WCDL = bank borrowings, Capital Account = share capital, …), the layouts to expect, and the rules (convert every unit to Rs. Lakhs, use the printed years, `Add:`/`Less:` signs, subtotal columns are not extra lines). After extraction, `src/lib/ai/sourceCheck.ts` compares the model's total assets and revenue with the figures the document itself prints (allowing for the unit); a disagreement appears in the review items.

## Security model

- **Access.** Every API route verifies a Firebase ID token (or the signed WhatsApp-OTP token) and loads the caller's profile from the database on every request; the role and suspension status come from that row, never from the browser. The user object kept in `localStorage` only decides which screens are drawn — editing it exposes screens, not data. A profile can only be created through the invite check or by an admin, and `supabase/functions/make-server-bd792702/routes.security.test.ts` fails if a route is added without a login/admin check.
- **Database.** All tables have RLS on and the browser never uses PostgREST for user data; migration `20261022120000_close_direct_client_writes.sql` removes the per-user policies and grants that would otherwise let a token holder insert a profile (skipping the invite) or write rows without the function's limits.
- **Rate limits** (per account unless noted): AI 60/hour and 300/day, plus 200/hour per address; uploads 40/hour; saved calculations 600/hour; feedback 20/hour; events 120/hour; WhatsApp OTP 3 per number per 10 minutes and 15/hour per address. Request bodies are size-capped (AI 256 KB, uploads 10 MB, saved calculation inputs/results 200 KB). The limiter fails open if the database call fails.
- **Prompt injection.** Documents are untrusted. `src/lib/ai/promptSafety.ts` fences document text with a per-request marker and tells the model it is data only; reduces model-supplied labels (years, unit, company) that later prompts carry to safe values; flags instruction-like text for the reviewer; and model output is only shown as text (markdown links and images are removed) or used as validated numbers and enum values.
- **Files.** Uploaded files are never opened on the server (stored as text, admin download only, as an attachment). Reading happens in the uploader's browser, capped at 10 MB and 300 PDF pages. Uploaded JSON statements are rebuilt from scratch by `sanitizeParsed.ts`.
- **Still to do outside the code:** set a spend cap and alerts at the AI provider/gateway, consider server-owned prompts so `/ai/chat` is not a general chatbot, add a per-user storage quota, and open uploaded files only in a sandbox on admin machines.

## Environment Variables

### Frontend (`.env.local`)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_GA_ID`, `VITE_CLARITY_ID` — optional analytics

### Supabase Edge Function (`supabase/functions/make-server-bd792702`)

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — server-only; the function is the only user of the service role
- `JWT_SECRET` — signs the WhatsApp-OTP session token
- `APP_ORIGIN` — allowed CORS origin; `ALLOW_DEV_ORIGINS=true` additionally allows `http://localhost:*`
- `AI_GATEWAY_API_KEY`, `AI_GATEWAY_MODEL`, `AI_GATEWAY_FALLBACK_MODELS` — primary AI route
- `NVIDIA_API_KEY`, `NVIDIA_FALLBACK_MODEL`; `OPENROUTER_API_KEY`, `OPENROUTER_MODEL_NAME` — failover providers
- `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` — invite emails
- `WHATSAPP_API_URL`, `WHATSAPP_API_KEY` — OTP delivery
- `FIREBASE_API_KEY` — optional override of the (public) Firebase web key

## Local Development

```bash
npm install
npm run dev            # start Vite dev server
npm test                # run Vitest
npm run build            # production build
```

### Tests

`npm test` runs ~550 tests, including: statement templates (Schedule III, two-sided, proprietorship, Excel/Word side-by-side, spreads); the rating and peer comparison; the report rendered as a document; **abuse tests** (empty, corrupt and mislabelled files, hostile JSON, absurd numbers, adversarial text that must not hang the parser, double clicks, rapid repeated drops, late-finishing parses); prompt-injection tests (a hostile document through the real extraction path with only the network faked); and the server route audit. Tests that need your own files (the real-PDF runs used during development) are not part of the suite.

### Supabase

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push     # apply pending migrations
npx supabase functions deploy make-server-bd792702 --no-verify-jwt
npx supabase secrets set JWT_SECRET=... APP_ORIGIN=http://localhost:5173 ALLOW_DEV_ORIGINS=true
```

## Deployment

The `main` branch is wired to Vercel via Git integration — pushing to `main` triggers a production deploy of the **frontend**. The database migrations and the edge function are **not** deployed by that: run `supabase db push` and `supabase functions deploy make-server-bd792702 --no-verify-jwt` separately. The rate limits, size caps and the direct-write lockdown above take effect only after those two steps.

## Production Hardening Checklist

- Keep `JWT_SECRET` rotated and the service role key server-side only
- RLS is enabled on all tables; keep all direct table access server-side (service role only)
- Set a spend cap and alerts on the AI provider; review the AI rate limits against real usage
- Add SIEM alerts for suspicious signin/OTP patterns (admin actions are already audit-logged)
- Run a staged load test of the AI path before opening to many concurrent users
- Code-split the main JS bundle (currently >1.5MB) via dynamic `import()`
