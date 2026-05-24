export const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_MODEL_NAME = import.meta.env.VITE_OPENROUTER_MODEL_NAME || "anthropic/claude-3.5-sonnet";
const CMA_LEARNING_STORE_KEY = "finratio:cma-learning-examples";

type CmaLearningExample = {
  sourceSignature: string;
  sourceFormat: string;
  rawPreview: string;
  parsedData: Record<string, unknown>;
  createdAt: string;
  model: string;
};

type ParseOptions = {
  sourceFormat?: string;
  sourceName?: string;
};

function truncateText(text: string, head = 14000, tail = 8000) {
  if (text.length <= head + tail + 32) return text;
  return `${text.slice(0, head)}\n\n... [truncated ${text.length - head - tail} characters] ...\n\n${text.slice(-tail)}`;
}

function normalizeTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\n]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildSourceSignature(rawText: string) {
  return normalizeTokens(rawText).slice(0, 120).join(" ");
}

function safeJsonParse(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const firstBracket = candidate.indexOf("[");
    const start = firstBrace >= 0 && firstBracket >= 0 ? Math.min(firstBrace, firstBracket) : Math.max(firstBrace, firstBracket);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));

    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }

    throw new Error("OpenRouter response did not contain valid JSON");
  }
}

function readLearningExamples(): CmaLearningExample[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(CMA_LEARNING_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLearningExamples(examples: CmaLearningExample[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CMA_LEARNING_STORE_KEY, JSON.stringify(examples.slice(0, 20)));
}

function findRelevantExamples(rawText: string, sourceFormat?: string) {
  const targetTokens = new Set(normalizeTokens(rawText).slice(0, 200));
  return readLearningExamples()
    .filter((example) => !sourceFormat || example.sourceFormat === sourceFormat)
    .map((example) => {
      const exampleTokens = normalizeTokens(example.rawPreview);
      let overlap = 0;
      for (const token of exampleTokens) {
        if (targetTokens.has(token)) overlap++;
      }
      return { example, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3)
    .map(({ example }) => example);
}

function buildLearningContext(rawText: string, sourceFormat?: string) {
  const examples = findRelevantExamples(rawText, sourceFormat);
  if (examples.length === 0) return "";

  return [
    "Confirmed prior parses for similar CMA inputs:",
    ...examples.map((example, index) => {
      const parsedPreview = JSON.stringify(example.parsedData, null, 2);
      return [
        `Example ${index + 1} (${example.sourceFormat}, model: ${example.model}):`,
        `Source preview: ${example.rawPreview}`,
        `Confirmed output: ${parsedPreview}`,
      ].join("\n");
    }),
  ].join("\n\n");
}

export function recordCmaLearningExample(
  rawText: string,
  parsedData: Record<string, unknown>,
  options: { sourceFormat?: string; model?: string; sourceName?: string } = {}
) {
  if (typeof window === "undefined") return;

  const sourceSignature = buildSourceSignature(rawText);
  const rawPreview = truncateText(rawText, 1200, 300);
  const example: CmaLearningExample = {
    sourceSignature,
    sourceFormat: options.sourceFormat || "unknown",
    rawPreview,
    parsedData,
    createdAt: new Date().toISOString(),
    model: options.model || OPENROUTER_MODEL_NAME,
  };

  const current = readLearningExamples();
  const next = [example, ...current.filter((item) => item.sourceSignature !== sourceSignature)];
  writeLearningExamples(next);
}

export function buildCmaExportPayload(parsedData: Record<string, unknown>, meta: Record<string, unknown> = {}) {
  return {
    generatedAt: new Date().toISOString(),
    model: OPENROUTER_MODEL_NAME,
    ...meta,
    parsedData,
  };
}

export async function parseCmaFinancialData(rawText: string, options: ParseOptions = {}) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key is missing. Please add VITE_OPENROUTER_API_KEY to your .env file.");
  }

  const learningContext = buildLearningContext(rawText, options.sourceFormat);
  const sourceExcerpt = truncateText(rawText);
  const sourceDescriptor = [
    options.sourceName ? `Source file: ${options.sourceName}` : null,
    options.sourceFormat ? `Source format: ${options.sourceFormat}` : null,
  ].filter(Boolean).join("\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "Finratio CMA Engine",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL_NAME,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a senior banking CMA analyst in India. Extract financial data from the user's input and return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "company": "string",
  "unit": "Rs. Lakhs",
  "years": ["2024-25","2025-26","2026-27"],
  "yearTypes": ["Actual","Provisional","Projected"],
  "operatingStatement": {
    "grossSales": [],
    "exportSales": [],
    "exciseDuty": [],
    "netSales": [],
    "rawMaterials": { "imported": [], "indigenous": [] },
    "otherSpares": [],
    "powerFuel": [],
    "directLabour": [],
    "otherManufacturingExpenses": [],
    "depreciationManufacturing": [],
    "costOfProduction": [],
    "openingStockFinishedGoods": [],
    "closingStockFinishedGoods": [],
    "totalCostOfSales": [],
    "sellingAdminExpenses": [],
    "operatingProfitBeforeInterest": [],
    "interestOnTL": [],
    "interestOnWC": [],
    "totalInterest": [],
    "otherNonOperatingIncome": [],
    "profitBeforeTax": [],
    "provisionForTax": [],
    "netProfit": [],
    "dividend": [],
    "retainedProfit": []
  },
  "balanceSheet": {
    "currentLiabilities": {
      "bankBorrowingsCC": [],
      "bankBorrowingsOther": [],
      "totalBankBorrowings": [],
      "shortTermOthers": [],
      "sundryCreditors": [],
      "advanceFromCustomers": [],
      "provisionTaxGratuity": [],
      "dividendPayable": [],
      "tlInstalmentsWithin1Yr": [],
      "otherCurrentLiabilities": [],
      "totalCurrentLiabilitiesExclBank": [],
      "totalCurrentLiabilities": []
    },
    "termLiabilities": {
      "debentures": [],
      "termLoansExclInstalment": [],
      "deferredPaymentCredits": [],
      "unsecuredLoans": [],
      "totalTermLiabilities": []
    },
    "totalOutsideLiabilities": [],
    "netWorth": {
      "ordinaryShareCapital": [],
      "preferenceShareCapital": [],
      "generalReserve": [],
      "otherReserves": [],
      "surplusDeficitPL": [],
      "totalNetWorth": []
    },
    "totalLiabilities": [],
    "currentAssets": {
      "cashAndBank": [],
      "shortTermInvestments": [],
      "tradeReceivablesDomestic": [],
      "tradeReceivablesExport": [],
      "instalmentsOfDeferredReceivables": [],
      "rawMaterialStock": { "imported": [], "indigenous": [] },
      "stockInProcess": [],
      "finishedGoodsStock": [],
      "advanceToSuppliers": [],
      "advancePaymentOfTaxes": [],
      "otherCurrentAssets": [],
      "totalCurrentAssets": []
    },
    "fixedAssets": {
      "grossBlock": [],
      "depreciationToDate": [],
      "netBlock": []
    },
    "otherNonCurrentAssets": [],
    "totalNonCurrentAssets": [],
    "totalAssets": [],
    "tangibleNetWorth": [],
    "netWorkingCapital": []
  }
}
Auto-compute any missing fields using standard accounting relationships. Verify Total Assets = Total Liabilities. Flag imbalance with a "balanceCheck" key.`
        },
        {
          role: "user",
          content: [
            sourceDescriptor,
            learningContext ? `\n${learningContext}` : "",
            "\nPrimary source content:",
            sourceExcerpt,
          ].join("\n")
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  try {
    return safeJsonParse(data.choices[0].message.content);
  } catch (err) {
    console.error("Failed to parse JSON", data.choices[0].message.content);
    throw new Error("AI did not return valid JSON");
  }
}

export async function* streamCmaCreditOpinion(cmaData: any) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key is missing.");
  }

  const requestBody = JSON.stringify({
    model: OPENROUTER_MODEL_NAME,
    temperature: 0.2,
    stream: true,
    messages: [
      {
        role: "system",
        content: `You are a senior credit analyst at a commercial bank evaluating a term loan and working capital facility application under the RBI CMA framework.

The applicant's CMA data is provided. Write a structured credit assessment report:

1. BORROWER PROFILE (2-3 sentences: business, product, industry)
2. FINANCIAL PERFORMANCE
   - Revenue trend and growth rate analysis (cite specific CAGR %)
   - Profitability: Gross Profit %, PAT %, trend direction
   - Cost structure: key cost heads as % of sales, efficiency
3. LIQUIDITY ANALYSIS
   - Current Ratio trend vs. RBI norm of 1.33
   - NWC trend and adequacy
   - Working capital cycle (receivables, payables, inventory days)
4. LEVERAGE & SOLVENCY
   - TOL/TNW trend vs. norm of ≤ 3.0
   - TL/TNW trend
   - Debt repayment trajectory
5. DSCR ANALYSIS
   - Average DSCR, minimum DSCR, adequacy assessment
   - Interest coverage trend
6. WORKING CAPITAL ASSESSMENT
   - MPBF assessment: justify or question the CC limit
   - Drawing power vs. limit utilization
7. KEY STRENGTHS (3-5 bullet points)
8. KEY RISKS & CONCERNS (3-5 bullet points)
9. CREDIT RECOMMENDATION
   - APPROVE / APPROVE WITH CONDITIONS / DECLINE
   - Recommended CC (Working Capital) Limit: ₹ ___ Lakhs
   - Term Loan eligibility: ₹ ___ Lakhs (if applicable)
   - Conditions / covenants
   - Financial covenants to monitor (Current Ratio, DSCR, TOL/TNW thresholds)
10. OVERALL CREDIT RISK RATING: LOW / MODERATE / HIGH
    (with brief justification)

Use exact numbers from the CMA. Do not invent figures or ratios. If a required number is missing, state that it is not available in the provided CMA. Write in formal banking language. 500-700 words.`
      },
      {
        role: "user",
        content: JSON.stringify(cmaData, null, 2)
      }
    ]
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Finratio CMA Engine",
        "Content-Type": "application/json"
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
      const shouldRetry = response.status === 429 && attempt < 2;

      if (shouldRetry) {
        const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : (attempt + 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      let message = `OpenRouter request failed with status ${response.status}`;
      if (errorText) {
        try {
          const parsed = JSON.parse(errorText);
          message = parsed?.error?.message || parsed?.message || message;
        } catch {
          message = errorText || message;
        }
      }

      if (response.status === 429) {
        throw new Error(`OpenRouter is rate limited right now. ${message}`);
      }

      throw new Error(message);
    }

    if (!response.body) {
      throw new Error("No response body returned from API");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let isFinished = false;
    while (!isFinished) {
      const { done, value } = await reader.read();
      if (done) {
        isFinished = true;
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.choices[0].delta.content) {
              yield parsed.choices[0].delta.content;
            }
          } catch (e) {
            // parse error on chunk
          }
        }
      }
    }

    return;
  }

  throw new Error("OpenRouter is busy right now. Please try again in a moment.");
}
