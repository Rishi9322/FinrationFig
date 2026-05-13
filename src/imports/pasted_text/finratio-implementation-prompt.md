# FinRatio — Complete Implementation Prompt
### Production-Grade Fintech Web Application
**Version 1.0 | For: AI Coding Assistants & Senior Developers**

---

## CONTEXT & MISSION

You are building **FinRatio** — a production-grade, web-based financial intelligence platform for Indian SME credit assessment. This is not a prototype. This is not a demo. Every line of code must be immediately runnable, production-safe, and correct.

Your output must be a complete, working Next.js 14 application with authentication, 9 financial calculators, AI-powered analysis, a dashboard, and persistent calculation history. Nothing can be stubbed, nothing can say "// TODO", and no logic can be left as a placeholder.

**Read every section before writing a single line of code.**

---

## TECHNOLOGY STACK

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.x |
| Language | TypeScript | Strict mode |
| Database ORM | Prisma | Latest |
| Database | PostgreSQL | 15+ |
| Styling | Tailwind CSS + shadcn/ui | Latest |
| Auth | Custom JWT + bcrypt (NO OAuth) | — |
| Email | Resend (Nodemailer fallback) | — |
| AI | Anthropic Claude API | claude-sonnet-4-20250514 |
| Validation | Zod | Latest |
| Password Hashing | bcryptjs | saltRounds = 12 |

**Install these packages before writing any code:**
```bash
npm install bcryptjs jsonwebtoken zod resend
npm install -D @types/bcryptjs @types/jsonwebtoken
```

---

## ABSOLUTE RULES — READ FIRST

These rules apply to every file you produce. Breaking any of them means the output is incorrect.

1. **No inline formula logic** — Every financial calculation lives exclusively in `/lib/financialCalculations.ts`. Calculator pages only call exported functions.
2. **No plain-text passwords** — Passwords are always bcrypt hashed before touching the database. Never log, return, or expose a password.
3. **No OAuth** — Auth is credentials-only: email + password + OTP. Do not add any OAuth providers.
4. **No placeholder comments** — Every function body, every route handler, every component must be fully implemented.
5. **No raw error exposure** — API routes catch all errors and return generic messages. Never send stack traces or internal messages to the client.
6. **Single source of truth** — `/lib/calculatorConfig.ts` is the one place that defines the list of calculators. The Navbar dropdown, index page, and dashboard all read from it. Never hardcode a list of calculators anywhere else.
7. **Indian number formatting** — All currency values use the Indian lakh/crore system (₹1,00,000 not ₹100,000). A `formatCurrency` helper in the lib file handles this everywhere.
8. **TypeScript strict** — No `any` types. No `@ts-ignore`. Every function is fully typed.
9. **Immediate runability** — A developer should be able to clone, `npm install`, set `.env.local`, run `prisma migrate dev`, and `npm run dev` — and everything works.
10. **Real-time calculation** — Calculators recalculate on every valid input change. No separate "Calculate" button. Results appear as soon as all inputs are valid.

---

## SECTION 1 — DATABASE SCHEMA

**File:** `prisma/schema.prisma`

Define exactly these two models. Do not add, rename, or remove any field.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String        @id @default(cuid())
  email        String        @unique
  name         String?
  passwordHash String
  isVerified   Boolean       @default(false)
  otpCode      String?
  otpExpiry    DateTime?
  otpAttempts  Int           @default(0)
  createdAt    DateTime      @default(now())
  calculations Calculation[]
}

