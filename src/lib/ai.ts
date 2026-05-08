export async function fetchAIAnalysis(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  const modelName = import.meta.env.VITE_OPENROUTER_MODEL_NAME || "google/gemini-2.5-flash-free";

  if (!apiKey) {
    throw new Error("OpenRouter API key is missing. Please add VITE_OPENROUTER_API_KEY to your .env file.")
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin, // For OpenRouter rankings
      "X-Title": "FinRatio SaaS", // For OpenRouter rankings
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: "system",
          content: "You are a professional financial analyst. Your goal is to provide concise, actionable insights into financial metrics for Indian SMEs. Be straightforward, avoid fluff, and give clear recommendations based on the calculated ratios."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.error?.message || `API Error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}
