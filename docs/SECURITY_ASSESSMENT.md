# FinRatio Security Assessment

Assessment date: 2026-08-06  
Assessment type: Source-code and configuration review  
Scope: React/Vite client, Supabase Edge Functions, Supabase migrations, `financial-ai-expert` Express service, deployment configuration, and local environment configuration names/metadata.

## Remediation Status (updated 2026-08-06)

Code-level fixes have landed for F-01 through F-14 and F-16. See the table below; deployment-level verification is still outstanding.

| Finding | Status | Notes |
|---|---|---|
| F-01 Browser-exposed OpenRouter key | Fixed (key not rotated) | Authenticated `POST /ai/chat` proxy; key is server-side only. Owner elected to keep the existing key value, which was shipped in prior browser bundles and should be treated as public until rotated. |
| F-02 Default JWT secret | Fixed | Startup fails without a 32+ char `JWT_SECRET`; session record now mandatory and user-matched. |
| F-03 Tokens in URLs | Fixed | Cookie session + CSRF double-submit; query-parameter support removed on both sides. |
| F-04 Unauthenticated Express service | Fixed | Bearer auth, origin allowlist, rate limit, 2 MB bodies, 10 MB uploads, extension allowlist. |
| F-05 Wildcard CORS and request logging | Fixed | Exact-origin allowlist; logger emits method/path/status only. |
| F-06 Reset token logging | Fixed | Logging removed, email HTML escaped, reset base URL must be allowlisted. |
| F-07 Unbounded uploads | Fixed | Decoded-size cap and extension allowlist server-side; stored size is measured, not claimed. |
| F-08 Rate-limit evasion | Fixed | Trusted (last) forwarded IP; counters now use an atomic `consume_rate_limit()` Postgres function. KV remains only as a degraded fallback. |
| F-09 Unguarded admin routes | Fixed | All admin routes wrapped in `ProtectedLayout requiredRole="SUPER_ADMIN"`. |
| F-10 Financial data in localStorage | Fixed | CMA learning examples held in memory for the tab only. |
| F-11 Missing security headers | Fixed | CSP, HSTS, frame-ancestors, nosniff, referrer and permissions policy in `vercel.json`. |
| F-12 Leaked exception messages | Fixed | Opaque public errors; real cause logged server-side. |
| F-13 Duplicate Edge Functions | Fixed | `functions/server/` and `admin-api.ts` deleted. |
| F-14 Test/placeholder endpoints | Fixed | `/test/send-email` and Resend placeholder routes removed. |
| F-15 Service-role/RLS bypass | Partial | Typed tables and cascades are in use; audit trail is append-only with grants revoked, and retention runs via `purge_expired_data()`. Per-row ownership policies still pending. |
| F-16 Untrusted model output | Fixed | Zod schemas on every request body; CMA model output validated before use. |

Also added: security audit events for signin, password reset, role change, suspension and access changes; a CI workflow running dependency audit, SBOM, secret scan and CodeQL; and the lockfile is now tracked so audits are reproducible.

Added since: atomic rate limiting, a typed append-only `audit_events` table with a super-admin read endpoint, nightly retention via `purge_expired_data()`, and privacy endpoints for data export (`GET /me/export`) and account deletion (`DELETE /me`).

Still open beyond the findings above: MFA for administrators, session/device management, and an independent penetration test.

## Executive Summary

FinRatio has a useful security foundation: passwords are normally bcrypt-hashed, reset tokens are stored as hashes, the main API has explicit role checks on most administrative handlers, database tables have RLS enabled, and calculator ownership is enforced server-side for ordinary users.

The application is not production-ready. The highest-risk issues are: a production fallback JWT secret that permits token forgery if the deployment secret is missing; an OpenRouter API key exposed in the browser through `VITE_OPENROUTER_API_KEY`; financial documents and model context sent directly from the browser to a third party; session and CSRF tokens copied into URL query parameters; a separate Express AI service with wildcard CORS, unauthenticated expensive endpoints, 50 MB body limits, and unrestricted file uploads; and reset URLs being logged when email delivery fails. The source also contains a test-email endpoint and an unprotected client route structure for admin pages.

