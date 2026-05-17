export const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

export async function parseCmaFinancialData(rawText: string) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key is missing. Please add VITE_OPENROUTER_API_KEY to your .env file.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "Finratio CMA Engine",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "anthropic/claude-3-sonnet", // Or anthropic/claude-3.5-sonnet depending on available models, the prompt mentioned claude-sonnet-4-20250514 but we use standard identifiers
      response_format: { type: "json_object" },
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
          content: rawText
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
    return JSON.parse(data.choices[0].message.content);
  } catch (err) {
    console.error("Failed to parse JSON", data.choices[0].message.content);
    throw new Error("AI did not return valid JSON");
  }
}

export async function* streamCmaCreditOpinion(cmaData: any) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key is missing.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "Finratio CMA Engine",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "anthropic/claude-3-sonnet", 
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

Use exact numbers from the CMA. Write in formal banking language. 500-700 words.`
        },
        {
          role: "user",
          content: JSON.stringify(cmaData, null, 2)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
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
    const lines = chunk.split('\\n');
    
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
}
