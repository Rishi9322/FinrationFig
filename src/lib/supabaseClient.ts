import { createClient } from "@supabase/supabase-js"
import { projectId, publicAnonKey } from "../../utils/supabase/info"

// Single browser Supabase client. supabase-js owns the session: it persists the
// access + refresh tokens, refreshes them before expiry, and parses the tokens
// that arrive in the URL after email confirmation / magic-link / password-reset.
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
)

// Base URL of the edge function that still needs the service role (AI proxy,
// admin operations, account export/delete). Everything else talks to Postgres
// directly through supabase-js + RLS.
export const FUNCTIONS_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-bd792702`