The assessment is evidence-based but cannot certify deployed Supabase, Vercel, DNS, storage, CI/CD, provider, or runtime settings because those artifacts were not available. Live exploitation was not performed. The local `.env` file contains configured provider/admin credentials; values are intentionally not reproduced here, but they should be treated as exposed to anyone with workspace access and rotated if they have ever been committed, copied into a build, or shared.

**Production recommendation: NO-GO until Critical/High findings are remediated and a deployment-level penetration test confirms the controls.**

## Security Scorecard

| Area | Score | Basis |
|---|---:|---|
| Overall | 38/100 | Several good controls, but credential exposure and auth/session risks are release-blocking. |
| Authentication | 42/100 | Bcrypt and reset-token hashing exist; default secret, token handling, session revocation, and rate-limit weaknesses remain. |
| Authorization | 48/100 | Server-side ownership and role checks exist on the main function; admin route/API inconsistencies and claim handling reduce confidence. |
| API | 31/100 | Main function has some validation, but wildcard CORS, URL tokens, no global limits, and a separate unauthenticated AI API are serious gaps. |
| Database | 55/100 | RLS is enabled and foreign keys/indexes exist; service-role access bypasses RLS and KV fallback lacks transactional guarantees. |
| Infrastructure | 25/100 | HTTPS/CDN provider behavior is not evidenced; no security headers or infrastructure policy is present in the repository. |
| Frontend | 30/100 | Browser-exposed AI secret, localStorage sessions, local sensitive learning data, no CSP, and public diagnostic route. |
| Backend | 35/100 | Error handling is inconsistent, input/resource limits are incomplete, and duplicate server implementations create drift risk. |
| DevSecOps | 20/100 | No visible dependency scan/SBOM/IaC hardening workflow; lockfiles are ignored and npm is unavailable for verification here. |
| Privacy | 30/100 | PII and financial data are processed, stored, logged, and sent to providers without evidenced consent, retention, deletion, or DPA controls. |
| AI security | 25/100 | Prompt injection, provider key protection, data minimization, output validation, and abuse controls are not established. |

## Attack Surface Map

```text
Browser / public internet
  |-- Vite SPA: /, auth/*, /test-pdf, protected calculators, /doc-parser, /dashboard/cma-generator
  |-- Vercel rewrite: non-API paths -> index.html
  |-- Supabase Edge Function: /functions/v1/make-server-bd792702
  |     |-- signup, OTP, signin, password reset, logout, me
  |     |-- calculations, uploads, features
  |     |-- admin users/role/access/suspend
  |     |-- test/send-email and placeholder resend API-key routes
  |     `-- KV store + Supabase service-role database client
  |-- OpenRouter API directly from browser with VITE_OPENROUTER_API_KEY
  `-- Optional financial-ai-expert Express service
        |-- health, capabilities, models
        |-- CMA/report/analyze/transform/projection/credit endpoints
        |-- multipart file processing
        `-- local upload directory and model/OpenRouter integrations

Trust boundaries:
  Browser <-> Edge Function; Browser <-> OpenRouter; Browser <-> AI Express;
  Edge Function <-> KV; Edge Function <-> Supabase service role;
  AI Express <-> filesystem; AI services <-> third-party model providers.
```

### Discovered routes and features

Public SPA routes include `/`, `/test-pdf`, `/auth/signup`, `/auth/signin`, `/auth/verify-otp`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/onboarding`, and `/access-denied`. Protected routes include `/dashboard`, `/calculators`, `/dashboard/cma-generator`, `/doc-parser`, and the calculator routes under `/calculators/*`. Admin routes include `/admin` and `/admin/{dashboard,users,calculators,calculations,permissions,settings}`.

The main Edge Function exposes auth, calculations, uploads, feature catalog, admin user management, a test email route, and placeholder Resend API-key routes. The Express service exposes 14 API routes, including unauthenticated file processing and model-selection operations. No webhook, queue, cron, OAuth, payment, or passkey implementation was found. Deployment and provider settings remain unverified.

## Findings

### F-01: Browser-exposed OpenRouter credential and direct financial-data disclosure