model Calculation {
  id             String   @id @default(cuid())
  userId         String
  calculatorType String
  inputs         Json
  results        Json
  createdAt      DateTime @default(now())
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Key design decisions to respect:**
- `passwordHash` — never the raw password
- `isVerified` — starts `false`, becomes `true` only after successful OTP verification
- `otpAttempts` — rate gates brute-force attempts on OTP
- `inputs` and `results` are `Json` — any calculator type can store its data without schema changes
- Cascade delete ensures user deletion cleans up all calculations

---

## SECTION 2 — ENVIRONMENT CONFIGURATION

**File:** `.env.local`

```bash
# PostgreSQL — obtain from your database provider (e.g. Supabase, Railway, Neon)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/finratio?schema=public"

# JWT signing secret — must be at least 32 random characters
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET="REPLACE_WITH_64_CHAR_RANDOM_HEX_STRING"

# Resend transactional email — get API key from https://resend.com/api-keys
RESEND_API_KEY="re_REPLACE_WITH_YOUR_KEY"

# The email address OTPs will be sent from — must be verified in Resend dashboard
RESEND_FROM_EMAIL="deepak.poddar@finratio.sbs"

# Base URL of this application
NEXTAUTH_URL="http://localhost:3000"
```

---

## SECTION 3 — SHARED LIBRARIES

### 3A. `/lib/auth.ts` — Authentication Helpers

Export exactly these seven functions. Implement each one fully.

```typescript
// Dependencies: bcryptjs, jsonwebtoken, next/server
// Environment variables used: JWT_SECRET

export async function hashPassword(password: string): Promise<string>
// bcrypt.hash(password, 12)
// saltRounds must be 12 — do not lower this for "speed"

export async function verifyPassword(password: string, hash: string): Promise<boolean>
// bcrypt.compare(password, hash)

export function generateOTP(): string
// Returns a 6-digit numeric string e.g. "482931"
// Use Math.floor(Math.random() * 1000000).toString().padStart(6, "0")

export function signJWT(payload: { userId: string; email: string }): string
// jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: "HS256", expiresIn: "7d" })

export function verifyJWT(token: string): { userId: string; email: string } | null
// jwt.verify inside try/catch — return null on any error

export function setAuthCookie(res: NextResponse, token: string): void
// res.cookies.set("auth-token", token, {
//   httpOnly: true,
//   secure: process.env.NODE_ENV === "production",
//   sameSite: "lax",
//   maxAge: 60 * 60 * 24 * 7,  // 7 days in seconds
//   path: "/",
// })

export function clearAuthCookie(res: NextResponse): void
// res.cookies.set("auth-token", "", { maxAge: 0, path: "/" })
```

### 3B. `/lib/email.ts` — OTP Email

```typescript
// Primary: Resend SDK
// Fallback comment: If Resend is unavailable, swap for Nodemailer SMTP

export async function sendOTPEmail(
  email: string,
  name: string,
  otp: string
): Promise<void>
```

The email HTML template must include:
- FinRatio branding (logo text, indigo colour scheme)
- Greeting: "Hi [name],"
- Clear display of the 6-digit OTP in a large, monospace box
- Expiry notice: "This code expires in 5 minutes."
- Security notice: "Do not share this code with anyone. FinRatio will never ask for your OTP."
- Plain-text fallback content

### 3C. `/lib/validations.ts` — Zod Schemas

```typescript
import { z } from "zod"

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
})

export const signinSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

export const otpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
})

export type SignupInput = z.infer<typeof signupSchema>
export type SigninInput = z.infer<typeof signinSchema>
export type OTPInput = z.infer<typeof otpSchema>
```

---

## SECTION 4 — FINANCIAL CALCULATIONS LIBRARY

**File:** `/lib/financialCalculations.ts`

This is the most critical file. ALL formula logic lives here. It must export the following types and functions. Implement every function completely — no stubs.

### Types

```typescript
export type CalculatorType =
  | "debt-equity"
  | "quasi-debt-equity"
  | "current-ratio"
  | "dscr"
  | "ebitda"
  | "iscr"
  | "ageing"
  | "net-working-capital"
  | "drawing-power"

export type RiskLevel = "low" | "moderate" | "high" | "n/a"

export interface CalculationResult {
  value: number | null
  formatted: string
  interpretation: string
  risk: RiskLevel
  details?: string
}

export interface AgingBucket {
  label: string
  amount: number
  count: number
  percentage: number
}

export interface AgingResult {
  buckets: AgingBucket[]
  total: number
  interpretation: string
  risk: RiskLevel
}
```

### `formatCurrency(value: number): string`

Returns Indian-formatted currency. Examples:
- 100000 → "₹1,00,000.00"
- 5000000 → "₹50,00,000.00"
- -250000 → "-₹2,50,000.00"

Use `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })`.

### `calculateDebtEquity(totalDebt: number, totalEquity: number): CalculationResult`

```
Formula: totalDebt / totalEquity
Throw if totalEquity === 0: "Equity cannot be zero"
Throw if either input < 0: "Values cannot be negative"

Risk interpretation:
  ratio < 1    → risk: "low",      "Low leverage — the business is conservatively financed with more equity than debt"
  ratio 1–2    → risk: "moderate", "Moderate leverage — manageable debt levels relative to equity"
  ratio > 2    → risk: "high",     "High leverage — elevated financial risk due to significant debt relative to equity"
```

### `calculateQuasiDebtEquity(totalDebt: number, quasiDebt: number, equity: number): CalculationResult`

```
Formula: (totalDebt + quasiDebt) / equity
Throw if equity === 0: "Equity cannot be zero"
Quasi debt = preference shares, subordinated debt, hybrid instruments

Same risk thresholds as calculateDebtEquity
```

### `calculateCurrentRatio(currentAssets: number, currentLiabilities: number): CalculationResult`

```
Formula: currentAssets / currentLiabilities
Throw if currentLiabilities === 0: "Current liabilities cannot be zero"
Both inputs must be >= 0

Risk interpretation:
  ratio < 1    → risk: "high",     "Below 1 — the business may struggle to meet short-term obligations"
  ratio 1–1.5  → risk: "moderate", "Adequate liquidity — current obligations are covered"
  ratio > 1.5  → risk: "low",      "Strong liquidity position — comfortable short-term cushion"
```

### `calculateDSCR(netOperatingIncome: number, totalDebtService: number): CalculationResult`

```
Formula: netOperatingIncome / totalDebtService
Throw if totalDebtService === 0: "Total debt service cannot be zero"

Risk interpretation:
  ratio < 1    → risk: "high",     "Insufficient cash flow to cover debt obligations — high default risk"
  ratio 1–1.5  → risk: "moderate", "Marginally adequate coverage — limited buffer for cash flow fluctuations"
  ratio > 1.5  → risk: "low",      "Healthy debt service capacity — strong cash flow relative to obligations"
```

### `calculateEBITDA(revenue: number, operatingExpenses: number): CalculationResult`

```
Formula: revenue - operatingExpenses
Both inputs must be >= 0
formatted: use formatCurrency()

margin = ((revenue - operatingExpenses) / revenue) * 100

Risk interpretation:
  ebitda < 0       → risk: "high",     "Negative EBITDA — the business is operating at a loss"
  margin 0–20%     → risk: "moderate", "Thin operating margin — limited profitability buffer"
  margin > 20%     → risk: "low",      "Healthy operating margin — strong profitability"

details: include margin percentage e.g. "EBITDA Margin: 23.4%"
```

### `calculateISCR(ebit: number, interestExpense: number): CalculationResult`

```
Formula: ebit / interestExpense
Throw if interestExpense === 0: "Interest expense cannot be zero"

Risk interpretation:
  ratio < 1    → risk: "high",     "Cannot cover interest payments — critical financial distress signal"
  ratio 1–1.5  → risk: "moderate", "Barely covering interest — vulnerable to earnings decline"
  ratio > 1.5  → risk: "low",      "Comfortable interest coverage — earnings well above interest obligations"
```

### `calculateNetWorkingCapital(currentAssets: number, currentLiabilities: number): CalculationResult`

```
Formula: currentAssets - currentLiabilities
formatted: use formatCurrency() (result can be negative)

Risk interpretation:
  nwc < 0          → risk: "high",     "Negative NWC — short-term insolvency risk, liabilities exceed assets"
  nwc 0–500000     → risk: "moderate", "Minimal working capital buffer — limited financial flexibility"
  nwc > 500000     → risk: "low",      "Strong working capital cushion — well-positioned for operations"
```

### `calculateDrawingPower(eligibleStock: number, eligibleReceivables: number, marginPercent: number): CalculationResult`

```
Formula: (eligibleStock + eligibleReceivables) * (1 - marginPercent / 100)
All inputs must be >= 0
marginPercent must be between 0 and 100

formatted: use formatCurrency()

interpretation: "Drawing power based on {marginPercent}% margin on eligible stock and receivables.
                 Eligible collateral: {formatCurrency(eligibleStock + eligibleReceivables)}"

risk: "n/a" — drawing power is factual, not a risk indicator by itself
```

### `calculateAgeing(receivables: { amount: number; daysOutstanding: number }[]): AgingResult`

```
Group each receivable into a bucket by daysOutstanding:
  0–30 days:  label "0–30 Days"
  31–60 days: label "31–60 Days"
  61–90 days: label "61–90 Days"
  91+ days:   label "90+ Days"

For each bucket: total amount, count, percentage of grand total

total = sum of all receivable amounts

pctOver90 = (bucket["90+ Days"].amount / total) * 100

Risk:
  pctOver90 < 10%   → "low",     "Low aging risk — most receivables are current and within terms"
  pctOver90 10–30%  → "moderate","Moderate aging — a notable portion of receivables are overdue"
  pctOver90 > 30%   → "high",    "High aging risk — significant overdue receivables require immediate attention"

Return all four buckets even if amount is 0
```

---

## SECTION 5 — CALCULATOR CONFIG

**File:** `/lib/calculatorConfig.ts`

This is the single source of truth for the calculator list. Every other part of the app reads from here.

```typescript
import { CalculatorType } from "./financialCalculations"

export interface CalculatorConfig {
  id: CalculatorType
  name: string
  description: string
  path: string
  icon: string          // Lucide icon name or emoji
  shortDescription: string  // One line for Navbar dropdown
}

export const CALCULATORS: CalculatorConfig[] = [
  {
    id: "debt-equity",
    name: "Debt-to-Equity Ratio",
    description: "Measures financial leverage by comparing total debt to shareholders' equity.",
    shortDescription: "Assess financial leverage and capital structure",
    path: "/calculators/debt-equity",
    icon: "Scale",
  },
  {
    id: "quasi-debt-equity",
    name: "Quasi Debt-to-Equity Ratio",
    description: "Includes hybrid instruments like preference shares alongside standard debt in the leverage calculation.",
    shortDescription: "Leverage ratio including hybrid debt instruments",
    path: "/calculators/quasi-debt-equity",
    icon: "GitMerge",
  },
  {
    id: "current-ratio",
    name: "Current Ratio",
    description: "Evaluates short-term liquidity by comparing current assets to current liabilities.",
    shortDescription: "Measure short-term liquidity position",
    path: "/calculators/current-ratio",
    icon: "Droplets",
  },
  {
    id: "dscr",
    name: "Debt Service Coverage Ratio",
    description: "Determines whether operating income is sufficient to service all debt obligations.",
    shortDescription: "Check debt repayment capacity from operations",
    path: "/calculators/dscr",
    icon: "ShieldCheck",
  },
  {
    id: "ebitda",
    name: "EBITDA",
    description: "Calculates earnings before interest, tax, depreciation, and amortisation as a proxy for operating cash flow.",
    shortDescription: "Compute core operating profitability",
    path: "/calculators/ebitda",
    icon: "TrendingUp",
  },
  {
    id: "iscr",
    name: "Interest Service Coverage Ratio",
    description: "Assesses the ability to meet interest payments from operating earnings.",
    shortDescription: "Evaluate ability to service interest payments",
    path: "/calculators/iscr",
    icon: "Percent",
  },
  {
    id: "net-working-capital",
    name: "Net Working Capital",
    description: "Measures the surplus of current assets over current liabilities as a liquidity buffer.",
    shortDescription: "Quantify short-term operational liquidity buffer",
    path: "/calculators/net-working-capital",
    icon: "Wallet",
  },
  {
    id: "drawing-power",
    name: "Drawing Power",
    description: "Calculates the maximum working capital limit a business can draw against pledged collateral.",
    shortDescription: "Compute maximum cash credit drawing limit",
    path: "/calculators/drawing-power",
    icon: "CreditCard",
  },
  {
    id: "ageing",
    name: "Receivables Ageing Analysis",
    description: "Analyses the age profile of outstanding receivables to identify collection risk.",
    shortDescription: "Identify overdue receivables and collection risk",
    path: "/calculators/ageing",
    icon: "Clock",
  },
]
```

---

## SECTION 6 — MIDDLEWARE

**File:** `middleware.ts` (project root, next to `package.json`)

```typescript
// Protect: /dashboard, /calculators, /calculators/*
// On every request to protected paths:
//   1. Read cookie named "auth-token"
//   2. Call verifyJWT(token)
//   3. If invalid/missing → redirect to /auth/signin?redirect=<originalPath>
//   4. If valid → clone request headers, set x-user-id = payload.userId, continue

// Use NextResponse.next({ request: { headers: modifiedHeaders } })
// Matcher config: ["/dashboard/:path*", "/calculators/:path*"]
```

---

## SECTION 7 — RATE LIMITING UTILITY

**File:** `/lib/rateLimit.ts`

Create a simple in-memory rate limiter. Use this in all auth API routes.

```typescript
// Map<string, { count: number; resetAt: number }>
// Key: IP address (from request headers)
// Limit: 10 requests per 60 seconds per IP
// Returns: { allowed: boolean; remaining: number; resetAt: number }

export function rateLimit(ip: string): { allowed: boolean; remaining: number }
```

---

## SECTION 8 — API ROUTES

### 8A. POST `/api/auth/signup`

```
1. Extract IP, call rateLimit(ip) → 429 if blocked
2. Parse body, validate with signupSchema → 400 with Zod errors if invalid
3. Check prisma.user.findUnique({ where: { email } }) → 409 "Email already registered" if found
4. hash = await hashPassword(password)
5. otp = generateOTP()
6. otpExpiry = new Date(Date.now() + 5 * 60 * 1000)
7. prisma.user.create({ name, email, passwordHash: hash, isVerified: false, otpCode: otp, otpExpiry, otpAttempts: 0 })
8. await sendOTPEmail(email, name, otp)
9. return NextResponse.json({ message: "OTP sent to your email" }, { status: 201 })
10. All errors caught → return 500 { error: "An error occurred. Please try again." }
```

### 8B. POST `/api/auth/verify-otp`

```
1. Rate limit check
2. Validate body with otpSchema
3. Find user by email → 404 if not found
4. If user.isVerified === true:
     → sign JWT, setAuthCookie, return 200 { message: "Already verified" }
5. If user.otpAttempts >= 5:
     → return 429 { error: "Too many attempts. Please request a new OTP." }
6. If user.otpExpiry < new Date():
     → return 400 { error: "OTP has expired. Please request a new one." }
7. If user.otpCode !== body.otp:
     → prisma.user.update({ where: { email }, data: { otpAttempts: { increment: 1 } } })
     → return 400 { error: "Invalid OTP. Please check and try again." }
8. On success:
     → prisma.user.update({ where: { email }, data: { isVerified: true, otpCode: null, otpExpiry: null, otpAttempts: 0 } })
     → token = signJWT({ userId: user.id, email: user.email })
     → res = NextResponse.json({ message: "Email verified successfully" })
     → setAuthCookie(res, token)
     → return res
```

### 8C. POST `/api/auth/signin`

```
1. Rate limit check
2. Validate with signinSchema
3. Find user by email
   → if NOT found: return 401 { error: "Invalid credentials" }   ← NEVER say "email not found"
4. valid = await verifyPassword(body.password, user.passwordHash)
   → if NOT valid: return 401 { error: "Invalid credentials" }
5. If user.isVerified === false:
   → return 403 { error: "Please verify your email first.", needsVerification: true }
6. token = signJWT({ userId: user.id, email: user.email })
7. res = NextResponse.json({ message: "Signed in successfully" })
8. setAuthCookie(res, token)
9. return res
```

### 8D. POST `/api/auth/resend-otp`

```
1. Rate limit check
2. Accept { email }
3. Find user by email → 404 if not found
4. If user.isVerified → return 400 { error: "Account is already verified" }
5. otp = generateOTP()
6. otpExpiry = new Date(Date.now() + 5 * 60 * 1000)
7. prisma.user.update({ where: { email }, data: { otpCode: otp, otpExpiry, otpAttempts: 0 } })
8. await sendOTPEmail(email, user.name ?? "User", otp)
9. return 200 { message: "New OTP sent to your email" }
```

### 8E. POST `/api/auth/signout`

```
1. res = NextResponse.json({ message: "Signed out successfully" })
2. clearAuthCookie(res)
3. return res
```

### 8F. GET + POST `/api/calculations`

```
GET:
  1. userId = request.headers.get("x-user-id")  ← set by middleware
  2. If missing → 401
  3. calculations = prisma.calculation.findMany({
       where: { userId },
       orderBy: { createdAt: "desc" },
       select: { id, calculatorType, inputs, results, createdAt }
     })
  4. return 200 { calculations }

POST:
  1. userId = request.headers.get("x-user-id")
  2. If missing → 401
  3. Parse body: { calculatorType, inputs, results }
  4. Validate calculatorType is one of the 9 valid CalculatorType values
  5. prisma.calculation.create({ data: { userId, calculatorType, inputs, results } })
  6. return 201 { id: calculation.id, message: "Result saved successfully" }
```

### 8G. POST `/api/ai-analysis` — Streaming

```typescript
// Accept: { calculatorType: CalculatorType; inputs: object; results: object }
// Validate userId from x-user-id header
// Construct dynamic prompt based on calculatorType
// Stream response using ReadableStream + Anthropic SDK

// System prompt:
"You are a senior financial analyst specialising in Indian SME credit assessment.
Analyse the provided financial ratio result and give a structured, actionable assessment.
Always format currency values using Indian notation (lakh/crore).
Structure your response with these four clearly labelled sections:
1. What This Ratio Indicates
2. Key Risks Identified
3. Actionable Recommendations (provide exactly 3)
4. Industry Benchmarks & Context"

// User prompt includes:
- Calculator name (look up from CALCULATORS config by type)
- All input fields with their values (₹ formatted where relevant)
- The calculated result value
- The risk level (low / moderate / high)
- Request for analysis per the 4-section structure above

// Stream the Anthropic response to the client using TransformStream
// Return Content-Type: text/event-stream or text/plain (streaming)
// Handle errors: if stream fails, return 500 with non-streaming error message
```

---

## SECTION 9 — AUTH UI PAGES

### 9A. `/app/auth/signup/page.tsx`

**Must include:**
- Centered card, max-width 400px, FinRatio logo text at top
- Fields: Name, Email, Password
- Password field: eye icon toggle to show/hide
- Password strength indicator below password field:
  - Weak (red): < 8 chars OR no uppercase OR no number
  - Medium (amber): 8+ chars + either uppercase or number
  - Strong (green): 8+ chars + both uppercase and number
  - Display as a horizontal bar that fills proportionally
- Submit button: shows spinner + "Creating account…" while loading, disabled during request
- On 201 success: `router.push("/auth/verify-otp?email=" + encodeURIComponent(email))`
- On 409: show "This email is already registered. Sign in instead?" with link
- On 422/400: show Zod error messages below each field
- On any other error: toast notification
- "Already have an account? Sign in" link at bottom

### 9B. `/app/auth/verify-otp/page.tsx`

**Must include:**
- Email read from `useSearchParams().get("email")`
- OTP input: 6 individual `<input type="text" maxLength={1}>` boxes in a row
  - Auto-advance to next box on digit entry
  - Auto-retreat to previous box on Backspace
  - Paste support: if 6 digits pasted, distribute across boxes
  - On wrong OTP: red border + CSS shake animation on all 6 boxes
- Countdown timer starting at 5:00
  - Display format: "4:52", "1:03", "0:00"
  - Uses `setInterval` cleanup in `useEffect`
  - When reaches 0:00: hide timer, show "Resend OTP" button
- Resend OTP button:
  - Calls POST /api/auth/resend-otp with email
  - On success: restart 5:00 timer, hide Resend button, show timer again
- On submit: POST /api/auth/verify-otp with { email, otp: boxes.join("") }
- On 200 success: show success toast, `setTimeout(() => router.push("/dashboard"), 1500)`
- On 429: "Too many attempts. Request a new OTP." with auto-shown Resend button

### 9C. `/app/auth/signin/page.tsx`

**Must include:**
- Centered card, FinRatio logo, Email + Password fields
- Password show/hide toggle
- Submit button with loading state
- On success: `router.push(redirectParam ?? "/dashboard")`
- On 403 with needsVerification: `router.push("/auth/verify-otp?email=" + email)`
- On 401: inline error "Invalid email or password" (not field-specific — security requirement)
- "Don't have an account? Sign up" link at bottom
- Redirect param: read `useSearchParams().get("redirect")` and pass through

---

## SECTION 10 — CALCULATOR ARCHITECTURE

### 10A. `/components/calculators/CalculatorShell.tsx`

This is the shared layout wrapper used by all 9 calculator pages.

```typescript
interface CalculatorShellProps {
  title: string
  description: string
  children: React.ReactNode        // The input form (left panel)
  result?: React.ReactNode         // The result card (right panel) — null until calculated
  onSave?: () => void
  isSaving?: boolean
}
```

**Layout requirements:**
- Two-column grid on desktop (`lg:grid-cols-2 gap-8`), single column on mobile
- Left column: inputs card with title + description at top
- Right column: result card — hidden on mobile until results appear, then slides in with `transition-all duration-300`
- Breadcrumb at top: "Calculators / [Calculator Name]"
- Back link to `/calculators`

### 10B. Individual Calculator Pages — Common Pattern

Every calculator page follows this exact pattern:

```typescript
"use client"

import { useState, useEffect } from "react"
import { CalculatorShell } from "@/components/calculators/CalculatorShell"
import { calculateXxx, formatCurrency } from "@/lib/financialCalculations"
import { ResultCard } from "@/components/calculators/ResultCard"
import { AIAnalysisPanel } from "@/components/calculators/AIAnalysisPanel"

export default function XxxCalculatorPage() {
  // State for each input field (string for input, parse to number for calculation)
  const [input1, setInput1] = useState("")
  const [input2, setInput2] = useState("")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showAI, setShowAI] = useState(false)

  useEffect(() => {
    const n1 = parseFloat(input1)
    const n2 = parseFloat(input2)
    if (!isNaN(n1) && !isNaN(n2) && n1 >= 0 && n2 > 0) {
      try {
        setResult(calculateXxx(n1, n2))
        setError(null)
      } catch (e) {
        setError((e as Error).message)
        setResult(null)
      }
    } else {
      setResult(null)
    }
  }, [input1, input2])

  const handleSave = async () => { /* POST /api/calculations */ }

  return (
    <CalculatorShell title="..." description="..." result={result ? <ResultCard ... /> : null}>
      {/* Currency inputs */}
    </CalculatorShell>
  )
}
```

### 10C. Result Card Component `/components/calculators/ResultCard.tsx`

Props: `{ result: CalculationResult; calculatorType: CalculatorType; inputs: object; onSave: () => void; isSaving: boolean }`

**Must render:**
- Calculated value: `text-4xl font-bold tabular-nums` — the main number, large and prominent
- Risk badge: colour-coded pill
  - low → `bg-green-100 text-green-700 border border-green-200`
  - moderate → `bg-amber-100 text-amber-700 border border-amber-200`
  - high → `bg-red-100 text-red-700 border border-red-200`
- Risk label: "Low Risk" / "Moderate Risk" / "High Risk"
- Interpretation text paragraph
- Details text (if present) in muted smaller font
- "Save Result" button — indigo, with spinner when saving
- "Get AI Analysis" button — outline style, triggers AI panel
- Saved confirmation toast on successful save

### 10D. AI Analysis Panel `/components/calculators/AIAnalysisPanel.tsx`

Props: `{ calculatorType: CalculatorType; inputs: object; results: object; isVisible: boolean }`

**Must:**
- Only render when `isVisible === true`
- On mount (when isVisible becomes true): immediately POST to `/api/ai-analysis`
- Display streaming text as it arrives using `ReadableStream` reader
- Show "Analysing…" skeleton placeholder while streaming starts
- Render the 4 analysis sections with clear visual separators as they stream in
- Show "Retry" button on error
- "Copy Analysis" button to copy full text to clipboard

---

## SECTION 11 — INDIVIDUAL CALCULATOR PAGES

Build all 9 pages. Each must:
1. Use `CalculatorShell`
2. Import only from `/lib/financialCalculations.ts` for calculation logic
3. Use `CurrencyInput` component (or inline implementation) for ₹-prefixed fields
4. Recalculate in real-time via `useEffect`

### 11A. `/app/calculators/debt-equity/page.tsx`
- Inputs: Total Debt (₹), Total Equity (₹)
- Calls: `calculateDebtEquity(debt, equity)`

### 11B. `/app/calculators/quasi-debt-equity/page.tsx`
- Inputs: Total Debt (₹), Quasi Debt (₹), Equity (₹)
- Tooltip explaining what "Quasi Debt" means
- Calls: `calculateQuasiDebtEquity(debt, quasiDebt, equity)`

### 11C. `/app/calculators/current-ratio/page.tsx`
- Inputs: Current Assets (₹), Current Liabilities (₹)
- Calls: `calculateCurrentRatio(assets, liabilities)`

### 11D. `/app/calculators/dscr/page.tsx`
- Inputs: Net Operating Income (₹), Total Debt Service (₹)
- Helper text: "Total Debt Service = Principal repayments + Interest for the period"
- Calls: `calculateDSCR(noi, debtService)`

### 11E. `/app/calculators/ebitda/page.tsx`
- Inputs: Revenue (₹), Operating Expenses (₹)
- Shows both absolute EBITDA and margin % in result
- Calls: `calculateEBITDA(revenue, expenses)`

### 11F. `/app/calculators/iscr/page.tsx`
- Inputs: EBIT (₹), Interest Expense (₹)
- Helper text: "EBIT = Earnings Before Interest and Tax"
- Calls: `calculateISCR(ebit, interest)`

### 11G. `/app/calculators/net-working-capital/page.tsx`
- Inputs: Current Assets (₹), Current Liabilities (₹)
- Result can be negative — display in red if so
- Calls: `calculateNetWorkingCapital(assets, liabilities)`

### 11H. `/app/calculators/drawing-power/page.tsx`
- Inputs: Eligible Stock (₹), Eligible Receivables (₹), Margin (%)
- Margin field: numeric input with % suffix (not ₹ prefix)
- Margin validation: 0–100
- Calls: `calculateDrawingPower(stock, receivables, margin)`

### 11I. `/app/calculators/ageing/page.tsx` — Special UI

This page has a different input pattern. Build it carefully.

**Input area:**
- "Add Receivable" button adds a new row to a table
- Each row: Amount input (₹), Days Outstanding input (number), Delete row button
- Minimum: 1 row required to calculate
- Rows are stored in state as `Array<{ amount: string; daysOutstanding: string; id: string }>`

**Result area (shows when ≥1 valid row):**
- Bucket breakdown table with columns: Bucket | Amount | Count | % of Total
- Four rows: 0–30 Days, 31–60 Days, 61–90 Days, 90+ Days
- Each amount: ₹ formatted
- % column: colour-coded (90+ bucket red if >30%)
- Grand total row at bottom
- Risk badge and interpretation below table
- "Save Result" and "Get AI Analysis" buttons

---

## SECTION 12 — CALCULATOR INDEX PAGE

**File:** `/app/calculators/page.tsx`

```typescript
// Server component
// Import CALCULATORS from /lib/calculatorConfig.ts
// Render a grid of 9 calculator cards

// Each card must show:
// - Icon (using Lucide React)
// - Calculator name (heading)
// - Description (body text)
// - "Open Calculator →" link to the calculator path
// - Subtle hover effect: scale(1.01) + shadow increase

// Grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6
// Page heading: "Financial Calculators Suite"
// Sub-heading: "Professional-grade financial analysis tools for Indian SME credit assessment"
```

---

## SECTION 13 — NAVBAR

**File:** `/components/Navbar.tsx`

**Requirements:**
- `"use client"` — needs state for mobile menu and dropdown
- Logo: "FinRatio" left-aligned, bold, links to `/dashboard`
- Desktop links: Dashboard | Financial Calculators ▾ | Sign Out
- "Financial Calculators" dropdown:
  - Renders from `CALCULATORS` array (not hardcoded)
  - Each item shows: icon + name + shortDescription
  - Positioned below trigger, min-width 320px, indigo left border on hover
  - Closes on outside click
- Sign Out: calls POST `/api/auth/signout`, then `router.push("/auth/signin")`
- User display: top-right, shows name or email — fetch from `/api/auth/me` or pass as prop
- Active link highlighting: compare `usePathname()` to current route
- Mobile (< md breakpoint):
  - Hamburger icon button
  - Full-height slide-down menu with all links
  - Calculators section expanded (not a dropdown, just a list)
- Sticky positioning: `sticky top-0 z-50` with backdrop blur

---

## SECTION 14 — DASHBOARD

**File:** `/app/dashboard/page.tsx`

This is a Server Component. Fetch data on the server.

```typescript
// 1. Read userId from cookies/headers (use the auth token directly in server component)
// 2. Fetch user's calculations: prisma.calculation.findMany({ where: { userId }, orderBy: ... })
// 3. Compute:
//    - totalCount = calculations.length
//    - mostUsedType = mode of calculatorType across all calculations
//    - recentCalcs = calculations.slice(0, 10)

// Render:
// - Welcome banner: "Welcome back, [name]" (or email if no name)
// - Summary stat cards (2):
//     Card 1: "Total Analyses" → totalCount
//     Card 2: "Most Used" → mostUsedType name (from CALCULATORS config)
// - Quick access cards (3): links to the 3 most-used calculator types
// - Recent calculations table:
//     Columns: Calculator | Result | Risk | Date | Action
//     Risk column: coloured badge
//     Action column: "View" button (links to calculator page)
//     Date: formatted as "12 May 2026, 14:30"
// - Empty state: if totalCount === 0, show illustration + "No analyses yet. Start with a calculator." + CTA button
```

---

## SECTION 15 — DESIGN SYSTEM (apply everywhere)

### Colours

```css
/* Risk levels */
.risk-low      { color: #166534; background: #dcfce7; border-color: #bbf7d0; }
.risk-moderate { color: #92400e; background: #fef3c7; border-color: #fde68a; }
.risk-high     { color: #991b1b; background: #fee2e2; border-color: #fecaca; }

/* Actions */
.btn-primary   { background: #4f46e5; hover: #4338ca; }  /* indigo-600 */
.btn-danger    { background: #dc2626; }                   /* red-600 */
```

### Typography Scale

| Element | Class |
|---|---|
| Calculator result value | `text-4xl font-bold tabular-nums` |
| Page heading | `text-2xl font-bold` |
| Section heading | `text-xl font-semibold` |
| Card title | `text-lg font-semibold` |
| Input label | `text-sm font-medium text-gray-700` |
| Helper/error text | `text-xs` |
| Body text | `text-sm text-gray-600` |

### Currency Input Component

Build a reusable `CurrencyInput` component:
- Always shows "₹" prefix inside the input
- Accepts plain numeric input (user types "100000")
- On blur: format display to Indian format ("₹1,00,000")
- On focus: revert to plain number ("100000") for easy editing
- Red border + error text when invalid
- Props: `{ label, value, onChange, error, placeholder, helperText }`

### Loading States

- **Button loading:** replace button text with `<Spinner size={16} /> Loading…`, disable button
- **Page loading:** render skeleton cards using `animate-pulse` — never a bare spinner
- **AI panel loading:** animated typing indicator (three dots) while stream starts

### Toast Notifications

- Use `sonner` or a custom toast hook
- Position: top-right
- Auto-dismiss: 4 seconds
- Types: success (green icon), error (red icon), info (blue icon)
- Never block UI

---

## SECTION 16 — QUALITY REQUIREMENTS

### Must-Pass Checks

Before considering any file complete, verify:

- [ ] **No `any` types** — TypeScript strict, every parameter and return value typed
- [ ] **No hardcoded calculator lists** — all come from `CALCULATORS` in `calculatorConfig.ts`
- [ ] **No inline formulas** — all math in `financialCalculations.ts`
- [ ] **No plain-text passwords** — check every auth route
- [ ] **No raw error messages** — check every catch block
- [ ] **OTP expiry checked** — verify the comparison in verify-otp route
- [ ] **Rate limit applied** — check all 5 auth routes
- [ ] **Middleware matcher covers all protected paths** — `/dashboard/:path*` and `/calculators/:path*`
- [ ] **formatCurrency used everywhere** — no bare `.toFixed(2)` on displayed currency values
- [ ] **Indian number format** — test 1,00,000 (not 100,000) in all currency displays
- [ ] **Real-time recalculation** — `useEffect` with all input dependencies in every calculator
- [ ] **Mobile responsive** — test at 375px width for all pages
- [ ] **Empty states** — dashboard with no calculations, ageing with no receivables

### Error Handling Contract

Every API route must:
1. Wrap all logic in `try { ... } catch (error) { return NextResponse.json({ error: "An error occurred. Please try again." }, { status: 500 }) }`
2. Log the real error server-side: `console.error("[route-name]", error)`
3. Never include `error.message`, `error.stack`, or any internal details in the API response body

---

## SECTION 17 — DELIVERABLE ORDER

Generate files in exactly this order. Do not skip any file.

1. `prisma/schema.prisma`
2. `.env.local`
3. `/lib/auth.ts`
4. `/lib/email.ts`
5. `/lib/validations.ts`
6. `/lib/financialCalculations.ts`
7. `/lib/calculatorConfig.ts`
8. `/lib/rateLimit.ts`
9. `middleware.ts`
10. `/app/api/auth/signup/route.ts`
11. `/app/api/auth/verify-otp/route.ts`
12. `/app/api/auth/signin/route.ts`
13. `/app/api/auth/resend-otp/route.ts`
14. `/app/api/auth/signout/route.ts`
15. `/app/api/calculations/route.ts`
16. `/app/api/ai-analysis/route.ts`
17. `/components/ui/CurrencyInput.tsx`
18. `/components/ui/RiskBadge.tsx`
19. `/components/calculators/ResultCard.tsx`
20. `/components/calculators/AIAnalysisPanel.tsx`
21. `/components/calculators/CalculatorShell.tsx`
22. `/components/Navbar.tsx`
23. `/app/auth/signup/page.tsx`
24. `/app/auth/verify-otp/page.tsx`
25. `/app/auth/signin/page.tsx`
26. `/app/calculators/page.tsx`
27. `/app/calculators/debt-equity/page.tsx`
28. `/app/calculators/quasi-debt-equity/page.tsx`
29. `/app/calculators/current-ratio/page.tsx`
30. `/app/calculators/dscr/page.tsx`
31. `/app/calculators/ebitda/page.tsx`
32. `/app/calculators/iscr/page.tsx`
33. `/app/calculators/net-working-capital/page.tsx`
34. `/app/calculators/drawing-power/page.tsx`
35. `/app/calculators/ageing/page.tsx`
36. `/app/dashboard/page.tsx`

---

## QUICK REFERENCE — Formula Sheet

| Calculator | Formula | Divide-by-zero guard |
|---|---|---|
| Debt-Equity | `debt / equity` | equity ≠ 0 |
| Quasi D/E | `(debt + quasi) / equity` | equity ≠ 0 |
| Current Ratio | `assets / liabilities` | liabilities ≠ 0 |
| DSCR | `noi / debtService` | debtService ≠ 0 |
| EBITDA | `revenue - opex` | revenue ≥ 0 |
| ISCR | `ebit / interest` | interest ≠ 0 |
| NWC | `assets - liabilities` | none (subtraction) |
| Drawing Power | `(stock + recv) × (1 - margin/100)` | margin 0–100 |
| Ageing | Group by days bucket, sum per bucket | handle empty array |

## Quick Reference — Risk Thresholds

| Calculator | Low | Moderate | High |
|---|---|---|---|
| Debt-Equity | < 1 | 1–2 | > 2 |
| Quasi D/E | < 1 | 1–2 | > 2 |
| Current Ratio | > 1.5 | 1–1.5 | < 1 |
| DSCR | > 1.5 | 1–1.5 | < 1 |
| EBITDA margin | > 20% | 0–20% | Negative |
| ISCR | > 1.5 | 1–1.5 | < 1 |
| NWC | > ₹5L | ₹0–₹5L | Negative |
| Drawing Power | n/a | n/a | n/a |
| Ageing (90+%) | < 10% | 10–30% | > 30% |

---

*End of FinRatio Implementation Prompt v1.0*
*This document is self-contained. All information needed to build the full system is within these sections.*