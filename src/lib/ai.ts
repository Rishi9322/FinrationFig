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
  const response = await apiRequest("/ai/chat", {
    method: "POST",
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const error = new Error(data?.error || `AI request failed (${response.status})`) as Error & { status: number }
    error.status = response.status
    throw error
  }

  return response
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