- Category: Secrets management, privacy, API security, AI security
- Severity: **Critical**
- CVSS estimate: 9.1 (AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H)
- Affected components: `src/lib/ai.ts`, `src/lib/ai/openrouter.ts`, Vite build, `.env`
- Evidence: `src/lib/ai.ts:2-9`, `src/lib/ai/openrouter.ts:1`, `:155`, `:214`, `:405`.
- Description: Any `VITE_*` value is bundled into JavaScript. The client sends prompts, uploaded-document excerpts, CMA data, and credit-opinion context directly to OpenRouter with that key. A visitor can extract and abuse the key, incur provider charges, or use it to access the account’s model quota. Financial data is disclosed to a third party outside a server-side policy boundary.
- Attack scenario: Download the production bundle, read the OpenRouter key, then send arbitrary high-volume requests or inspect/modify prompts and document data.
- Impact: Provider account compromise/cost, data disclosure, prompt tampering, and possible regulatory breach.
- Root cause: A server secret is prefixed with `VITE_` and the browser is used as the AI trust boundary.
- Recommendation: Revoke/rotate the key immediately; remove all provider secrets from client builds; route model calls through an authenticated server endpoint; enforce tenant/user quotas, payload limits, provider allowlists, redaction, retention rules, and structured output validation. Add an approved DPA/provider review for financial data.
- References: OWASP API1/API4, OWASP A02, CWE-798, CWE-200.
- Complexity: Medium to high.

### F-02: Default JWT secret enables session forgery when configuration is missing

- Category: Authentication, cryptographic key management
- Severity: **Critical**
- CVSS estimate: 9.8 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
- Evidence: `supabase/functions/make-server-bd792702/index.ts:79` uses `Deno.env.get("JWT_SECRET") ?? "change-me-in-production"`; token verification occurs at `:512`.
- Description: Missing configuration does not fail closed. An attacker who knows the fallback can create HS256 claims with an arbitrary subject, session id, role, and future expiry. `requireAuth` also accepts a valid JWT when the KV session record is absent (`:519-524`), so the missing-session case is not rejected.
- Attack scenario: If the deployed function lacks `JWT_SECRET`, forge a token for a privileged user or a chosen account and call protected/admin handlers.
- Impact: Full account impersonation and administrative control.
- Root cause: Insecure default and non-mandatory server-side session record.
- Recommendation: Throw during startup unless a high-entropy secret is present; rotate keys through a secret manager; require a session record, user match, role match, expiry, and revocation status; use key IDs and planned rotation. Never trust role claims over the current user record.
- References: OWASP ASVS V3, OWASP A07, CWE-798, CWE-347.
- Complexity: Low to medium.

### F-03: Session and CSRF tokens are placed in URL query strings

- Category: Session management, credential leakage
- Severity: **High**
- CVSS estimate: 8.1 (AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N)
- Evidence: `src/lib/auth.ts:68-71`; the same pattern exists in `src/lib/uploadStorage.ts:28-31`; server parsing is `index.ts:475-477` and `:547`.
- Description: The browser app appends `sessionToken` and `csrfToken` to URLs. URLs can enter reverse-proxy logs, analytics, browser history, screenshots, copied links, error reports, and referrer chains. The CSRF token is also readable from localStorage.
- Attack scenario: Obtain a URL from a log, browser history sync, analytics event, or referrer and replay the session token against the API.
- Impact: Account takeover and access to saved financial records.
- Recommendation: Use Secure, HttpOnly, SameSite cookies for the session and keep CSRF tokens only in a cookie/header double-submit flow. Remove query-token support after migration. Set `Referrer-Policy: no-referrer`, scrub auth parameters at the edge, and invalidate all existing tokens.
- References: OWASP Session Management, CWE-598.
- Complexity: Medium.

### F-04: Express AI service is unauthenticated, wildcard-CORS, and resource-exhaustible

