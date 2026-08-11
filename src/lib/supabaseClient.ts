import { projectId } from "../../utils/supabase/info"

// Firebase owns auth and the edge function owns data access (it verifies the
// Firebase ID token and uses the service role), so the browser never talks to
// PostgREST directly — we only need the function base URL here.
export const FUNCTIONS_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-bd792702`
