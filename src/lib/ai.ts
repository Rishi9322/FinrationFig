import { apiRequest } from "./apiSession"

/**
 * All model traffic goes through the authenticated edge function. The provider
 * key lives server-side only - it is never shipped to the browser.
 */
export async function aiChat(body: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  temperature?: number
  response_format?: { type: string }
  stream?: boolean
}): Promise<Response> {
  // The provider's free tier throttles in bursts, so a 429 is usually cleared by
  // waiting a beat. Retry once rather than surfacing a failure the user would
  // just resolve by clicking again.
  for (let attempt = 0; ; attempt++) {
    const response = await apiRequest("/ai/chat", {
      method: "POST",
      body: JSON.stringify(body),
    })

    if (response.ok) return response

    const data = await response.json().catch(() => null)

    if (response.status === 429 && attempt === 0) {
      const retryAfter = Number(response.headers.get("Retry-After")) || 5
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 15) * 1000))
      continue
    }

    const error = new Error(data?.error || `AI request failed (${response.status})`) as Error & { status: number }
    error.status = response.status
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