- Category: API security, denial of service, file security
- Severity: **High**
- CVSS estimate: 8.6 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
- Evidence: `financial-ai-expert/server/api.js:15`, `:19-20`, and public `app.post` handlers at `:47`, `:66`, `:85`, `:104`, `:150`, `:169`, `:198`, `:212`, `:245`, `:264`, `:281`, `:309`.
- Description: `cors()` allows every origin, request bodies are accepted up to 50 MB, uploads use default `multer({ dest: 'uploads/' })`, and no authentication or rate limiting is visible. `/api/set-model` changes shared model state. Expensive AI and document-processing operations are available to anonymous callers.
- Attack scenario: Flood `/api/process-file`, `/api/create-projections`, or `/api/cma/credit-opinion`; upload large/polyglot files; or change the active model for all users.
- Impact: DoS, disk exhaustion, provider cost, data exposure, model tampering, and possible malware handling.
- Recommendation: Put the service behind authenticated gateway access; restrict CORS to exact origins; add per-user/IP quotas and concurrency limits; set route-specific body/file limits and timeouts; validate magic bytes and parse in a sandbox; store uploads outside the web root with random names; delete in `finally`; make model selection admin-only and non-global.
- References: OWASP API4/API10, CWE-400, CWE-434.
- Complexity: High.

### F-05: Main Edge Function uses wildcard CORS and logs request data through logger middleware

- Category: API security, privacy
- Severity: **High**
- CVSS estimate: 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)
- Evidence: `index.ts:114-122` installs `logger(console.log)` and sets `Access-Control-Allow-Origin: *`; the declared `ALLOWED_ORIGINS` at `:89-94` is not used by this middleware.
- Description: The API advertises every origin and logs all requests through the Hono logger. This increases cross-origin attack surface and creates a risk that paths, query tokens, identifiers, or sensitive metadata reach centralized logs.
- Recommendation: Use an exact-origin allowlist and never log authorization/query values. Add structured security logging with field redaction and retention limits. Reject unexpected Origin values for browser requests.
- References: OWASP API8, CWE-532, CWE-942.
- Complexity: Low.

### F-06: Password-reset token can be written to logs and reset email HTML is not escaped

- Category: Authentication, information disclosure, injection
- Severity: **High**
- CVSS estimate: 7.4 (AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N)
- Evidence: `index.ts:919-928` logs the reset URL when email delivery fails; reset URL includes the raw token. `sendPasswordResetEmail` interpolates values into HTML at approximately `:645-653`.
- Description: A reset bearer token is deliberately logged for debugging. Email delivery failure therefore converts operational logs into a password-reset credential store. HTML interpolation should also be escaped even though the current values are mostly server-generated.
- Recommendation: Never log reset URLs or tokens. Fail closed for production email delivery; use a support-safe opaque event ID. Escape HTML, add single-use atomic consumption, invalidate all sessions after reset, and verify the configured public base URL is HTTPS and allowlisted.
- References: OWASP Forgot Password Cheat Sheet, CWE-532, CWE-79.
- Complexity: Low.

### F-07: Upload endpoint stores arbitrary base64 payloads without enforced size/type/content controls

- Category: File security, resource exhaustion, privacy
- Severity: **High**
- CVSS estimate: 7.5 (AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:H)
- Evidence: client accepts `.pdf,.docx,.csv,.xlsx,.xls,.txt` in `DataInputEngine.tsx:194`; client sends full base64 in `uploadStorage.ts:80-94`; server stores `fileBase64` at `index.ts:1065-1090` without a server-side maximum, magic-byte check, malware scan, or retention/deletion route.
- Description: Client file type and reported size are untrusted. Base64 increases memory/storage overhead. Files are persisted in the database/KV fallback, potentially indefinitely, with no download authorization or deletion lifecycle found.
- Recommendation: Enforce byte limits before decoding and after decoding; allowlist magic bytes and parsers; reject active content/SVG unless sanitized; scan files; use private object storage with per-user paths and short-lived signed URLs; encrypt, audit, and delete on retention expiry; never accept client-provided size as the control.
- References: OWASP File Upload Cheat Sheet, CWE-434, CWE-400.
- Complexity: High.

### F-08: Authentication rate limiting is race-prone and trusts the first forwarded IP

