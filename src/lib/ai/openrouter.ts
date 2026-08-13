import { aiChat } from "../ai";

// Model identity is decided server-side; this label is only used in exports.
const OPENROUTER_MODEL_NAME = "server-configured";

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

// Learning examples hold raw document previews and parsed financials. They are
// kept in memory for the tab only - never persisted, so nothing sensitive is left
// at rest in browser storage. Server-side opt-in storage would be the upgrade.
let learningExamples: CmaLearningExample[] = [];

function readLearningExamples(): CmaLearningExample[] {
  return learningExamples;
}

function writeLearningExamples(examples: CmaLearningExample[]) {
  learningExamples = examples.slice(0, 20);
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
    "FORMAT REFERENCE ONLY - the documents below are NOT the document you are",
    "parsing. They show the expected output shape for similar inputs. Never copy",
    "a company name, year, or figure out of them; every value you return must",
    "come from the primary source content further down.",
    ...examples.map((example, index) => {
      // The company name is the field most often echoed into an unrelated parse,
      // so it never reaches the prompt in the first place.
      const { company: _company, ...shape } = example.parsedData as Record<string, unknown>;
      const parsedPreview = JSON.stringify(shape, null, 2);
      return [
        `Example ${index + 1} (${example.sourceFormat}, model: ${example.model}):`,
        `Source preview: ${example.rawPreview}`,
        `Confirmed output: ${parsedPreview}`,
      ].join("\n");
    }),
  ].join("\n\n");
}

/**
 * Few-shot examples leak: when the current document has no clear company name
 * the model tends to reuse one it saw in an example. The name is the one field
 * that must appear verbatim in the source, so verify it rather than trust it.
 */
export function verifyCompanyAgainstSource(
  parsed: Record<string, unknown>,
  rawText: string,
): Record<string, unknown> {
  const company = parsed.company;
  if (typeof company !== "string" || !company.trim()) return parsed;

  const haystack = normalizeForMatch(rawText);
  // Compare on significant words only, so "M/s. Acme Ltd." still matches "Acme
  // Limited" in the source while an unrelated name from an example does not.
  const words = normalizeForMatch(company)
    .split(" ")
    .filter((word) => word.length > 2 && !COMPANY_STOPWORDS.has(word));

  if (words.length > 0 && words.every((word) => haystack.includes(word))) return parsed;

  return { ...parsed, company: "" };
}

const COMPANY_STOPWORDS = new Set([
  "ms", "ms.", "the", "and", "ltd", "limited", "pvt", "private", "co", "company", "llp", "inc",
]);

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

export type DocumentClassification = {
  isFinancialDocument: boolean;
  docType: string;
  confidence: number;
  reason: string;
};

export async function classifyFinancialDocument(rawText: string, sourceName?: string): Promise<DocumentClassification> {
  const excerpt = truncateText(rawText, 4000, 1000);

  const response = await aiChat({
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You classify uploaded documents for an Indian banking CMA (Credit Monitoring Arrangement) tool. Given extracted document text, return ONLY valid JSON with this exact shape:
{
  "isFinancialDocument": boolean,
  "docType": "Balance Sheet" | "Profit & Loss / Income Statement" | "CMA Form" | "Bank Statement" | "Trial Balance" | "Other Financial Statement" | "Not a Financial Document",
  "confidence": 0.0-1.0,
  "reason": "one short sentence"
}
A document is a financial document if it contains balance sheet, P&L, trial balance, CMA, or bank statement line items (assets, liabilities, sales, expenses, borrowings, etc). Otherwise isFinancialDocument is false.`
        },
        {
          role: "user",
          content: [sourceName ? `Filename: ${sourceName}` : "", "Extracted text:", excerpt].filter(Boolean).join("\n")
        }
      ]
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  const parsed = safeJsonParse(data.choices[0].message.content);
  return {
    isFinancialDocument: Boolean(parsed.isFinancialDocument),
    docType: String(parsed.docType || "Other Financial Statement"),
    confidence: Number(parsed.confidence) || 0,
    reason: String(parsed.reason || ""),
  };
}

export async function parseCmaFinancialData(rawText: string, options: ParseOptions = {}) {
  const learningContext = buildLearningContext(rawText, options.sourceFormat);
  const sourceExcerpt = truncateText(rawText);
  const sourceDescriptor = [
    options.sourceName ? `Source file: ${options.sourceName}` : null,
    options.sourceFormat ? `Source format: ${options.sourceFormat}` : null,
  ].filter(Boolean).join("\n");

  const response = await aiChat({
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a senior banking CMA analyst in India. Extract financial data from the user's input and return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "company": "string - the name as it literally appears in the primary source content. If the document does not name a company, return an empty string. Never take it from an example.",
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
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  let parsed: unknown;
  try {
    parsed = safeJsonParse(data.choices[0].message.content);
  } catch {
    throw new Error("AI did not return valid JSON");
  }

  return verifyCompanyAgainstSource(validateCmaShape(parsed), rawText);
}

/**
 * Model output is untrusted input. Every financial series must be an array of
 * finite numbers before it can reach a calculation - a string, null or NaN
 * slipping through would silently corrupt downstream ratios.
 */
export function validateCmaShape(parsed: unknown): Record<string, unknown> {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI returned an unexpected CMA structure");
  }

  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.years) || !record.years.every((year) => typeof year === "string")) {
    throw new Error("AI returned an unexpected CMA structure: years");
  }

  const check = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry !== "number" || !Number.isFinite(entry)) {
          throw new Error(`AI returned a non-numeric value at ${path}`);
        }
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) check(child, `${path}.${key}`);
    }
  };

  for (const section of ["operatingStatement", "balanceSheet"]) {
    if (record[section]) check(record[section], section);
  }

  return record;
}

export async function* streamCmaCreditOpinion(cmaData: any) {
  const requestBody = {
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
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await aiChat(requestBody);
    } catch (error) {
      // Retry only on the server's rate-limit signal, with a bounded backoff.
      if (attempt < 2 && (error as { status?: number })?.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
        continue;
      }
      throw error;
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
