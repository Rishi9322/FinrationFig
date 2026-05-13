# FinRatio SaaS Platform

FinRatio is a fintech-style ratio analysis platform with production-oriented credentials authentication, JWT session cookies, RBAC, calculator feature gating, and admin access management.

## Implemented Security and Access Features

- Credentials auth only: email + password (no OAuth)
- Signup fields: full name, email, phone number, password, confirm password
- Phone number collection and validation via `libphonenumber-js` (no SMS OTP)
- Email OTP verification with 6-digit code and 5-minute expiry
- JWT session in HTTP-only secure cookie
- CSRF protection for state-changing authenticated APIs
- Brute-force/rate-limit guards for signin/signup/OTP/password reset routes
- Bcrypt password hashing
- Forgot password/reset password flow with crypto-secure token and 15-minute expiry
- Role-based access control: `SUPER_ADMIN`, `ADMIN`, `USER`
- Fine-grained calculator access by user
- Default calculator access: `pid` only for new users
- Admin panel for user role/status/calculator-access management
- Access-denied route and locked calculator UI states
- Server-side permission checks for protected APIs

## Routes

### Auth

- `/auth/signup`
- `/auth/signin`
- `/auth/verify-otp`
- `/auth/forgot-password`
- `/auth/reset-password`

### Protected App

- `/dashboard`
- `/calculators`
- `/calculators/*` (feature-permission gated)

### Admin

- `/admin/users` (SUPER_ADMIN only)

### Errors

- `/access-denied`

## Prisma Schema

The requested Prisma schema is included at:

- `prisma/schema.prisma`

This schema models:

- `User`
- `Role`
- `CalculatorFeature`
- `UserCalculatorAccess`
- `Calculation`

## Environment Variables

### Frontend

The frontend uses existing Supabase function wiring via `utils/supabase/info.tsx`.

### Supabase Edge Function (`supabase/functions/make-server-bd792702`)

Set these secrets in Supabase:

- `JWT_SECRET`: strong secret for session JWT signing
- `RESEND_API_KEY`: Resend API key for transactional email
- `RESEND_FROM_EMAIL`: verified sender local part/domain mailbox, defaults to `deepak.poddar@finratio.sbs`
- `APP_BASE_URL`: frontend base URL (for reset links), e.g. `https://app.finratio.com`
- `APP_ORIGIN`: exact frontend origin for CORS, e.g. `https://app.finratio.com`
- `COOKIE_SECURE`: `true` in production, `false` for local non-HTTPS testing

## Email Provider

Resend is used for:

- Verification OTP email
- Password reset email
- Access granted notification

Use a verified sender domain in your Resend account and ensure:

- `from: FinRatio <deepak.poddar@finratio.sbs>` is allowed, or set `RESEND_FROM_EMAIL` to another verified sender

## Local Development

1. Install dependencies:
   - `npm install`
2. Run frontend:
   - `npm run dev`
3. Deploy/update edge function:
   - `supabase functions deploy make-server-bd792702 --no-verify-jwt`
4. Set secrets:
   - `supabase secrets set JWT_SECRET=... RESEND_API_KEY=... APP_BASE_URL=http://localhost:5173 APP_ORIGIN=http://localhost:5173 COOKIE_SECURE=false`

## Production Hardening Checklist

- Use HTTPS everywhere
- Keep `COOKIE_SECURE=true`
- Rotate `JWT_SECRET` periodically
- Add centralized audit logging for admin actions
- Move KV-based auth storage to relational tables backed by Prisma models for long-term scale
- Add SIEM alerts for suspicious signin/OTP/reset patterns

## Future-Ready Architecture Hooks

The current structure is prepared for extending into:

- Paid subscription plans
- Team workspaces
- Enterprise access policies
- API key issuance and rotation
- Usage quotas and metering