- Category: Brute force/abuse prevention
- Severity: **Medium**
- CVSS estimate: 6.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:L)
- Evidence: `index.ts:452-471` performs KV get/update without an atomic increment; `:451` keys by the first `x-forwarded-for` value; signin uses `:865-874`.
- Description: Concurrent requests can overwrite each other’s counters. Unless a trusted proxy rewrites the header, clients can choose `x-forwarded-for` and evade the limit. Limits are also endpoint-specific and no distributed abuse control is shown for the Express service or uploads.
- Recommendation: Use a trusted proxy identity, atomic/transactional counters, combined IP/account/device keys, progressive delays, breached-password checks, and a distributed rate-limit service. Add limits to OTP, reset, uploads, AI, and admin operations.
- References: OWASP A07, OWASP API4, CWE-307.
- Complexity: Medium.

### F-09: Admin SPA routes are not wrapped in the server-backed ProtectedRoute

- Category: Authorization, client routing
- Severity: **Medium**
- CVSS estimate: 5.4 (AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N)
- Evidence: `src/app/routes.tsx:232-252` mounts admin pages directly; only `/admin` uses `ProtectedLayout` at `:224-230`. `AdminLayout.tsx:6-11` checks cached localStorage user state with `canAccessAdmin`.
- Description: This is not sufficient protection by itself because the browser can modify localStorage and render any admin UI. API authorization should be authoritative, but the route inconsistency creates false security, accidental data fetches, and a path for future client-only admin actions to become exploitable.
- Recommendation: Wrap every admin route in `ProtectedLayout requiredRole="SUPER_ADMIN"` (or a dedicated admin loader that calls `/auth/me`); remove authorization decisions based solely on localStorage; keep every mutation protected server-side.
- References: OWASP A01, CWE-602.
- Complexity: Low.

### F-10: AI prompt context and learning examples persist sensitive document data in localStorage

- Category: Privacy, data leakage, AI security
- Severity: **Medium**
- CVSS estimate: 6.1 (AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N)
- Evidence: `src/lib/ai/openrouter.ts:62-72` reads/writes `finratio:cma-learning-examples`; `recordCmaLearningExample` stores raw previews and parsed data at approximately `:112-139`.
- Description: Up to 20 examples, including raw document previews and parsed financial fields, remain in browser storage. Any XSS, malicious extension, shared workstation, browser profile compromise, or accidental export can disclose them. The data is reused as model context without provenance or tenant isolation.
- Recommendation: Do not store financial documents or parsed data in localStorage. If learning is required, use explicit opt-in server-side storage with tenant isolation, encryption, retention/deletion, provenance, prompt-injection filtering, and access audit.
- References: OWASP A02, CWE-922, OWASP LLM01/LLM06.
- Complexity: Medium.

### F-11: No security headers or CSP are defined in the deployment configuration

- Category: Browser security, defense in depth
- Severity: **Medium**
- CVSS estimate: 5.4 (AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N)
- Evidence: `vercel.json` contains only an SPA rewrite; `index.html` contains no CSP or security meta policy.
- Description: There is no repository evidence for CSP, HSTS, frame protection, MIME sniffing protection, referrer policy, or permissions policy. This materially increases the impact of XSS, clickjacking, malicious framing, and data leakage.
- Recommendation: Set headers at the edge: strict CSP with nonces/hashes, HSTS after HTTPS validation, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, and appropriate cache controls for authenticated responses.
- References: OWASP Secure Headers Project, OWASP A05.
- Complexity: Low to medium.

### F-12: Express error responses disclose internal exception messages

- Category: Error handling, information disclosure
- Severity: **Medium**
- CVSS estimate: 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:L)
- Evidence: `financial-ai-expert/server/api.js` returns `error.message` in multiple catch blocks, including around `:47-63`, `:66-82`, `:104-145`, and `:309+`.
- Description: Provider errors, parser paths, model internals, and operational details may be returned to anonymous callers. This aids reconnaissance and can disclose user/document metadata.
- Recommendation: Return stable public error IDs/messages; log detailed errors server-side with redaction; disable stack traces and provider-body echoing in production.
- References: OWASP A05, CWE-209.
- Complexity: Low.

