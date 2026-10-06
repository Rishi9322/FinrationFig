import { apiRequest } from "./apiSession"

/**
 * Transient failures worth retrying quietly, so a blip never reaches the user.
 *  - 429 / 503 / 502 (unavailable): fast failures - retry up to twice with backoff.
 *  - 502 with reason "timeout": the server already waited about a minute; one more
 *    try is worthwhile (slowness varies), more would just keep the user waiting.
 * Anything else (401, 400, 413...) is a real error and is thrown straight away.
 */
export function retryDelayMs(status: number, reason: string | undefined, attempt: number): number | null {
  if (status === 502 && reason === "timeout") return attempt === 0 ? 500 : null;
  if (status === 429 || status === 503 || status === 504 || status === 502) return attempt < 2 ? 1500 * (attempt + 1) : null;
  return null
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * All model traffic goes through the authenticated edge function. The provider
 * key lives server-side only - it is never shipped to the browser.
 */
export async function aiChat(
  body: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
    temperature?: number
    response_format?: { type: string }
    stream?: boolean
    max_tokens?: number
  },
  // retry:false for optional calls (e.g. document classification) that already degrade
  // gracefully - they must fail fast instead of holding up the main work.
  opts: { sleep?: (ms: number) => Promise<void>; retry?: boolean } = {},
): Promise<Response> {
  const sleep = opts.sleep ?? realSleep
  const retry = opts.retry ?? true

  for (let attempt = 0; ; attempt++) {
    let response: Response
    try {
      response = await apiRequest("/ai/chat", { method: "POST", body: JSON.stringify(body) })
    } catch (networkError) {
      // fetch itself failed (dropped mobile connection...): worth the same quiet retries.
      // But a request that already waited out its whole time limit is not retried -
      // that would just triple the wait on a connection that isn't working.
      const timedOut = (networkError as Error)?.name === "TimeoutError"
      const wait = retry && !timedOut && attempt < 2 ? 1500 * (attempt + 1) : null
      if (wait === null) throw networkError
      await sleep(wait)
      continue
    }

    if (response.ok) return response

    const data = await response.json().catch(() => null)
    const wait = retry ? retryDelayMs(response.status, data?.reason, attempt) : null
    if (wait !== null) {
      await sleep(wait)
      continue
    }

    const error = new Error(data?.error || `AI request failed (${response.status})`) as Error & { status: number; reason?: string }
    error.status = response.status
    error.reason = data?.reason
    throw error
  }
}

export async function fetchAIAnalysis(prompt: string): Promise<string> {
  const response = await aiChat({
    messages: [
      {
        role: "system",
        content:
          "You are a professional financial analyst. Your goal is to provide concise, actionable insights into financial metrics for Indian SMEs. Be straightforward, avoid fluff, and give clear recommendations based on the calculated ratios.",
      },
      { role: "user", content: prompt },
    ],
  })

  const data = await response.json()
  return data.choices[0].message.content
}
