# FinRatio

FinRatio is a financial ratio analysis platform for Indian SMEs and credit teams — 12 ratio calculators (D/E, DSCR, ISCR, EBITDA, Current Ratio, Drawing Power, Ageing, Net Working Capital, Working Capital Cycle, PID, Quasi D/E, Business Valuation), a CMA (Credit Monitoring Arrangement) report generator with balance sheet upload/parsing, calculation history, and role-based admin management — all built on React + Vite with a Supabase backend.

## Stack

- **Frontend**: React 19, Vite, TypeScript, React Router, Tailwind + Radix UI + MUI, Recharts
- **Backend**: Supabase (Postgres, Auth, Edge Functions, Storage) — edge function at `supabase/functions/make-server-bd792702`
- **AI/parsing**: `financial-ai-expert/` package (CMA extraction, OpenRouter-backed financial analysis), `pdfjs-dist` / `xlsx` for document parsing
- **Testing**: Vitest

## Features

- Credentials auth (email + password), email OTP verification, JWT session in HTTP-only cookie, CSRF protection, rate-limiting on auth routes, bcrypt hashing, forgot/reset password flow
- Role-based access control (`SUPER_ADMIN`, `ADMIN`, `USER`) with per-user, per-calculator feature gating
- 12 financial ratio calculators with live recalculation and risk badges (Low/Moderate/High)
- Calculation history — every run saved and reloadable
- Balance sheet upload and CMA report generation with document parsing/extraction
- Admin panel: users, calculators, calculations, permissions, settings

## Project Structure

```
src/
  app/
    pages/            top-level routes (Home, Dashboard, auth, admin, calculators)
    components/        shared UI (Navbar, ProtectedRoute, upload, admin, calculators)
  modules/cma/         CMA report generator (components, context, pages)
  lib/                 calculators, parsers, Supabase admin client, AI/OpenRouter wiring
financial-ai-expert/   standalone CMA extraction / financial analysis package
supabase/
  functions/           edge functions (make-server-bd792702, admin-api, server)
  migrations/          SQL schema + RLS migrations
docs/                  implementation notes, validation reports, formula sheet
tools/, scripts/       CMA test fixtures and OCR comparison tooling
```

## Environment Variables

### Frontend (`.env.local`)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

### Supabase Edge Function (`supabase/functions/make-server-bd792702`)

- `JWT_SECRET` — session JWT signing secret
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — transactional email (OTP, password reset, access notifications)
- `APP_BASE_URL`, `APP_ORIGIN` — frontend base URL / CORS origin
- `COOKIE_SECURE` — `true` in production, `false` for local HTTP testing
- `SUPABASE_SERVICE_ROLE_KEY` — required for admin operations (`src/lib/admin.ts`), server-only

## Local Development

```bash
npm install
npm run dev            # start Vite dev server
npm test                # run Vitest
npm run build            # production build
```

### Supabase

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push     # apply pending migrations
npx supabase functions deploy make-server-bd792702 --no-verify-jwt
npx supabase secrets set JWT_SECRET=... RESEND_API_KEY=... APP_BASE_URL=http://localhost:5173 APP_ORIGIN=http://localhost:5173 COOKIE_SECURE=false
```

All application tables have Row Level Security enabled — the app and admin panel access them exclusively through the service role (edge functions and `src/lib/admin.ts`), never the anon/publishable key.

## Deployment

The `main` branch is wired to Vercel via Git integration — pushing to `main` triggers a production deploy. Preview deployments are created automatically for other branches.

## Production Hardening Checklist

- Keep `COOKIE_SECURE=true` and `JWT_SECRET` rotated
- RLS is enabled on all tables; keep all direct table access server-side (service role only)
- Add centralized audit logging for admin actions
- Add SIEM alerts for suspicious signin/OTP/reset patterns
- Code-split the main JS bundle (currently >1.5MB) via dynamic `import()`