### F-13: Duplicate Edge Function implementations create security-control drift

- Category: Architecture, maintainability
- Severity: **Medium**
- CVSS estimate: 5.0 (AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:L)
- Evidence: both `supabase/functions/make-server-bd792702/index.ts` and `supabase/functions/server/index.tsx`/`index.ts` implement overlapping auth/calculation routes, with different behaviors and placeholder APIs.
- Description: Multiple implementations make it unclear which code is deployed and allow a fix applied to one copy to be absent from another. Inconsistent session, admin, and endpoint behavior is a predictable source of regression.
- Recommendation: Keep one deployable function per public API, delete/archive dead copies outside the deployment tree, add route-contract tests, and make CI verify the exact deployment artifact.
- References: OWASP ASVS V1, CWE-1059.
- Complexity: Medium.

### F-14: Placeholder/test operational endpoints are present in the production function

- Category: Attack surface, business logic
- Severity: **Medium**
- CVSS estimate: 5.8 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L)
- Evidence: `index.ts:1310-1312` exposes no-op Resend API-key routes; `:1315-1365` exposes `/test/send-email` and returns sender/recipient details.
- Description: The test endpoint sends arbitrary email to any syntactically valid recipient without authentication, rate limiting, or an environment gate. Even if provider quotas limit abuse, it is a spam/cost and reputation risk.
- Recommendation: Remove test and placeholder routes from production builds, or protect them with admin authorization, environment gating, strict allowlists, audit logs, and rate limits.
- References: OWASP API9/API4, CWE-862.
- Complexity: Low.

### F-15: Database/service-role and KV fallback bypass the database security model

- Category: Database authorization, integrity
- Severity: **Medium**
- CVSS estimate: 6.5 (AV:N/AC:L/PR:L/S:U/C:H/I:L/A:L)
- Evidence: RLS is enabled in `supabase/migrations/20260701120000_enable_rls.sql`, while the Edge Function uses a service-role client and falls back to KV for uploads/calculations/user records. No row-level policies, transactional write strategy, audit tables, or deletion/retention policy are defined in the reviewed migrations.
- Description: All protection depends on application code. A route regression or service-role misuse bypasses RLS. KV lists and read-modify-write operations are vulnerable to lost updates and cross-instance consistency problems.
- Recommendation: Use database-native typed tables and policies where possible; isolate service-role use in a narrow data-access layer; add ownership policies, transaction constraints, audit events, concurrency-safe updates, backups, restore tests, and retention/deletion jobs.
- References: OWASP A01/A04, CWE-862, CWE-915.
- Complexity: High.

### F-16: Model outputs and client-supplied financial inputs are not treated as untrusted

- Category: AI security, business logic integrity
- Severity: **Medium**
- CVSS estimate: 6.0 (AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N)
- Evidence: `src/lib/ai/openrouter.ts` asks the model to compute missing accounting fields and produce credit recommendations; `financial-ai-expert/server/api.js` accepts model/extraction objects and returns generated results without a visible schema validation layer at the API boundary.
- Description: Uploaded text can contain indirect prompt injection. Model output can be inaccurate or manipulated and is presented in a financial decision workflow. Deterministic computations and model-generated opinions are not clearly separated in the client trust model.
- Recommendation: Treat documents as data, delimit and sanitize them, use constrained JSON schemas, validate numeric ranges and reconciliation rules server-side, display provenance/confidence, require human review for credit decisions, and never let model output authorize access or transactions.
- References: OWASP LLM01, LLM02, LLM06, CWE-20.
- Complexity: High.

## Threat Model Summary

### Assets

Credentials, sessions, reset tokens, user PII, phone/email data, business constitution, uploaded financial statements, saved calculations, AI prompts/outputs, provider API keys, administrator capabilities, email reputation, and model/provider quota.

### Threat actors and privilege levels

Anonymous internet attacker; authenticated ordinary user; malicious tenant user; compromised browser/extension; malicious insider with admin access; compromised provider or dependency; and an attacker able to read logs or build artifacts. Privilege boundaries are anonymous -> user -> admin -> super-admin -> service-role/provider.

