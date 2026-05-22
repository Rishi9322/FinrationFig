/**
 * CMA Extraction Pipeline — PRD §6.2 (F-EXT)
 *
 * Three-stage pipeline per PRD:
 *   Stage 1: Rule-based (exact + fuzzy synonym matching)
 *   Stage 2: Embedding similarity (sentence-transformers via API — optional)
 *   Stage 3: Local LLM fallback (Qwen 2.5 7B via Ollama JSON mode)
 *
 * Output: extraction.json keyed by CMA schema codes,
 *         each value: { value, source, confidence, user_edited }
 */

import { buildSynonymIndex, flatSchema, CMA_SCHEMA } from './cma-schema.js';
import OllamaClient from './ollama-client.js';

const CONFIDENCE_AUTO_ACCEPT = 0.9;   // green — no flag
const CONFIDENCE_WARN = 0.7;          // yellow highlight
// Below 0.7 → red flag, requires user confirmation before export

// ─── Stage 1: Rule-based matcher ────────────────────────────────────────────

const SYNONYM_INDEX = buildSynonymIndex();
const SCHEMA_FLAT = flatSchema();

/**
 * Normalise a source label for matching.
 * Strips punctuation, lowercases, collapses whitespace.
 */
function normalise(str) {
  return str.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Levenshtein distance (for fuzzy matching).
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Similarity score 0-1 between two normalised strings.
 * 1 = identical, approaches 0 as strings diverge.
 */
function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Try to match a source label to a CMA schema item.
 * Returns { section, key, confidence } or null.
 */
function ruleMatch(label) {
  const norm = normalise(label);

  // Exact match
  if (SYNONYM_INDEX[norm]) {
    return { ...SYNONYM_INDEX[norm], confidence: 1.0 };
  }

  // Fuzzy match over all synonyms
  let best = null;
  let bestScore = 0;

  for (const [synonym, target] of Object.entries(SYNONYM_INDEX)) {
    const score = similarity(norm, synonym);
    if (score > bestScore) {
      bestScore = score;
      best = { ...target, confidence: score };
    }
  }

  return bestScore >= 0.75 ? best : null;
}

// ─── Stage 3: LLM extractor ─────────────────────────────────────────────────

const SCHEMA_SUMMARY = SCHEMA_FLAT
  .filter(i => !i.computed)
  .map(i => `${i.section}.${i.key}: "${i.label}" (${(i.synonyms ?? []).slice(0, 3).join(', ')})`)
  .join('\n');

const LLM_SYSTEM_PROMPT = `You are a senior Indian banking CMA analyst. Your task is to map financial line items to the standard CMA schema.

Available schema fields (section.key: label):
${SCHEMA_SUMMARY}

Instructions:
- Given a list of source labels with amounts, return a JSON array.
- Each element: { "source_label": "...", "schema_key": "section.key", "confidence": 0.0-1.0 }
- If no suitable mapping exists, use "schema_key": null and "confidence": 0.0
- Return ONLY the JSON array, no explanation.`;

/**
 * Run LLM mapping on unmatched items.
 * Returns array of { source_label, schema_key, confidence }
 */
async function llmMatch(ollama, unmatchedItems) {
  if (unmatchedItems.length === 0) return [];

  const userMessage = `Map these financial line items to the CMA schema:\n${JSON.stringify(unmatchedItems, null, 2)}`;

  try {
    const result = await ollama.extractJson(LLM_SYSTEM_PROMPT, userMessage);
    return Array.isArray(result) ? result : (result.mappings ?? []);
  } catch (err) {
    console.error('LLM mapping failed:', err.message);
    return unmatchedItems.map(i => ({ source_label: i.label, schema_key: null, confidence: 0 }));
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Extract CMA values from a list of source line items.
 *
 * @param {Array<{ label: string, value: number, source_file: string, source_page?: string|number, source_row?: string|number, year?: string }>} sourceItems
 * @param {OllamaClient} ollama
 * @returns {Promise<Object>} extraction.json structure
 */
export async function extractCmaValues(sourceItems, ollama) {
  const extraction = {};  // { "section.key": { value, source, confidence, user_edited } }
  const unmatched = [];

  for (const item of sourceItems) {
    const match = ruleMatch(item.label);

    if (match && match.confidence >= CONFIDENCE_WARN) {
      const schemaKey = `${match.section}.${match.key}`;
      const yearKey = item.year ?? 'default';

      if (!extraction[schemaKey]) extraction[schemaKey] = {};
      extraction[schemaKey][yearKey] = {
        value: item.value,
        source_file: item.source_file,
        source_page: item.source_page,
        source_row: item.source_row,
        raw_label: item.label,
        confidence: match.confidence,
        user_edited: false,
      };
    } else {
      unmatched.push({ label: item.label, value: item.value, year: item.year, source_file: item.source_file });
    }
  }

  // Stage 3: LLM for unmatched items
  if (unmatched.length > 0 && ollama?.isConnected) {
    const llmResults = await llmMatch(ollama, unmatched);

    for (const res of llmResults) {
      if (!res.schema_key || res.confidence < 0.3) continue;

      const original = unmatched.find(u => u.label === res.source_label);
      if (!original) continue;

      const yearKey = original.year ?? 'default';
      if (!extraction[res.schema_key]) extraction[res.schema_key] = {};
      extraction[res.schema_key][yearKey] = {
        value: original.value,
        source_file: original.source_file,
        raw_label: original.label,
        confidence: res.confidence,
        user_edited: false,
        mapped_by: 'llm',
      };
    }
  }

  return extraction;
}

/**
 * Compute all derived (formula-based) CMA fields.
 * Takes extraction.json and returns a complete computed model.
 */
export function computeCmaModel(extraction, years) {
  const model = JSON.parse(JSON.stringify(extraction)); // deep clone

  function val(schemaKey, year) {
    return model[schemaKey]?.[year]?.value ?? 0;
  }

  function set(schemaKey, year, value) {
    if (!model[schemaKey]) model[schemaKey] = {};
    model[schemaKey][year] = { value, confidence: 1.0, computed: true, user_edited: false };
  }

  for (const year of years) {
    // Form II derived rows
    set('form_ii_operating.net_sales',          year, val('form_ii_operating.gross_sales', year) - val('form_ii_operating.excise_duty', year));
    const cop = ['raw_materials_imported','raw_materials_indigenous','other_spares','power_fuel','direct_labour','other_mfg_expenses','depreciation_mfg']
      .reduce((s, k) => s + val(`form_ii_operating.${k}`, year), 0);
    set('form_ii_operating.cost_of_production', year, cop);
    set('form_ii_operating.total_cost_of_sales', year, cop + val('form_ii_operating.opening_stock_fg', year) - val('form_ii_operating.closing_stock_fg', year));
    const netSales = val('form_ii_operating.net_sales', year);
    const tcos     = val('form_ii_operating.total_cost_of_sales', year);
    const sga      = val('form_ii_operating.selling_admin_expenses', year);
    set('form_ii_operating.operating_profit',   year, netSales - tcos - sga);
    const intTotal = val('form_ii_operating.interest_on_tl', year) + val('form_ii_operating.interest_on_wc', year);
    set('form_ii_operating.total_interest',     year, intTotal);
    set('form_ii_operating.profit_before_tax',  year, val('form_ii_operating.operating_profit', year) - intTotal + val('form_ii_operating.other_non_operating_income', year));
    set('form_ii_operating.net_profit',         year, val('form_ii_operating.profit_before_tax', year) - val('form_ii_operating.provision_for_tax', year));
    set('form_ii_operating.retained_profit',    year, val('form_ii_operating.net_profit', year) - val('form_ii_operating.dividend', year));

    // Form III — Liabilities
    const tbb = val('form_iii_liabilities.bank_borrowings_cc', year) + val('form_iii_liabilities.bank_borrowings_other', year);
    set('form_iii_liabilities.total_bank_borrowings', year, tbb);
    const clFields = ['bank_borrowings_cc','bank_borrowings_other','sundry_creditors','advance_from_customers','provision_tax_gratuity','dividend_payable','tl_instalments_within_1yr','other_current_liabilities','short_term_others'];
    const tcl = clFields.reduce((s, k) => s + val(`form_iii_liabilities.${k}`, year), 0);
    set('form_iii_liabilities.total_current_liabilities', year, tcl);
    const tlFields = ['debentures','term_loans_excl_instalment','deferred_payment_credits','unsecured_loans_tl'];
    const ttl = tlFields.reduce((s, k) => s + val(`form_iii_liabilities.${k}`, year), 0);
    set('form_iii_liabilities.total_term_liabilities', year, ttl);
    const tol = tcl + ttl;
    set('form_iii_liabilities.total_outside_liabilities', year, tol);
    const nwFields = ['ordinary_share_capital','preference_share_capital','general_reserve','other_reserves','surplus_deficit_pl'];
    const tnw = nwFields.reduce((s, k) => s + val(`form_iii_liabilities.${k}`, year), 0);
    set('form_iii_liabilities.total_net_worth', year, tnw);
    set('form_iii_liabilities.total_liabilities', year, tol + tnw);

    // Form III — Assets
    const caFields = ['cash_and_bank','short_term_investments','trade_receivables_domestic','trade_receivables_export','instalments_deferred_rec','raw_material_imported','raw_material_indigenous','stock_in_process','finished_goods_stock','advance_to_suppliers','advance_payment_taxes','other_current_assets'];
    const tca = caFields.reduce((s, k) => s + val(`form_iii_assets.${k}`, year), 0);
    set('form_iii_assets.total_current_assets', year, tca);
    set('form_iii_assets.net_block', year, val('form_iii_assets.gross_block', year) - val('form_iii_assets.depreciation_to_date', year));
    const tnca = val('form_iii_assets.net_block', year) + val('form_iii_assets.other_non_current_assets', year);
    set('form_iii_assets.total_non_current_assets', year, tnca);
    set('form_iii_assets.total_assets', year, tca + tnca);

    // Form V — MPBF
    const ocl = tcl - tbb;
    set('form_v_mpbf.other_current_liabilities_mpbf', year, ocl);
    const wcg = tca - ocl;
    set('form_v_mpbf.working_capital_gap', year, wcg);
    set('form_v_mpbf.mpbf_method_i',  year, 0.75 * wcg);
    set('form_v_mpbf.mpbf_method_ii', year, 0.75 * tca - ocl);
    set('form_v_mpbf.mpbf_binding',   year, Math.min(0.75 * wcg, 0.75 * tca - ocl));

    // Form VI — Ratios
    set('form_vi_ratios.current_ratio',                  year, tcl > 0 ? tca / tcl : 0);
    set('form_vi_ratios.debt_equity_ratio',               year, tnw > 0 ? tol / tnw : 0);
    set('form_vi_ratios.tol_tnw',                         year, tnw > 0 ? tol / tnw : 0);
    set('form_vi_ratios.tl_tnw',                          year, tnw > 0 ? ttl / tnw : 0);
    set('form_vi_ratios.interest_coverage',               year, intTotal > 0 ? val('form_ii_operating.operating_profit', year) / intTotal : 0);
    const pat  = val('form_ii_operating.net_profit', year);
    const dep  = val('form_ii_operating.depreciation_mfg', year);
    const inst = val('form_iii_liabilities.tl_instalments_within_1yr', year);
    set('form_vi_ratios.dscr',                            year, (intTotal + inst) > 0 ? (pat + dep + intTotal) / (intTotal + inst) : 0);
    const inv  = val('form_iii_assets.finished_goods_stock', year) + val('form_iii_assets.raw_material_indigenous', year) + val('form_iii_assets.raw_material_imported', year);
    const rec  = val('form_iii_assets.trade_receivables_domestic', year) + val('form_iii_assets.trade_receivables_export', year);
    set('form_vi_ratios.inventory_receivables_to_sales',  year, netSales > 0 ? (inv + rec) / netSales : 0);
    set('form_vi_ratios.pat_to_net_sales',                year, netSales > 0 ? pat / netSales * 100 : 0);
    set('form_vi_ratios.net_working_capital',             year, tca - tcl);
    set('form_vi_ratios.tangible_net_worth',              year, tnw - val('form_iii_assets.other_non_current_assets', year));
  }

  // Tie-out check (PRD F-COMP-08): Total Assets ≈ Total Liabilities
  const tieOuts = {};
  for (const year of years) {
    const ta = val('form_iii_assets.total_assets', year);
    const tl = val('form_iii_liabilities.total_liabilities', year);
    tieOuts[year] = { total_assets: ta, total_liabilities: tl, balanced: Math.abs(ta - tl) < 0.01 };
  }

  return { model, tieOuts };
}

export default { extractCmaValues, computeCmaModel };