### Primary trust boundaries and STRIDE threats

| Boundary | Main threats | Risk |
|---|---|---|
| Browser to SPA/API | Token theft, XSS, CSRF, tampered client state, excessive data exposure | High |
| Browser to OpenRouter | Secret theft, prompt injection, data disclosure, quota abuse | Critical |
| Edge Function to KV/database | Service-role bypass, IDOR, race conditions, integrity loss | High |
| Edge Function to Resend | Email abuse, reset-token leakage, sender reputation loss | High |
| Browser/Internet to Express AI | Anonymous abuse, upload malware, DoS, model state tampering | High |
| CI/build to production | Secret embedding, dependency/supply-chain compromise, artifact drift | High |

STRIDE mapping: spoofing is dominated by F-02/F-03; tampering by F-16 and F-15; repudiation by missing security audit evidence; information disclosure by F-01/F-03/F-05/F-10/F-12; denial of service by F-04/F-07/F-08; and elevation of privilege by F-02/F-09/F-15.

## OWASP and Compliance Assessment

OWASP Top 10 status: A01 Broken Access Control = high concern; A02 Cryptographic Failures = critical concern; A03 Injection = incomplete evidence; A04 Insecure Design = high concern; A05 Security Misconfiguration = high concern; A06 Vulnerable Components = unverified; A07 Identification/Auth Failures = high concern; A08 Software/Data Integrity = unverified; A09 Logging/Monitoring = high concern; A10 SSRF = not evidenced, but provider-fetch review remains required.

OWASP API Top 10: API1/API3/API4/API5/API8/API9/API10 are high or unverified due to service-role routing, missing limits, wildcard CORS, exposed error details, and unauthenticated AI endpoints.

Privacy readiness: GDPR/CCPA readiness is not demonstrated. Missing evidence includes lawful-basis/consent notices, processor/DPA inventory, international transfer assessment, retention schedule, deletion propagation across KV/database/provider/logs/backups, subject export, cookie/analytics controls, breach process, and documented data classification. SOC 2/ISO 27001 readiness is also not demonstrated without control owners, risk register, access reviews, secrets rotation, change management, backups/restore tests, incident exercises, and evidence retention.

## Recommended Secure Configuration

- Fail deployment if `JWT_SECRET`, Supabase service credentials, provider credentials, email sender, and public origin are absent or weak.
- Use exact production origins; remove wildcard CORS and local origins from production.
- Use HttpOnly Secure SameSite cookies; never put bearer material in URLs.
- Add CSP, HSTS, frame restrictions, MIME sniffing protection, referrer policy, permissions policy, and authenticated-response cache controls.
- Put AI behind the server; enforce per-user quotas, provider spend limits, timeouts, retries with caps, and payload budgets.
- Use private object storage, random object keys, signed URLs, malware scanning, magic-byte validation, and lifecycle deletion.
- Set route-specific JSON/multipart limits and request timeouts; cap concurrency and pagination.
- Remove diagnostic/test endpoints from production.
- Pin and scan dependencies; generate an SBOM and use lockfiles in CI rather than ignoring them.

## Remediation Roadmap

### Quick wins: within 1 day

- Rotate the OpenRouter, Resend, and admin credentials found configured locally; audit provider and deployment logs for exposure.
- Remove the JWT fallback and make startup fail closed.
- Remove reset URL logging and disable `/test/send-email` in production.
- Restrict CORS and add baseline security headers.
- Remove query-string session/CSRF token support after migrating the client to cookies.
- Add hard request/upload limits and reject oversized base64 payloads.
- Wrap all admin routes with the server-backed role guard.

### Short term: within 2 weeks

- Consolidate duplicate Edge Function implementations.
- Move OpenRouter calls to a server endpoint with authentication, quotas, redaction, and provider policy.
- Harden or retire the Express AI service; add auth, CORS allowlisting, rate limits, timeouts, upload validation, and safe errors.
- Add atomic distributed rate limiting and security audit events.
- Add schema validation for every API body and structured AI response.
- Define data retention/deletion behavior for uploads, calculations, KV, logs, and provider data.

### Medium term: within 2 months

- Migrate authoritative identity, sessions, access grants, uploads, and calculations to typed database tables with ownership RLS/policies and transactions.
- Add SAST, dependency scanning, secret scanning, SBOM generation, IaC scanning, signed builds, and deployment gates.
- Add authenticated integration tests for IDOR, role changes, suspension, reset replay, CSRF, rate limits, upload boundaries, and AI abuse.
- Complete a privacy impact assessment and vendor/DPA review.

### Long term

- Adopt centralized identity/session management with MFA for administrators, short-lived rotating sessions, device/session management, and risk-based login alerts.
- Introduce a formal threat-model review for every feature, continuous monitoring/SIEM, incident exercises, backup restore tests, and an annual independent penetration test.

## Secure Coding Checklist

- [ ] No secrets under `VITE_*`; no provider credentials in browser code.
- [ ] Startup fails closed for missing secrets and insecure origins.
- [ ] HttpOnly session cookies; no tokens in URLs or localStorage.
- [ ] Every protected API verifies current user, session record, status, role, ownership, and feature access.
- [ ] Atomic rate limits for auth, uploads, AI, email, and admin operations.
- [ ] Zod or equivalent schemas for all request bodies and AI responses.
- [ ] Server-side byte, type, magic-byte, decompression, and parser limits.
- [ ] Safe public errors and redacted structured logs.
- [ ] Security audit events for auth, role changes, exports, uploads, deletes, and provider calls.
- [ ] Deterministic financial calculations are separate from model-generated recommendations.

## Penetration Testing Checklist

- [ ] Forge JWT with missing/rotated secret and test revoked-session behavior.
- [ ] Replay session/reset/CSRF tokens from URLs, logs, referrers, and browser history.
- [ ] Test IDOR across `/calculations/:userId`, uploads, admin users, and calculator access.
- [ ] Test role changes, suspension, self-escalation, and concurrent admin mutations.
- [ ] Fuzz JSON, multipart, filenames, MIME types, compressed files, SVG/polyglots, and oversized payloads.
- [ ] Abuse all Express AI endpoints anonymously and measure cost/disk/CPU exhaustion.
- [ ] Test prompt injection, output schema violations, data exfiltration, and cross-user learning context.
- [ ] Verify headers, CSP, clickjacking, cache behavior, source maps, and production bundles.

## Deployment and Incident Readiness

- [ ] Production secrets exist only in managed secret storage and are rotated.
- [ ] Deployment artifact is the single reviewed Edge Function implementation.
- [ ] Vercel/Supabase/AI service logs redact tokens, PII, file contents, and provider bodies.
- [ ] Alerts exist for failed logins, reset spikes, admin changes, abnormal AI spend, upload abuse, and 5xx spikes.
- [ ] Incident playbook can revoke sessions, rotate provider/JWT keys, suspend accounts, delete provider data, and preserve evidence.
- [ ] Backups and deletion propagation are tested, not merely configured.
- [ ] Security contact, breach notification workflow, vendor contacts, and recovery owners are documented.

## Missing Artifacts and Confidence Limits

The following were not available and must be supplied before a full production certification: deployed Supabase function/config and policies; Supabase project settings, storage buckets, logs, backups, and Edge Function secrets; Vercel project settings, headers, environment variables, source-map exposure, DNS/TLS/CDN/WAF settings; CI/CD workflows and repository history; complete dependency vulnerability scan; database/KV runtime configuration; Express service deployment, network exposure, container/IAM settings, and logs; provider retention/DPA terms; and a live authenticated test account plus API contract.

Repository tests/build were not executed because `npm`/`npm.cmd` and `git` are not available on the assessment shell PATH. No live exploitation or destructive testing was performed. Findings marked “unverified” require runtime evidence rather than assumptions.

## Final Go/No-Go

**NO-GO for public production deployment.** F-01 and F-02 alone are release blockers; F-03 through F-07 add credible account-takeover, data-disclosure, abuse, and availability paths. Reassess after the critical/high remediation set is deployed, secrets are rotated, the duplicate services are consolidated, and an independent authenticated penetration test confirms session, authorization, upload, AI, and deployment controls.
