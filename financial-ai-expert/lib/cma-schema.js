/**
 * Canonical CMA Schema — 9 Forms, ~120 line items
 * Tandon Committee / RBI format per PRD §9.1
 *
 * Each item: { label, form, row, type, synonyms, computed, formula? }
 * type: "input" | "subtotal" | "ratio"
 * computed: true means the engine calculates it; false means it comes from source data
 */

export const CMA_SCHEMA = {

  // ─── FORM II — Operating Statement ──────────────────────────────────────────
  form_ii_operating: {
    gross_sales:                    { label: 'Gross Sales', form: 'II', row: 1,  type: 'input',    synonyms: ['total sales', 'turnover', 'revenue', 'gross revenue', 'total revenue', 'net revenue'] },
    export_sales:                   { label: 'Export Sales', form: 'II', row: 2, type: 'input',    synonyms: ['exports', 'export turnover', 'foreign exchange earnings'] },
    excise_duty:                    { label: 'Excise Duty / GST', form: 'II', row: 3, type: 'input', synonyms: ['excise', 'gst', 'indirect tax', 'sales tax'] },
    net_sales:                      { label: 'Net Sales', form: 'II', row: 4,   type: 'subtotal',  computed: true, formula: 'gross_sales - excise_duty' },
    raw_materials_imported:         { label: 'Raw Materials — Imported', form: 'II', row: 5, type: 'input', synonyms: ['imported raw material', 'imported materials', 'imported inputs'] },
    raw_materials_indigenous:       { label: 'Raw Materials — Indigenous', form: 'II', row: 6, type: 'input', synonyms: ['local raw material', 'domestic materials', 'indigenous inputs'] },
    other_spares:                   { label: 'Other Spares / Consumables', form: 'II', row: 7, type: 'input', synonyms: ['stores and spares', 'consumables', 'packing material'] },
    power_fuel:                     { label: 'Power & Fuel', form: 'II', row: 8, type: 'input', synonyms: ['electricity', 'fuel', 'utilities', 'power charges'] },
    direct_labour:                  { label: 'Direct Labour', form: 'II', row: 9, type: 'input', synonyms: ['wages', 'salaries', 'labour cost', 'manpower cost', 'employee cost'] },
    other_mfg_expenses:             { label: 'Other Mfg. Expenses', form: 'II', row: 10, type: 'input', synonyms: ['manufacturing overhead', 'factory overhead', 'production expenses'] },
    depreciation_mfg:               { label: 'Depreciation (Mfg.)', form: 'II', row: 11, type: 'input', synonyms: ['depreciation', 'amortisation', 'depreciation and amortisation', 'd&a'] },
    cost_of_production:             { label: 'Cost of Production', form: 'II', row: 12, type: 'subtotal', computed: true, formula: 'sum(raw_materials_imported..depreciation_mfg)' },
    opening_stock_fg:               { label: 'Opening Stock — Finished Goods', form: 'II', row: 13, type: 'input', synonyms: ['opening finished goods', 'opening stock', 'ob fg'] },
    closing_stock_fg:               { label: 'Closing Stock — Finished Goods', form: 'II', row: 14, type: 'input', synonyms: ['closing finished goods', 'closing stock', 'cb fg'] },
    total_cost_of_sales:            { label: 'Total Cost of Sales', form: 'II', row: 15, type: 'subtotal', computed: true, formula: 'cost_of_production + opening_stock_fg - closing_stock_fg' },
    selling_admin_expenses:         { label: 'Selling & Admin Expenses', form: 'II', row: 16, type: 'input', synonyms: ['sga', 'selling expenses', 'admin expenses', 'overhead', 'indirect expenses'] },
    operating_profit:               { label: 'Operating Profit (PBDIT)', form: 'II', row: 17, type: 'subtotal', computed: true, formula: 'net_sales - total_cost_of_sales - selling_admin_expenses' },
    interest_on_tl:                 { label: 'Interest on Term Loans', form: 'II', row: 18, type: 'input', synonyms: ['tl interest', 'term loan interest', 'interest on secured loans'] },
    interest_on_wc:                 { label: 'Interest on Working Capital', form: 'II', row: 19, type: 'input', synonyms: ['cc interest', 'od interest', 'working capital interest', 'bank charges'] },
    total_interest:                 { label: 'Total Interest', form: 'II', row: 20, type: 'subtotal', computed: true, formula: 'interest_on_tl + interest_on_wc' },
    other_non_operating_income:     { label: 'Other Non-Operating Income', form: 'II', row: 21, type: 'input', synonyms: ['other income', 'non-operating income', 'miscellaneous income'] },
    profit_before_tax:              { label: 'Profit Before Tax (PBT)', form: 'II', row: 22, type: 'subtotal', computed: true, formula: 'operating_profit - total_interest + other_non_operating_income' },
    provision_for_tax:              { label: 'Provision for Tax', form: 'II', row: 23, type: 'input', synonyms: ['income tax', 'tax expense', 'tax provision', 'current tax', 'deferred tax'] },
    net_profit:                     { label: 'Net Profit (PAT)', form: 'II', row: 24, type: 'subtotal', computed: true, formula: 'profit_before_tax - provision_for_tax' },
    dividend:                       { label: 'Dividend', form: 'II', row: 25, type: 'input', synonyms: ['dividend paid', 'proposed dividend'] },
    retained_profit:                { label: 'Retained Profit', form: 'II', row: 26, type: 'subtotal', computed: true, formula: 'net_profit - dividend' },
  },

  // ─── FORM III — Balance Sheet Liabilities ───────────────────────────────────
  form_iii_liabilities: {
    bank_borrowings_cc:             { label: 'Bank Borrowings — CC/OD', form: 'III', row: 1,  type: 'input', synonyms: ['cash credit', 'cc limit', 'od limit', 'overdraft', 'working capital loan', 'bank od'] },
    bank_borrowings_other:          { label: 'Bank Borrowings — Other WC', form: 'III', row: 2, type: 'input', synonyms: ['packing credit', 'bills discounted', 'other bank borrowings'] },
    total_bank_borrowings:          { label: 'Total Bank Borrowings', form: 'III', row: 3,  type: 'subtotal', computed: true, formula: 'bank_borrowings_cc + bank_borrowings_other' },
    sundry_creditors:               { label: 'Sundry Creditors', form: 'III', row: 4,  type: 'input', synonyms: ['trade payables', 'accounts payable', 'creditors', 'trade creditors', 'vendor payables'] },
    advance_from_customers:         { label: 'Advance from Customers', form: 'III', row: 5,  type: 'input', synonyms: ['customer advances', 'advance received', 'contract liabilities'] },
    provision_tax_gratuity:         { label: 'Provision — Tax & Gratuity', form: 'III', row: 6, type: 'input', synonyms: ['provisions', 'tax provisions', 'gratuity payable', 'employee provisions'] },
    dividend_payable:               { label: 'Dividend Payable', form: 'III', row: 7,  type: 'input', synonyms: ['proposed dividend', 'dividend declared'] },
    tl_instalments_within_1yr:      { label: 'TL Instalments due within 1 yr', form: 'III', row: 8, type: 'input', synonyms: ['current portion of long term debt', 'cpltd', 'tl instalment', 'loan instalment due'] },
    other_current_liabilities:      { label: 'Other Current Liabilities', form: 'III', row: 9, type: 'input', synonyms: ['other liabilities', 'accrued liabilities', 'statutory dues', 'other payables'] },
    short_term_others:              { label: 'Short-Term Borrowings — Others', form: 'III', row: 10, type: 'input', synonyms: ['unsecured short term', 'short term loan', 'commercial paper'] },
    total_current_liabilities:      { label: 'Total Current Liabilities', form: 'III', row: 11, type: 'subtotal', computed: true, formula: 'sum(bank_borrowings_cc..short_term_others)' },
    debentures:                     { label: 'Debentures / Bonds', form: 'III', row: 12, type: 'input', synonyms: ['ncd', 'non-convertible debentures', 'bonds', 'debentures'] },
    term_loans_excl_instalment:     { label: 'Term Loans (excl. instalment within 1 yr)', form: 'III', row: 13, type: 'input', synonyms: ['term loan', 'tl outstanding', 'long term loan', 'secured term loan'] },
    deferred_payment_credits:       { label: 'Deferred Payment Credits', form: 'III', row: 14, type: 'input', synonyms: ['deferred payment', 'hire purchase', 'finance lease'] },
    unsecured_loans_tl:             { label: 'Unsecured Loans (Term)', form: 'III', row: 15, type: 'input', synonyms: ['director loan', 'director\'s loan a/c', 'loan from directors', 'shareholder loans', 'inter corporate loan'] },
    total_term_liabilities:         { label: 'Total Term Liabilities', form: 'III', row: 16, type: 'subtotal', computed: true, formula: 'sum(debentures..unsecured_loans_tl)' },
    total_outside_liabilities:      { label: 'Total Outside Liabilities (TOL)', form: 'III', row: 17, type: 'subtotal', computed: true, formula: 'total_current_liabilities + total_term_liabilities' },
    ordinary_share_capital:         { label: 'Ordinary Share Capital', form: 'III', row: 18, type: 'input', synonyms: ['equity share capital', 'paid up capital', 'share capital', 'equity capital'] },
    preference_share_capital:       { label: 'Preference Share Capital', form: 'III', row: 19, type: 'input', synonyms: ['preference capital', 'preference shares'] },
    general_reserve:                { label: 'General Reserve', form: 'III', row: 20, type: 'input', synonyms: ['reserves', 'general reserves', 'free reserves'] },
    other_reserves:                 { label: 'Other Reserves / Surplus', form: 'III', row: 21, type: 'input', synonyms: ['capital reserve', 'securities premium', 'share premium', 'other reserves'] },
    surplus_deficit_pl:             { label: 'Surplus/Deficit in P&L', form: 'III', row: 22, type: 'input', synonyms: ['retained earnings', 'p&l balance', 'accumulated profit', 'profit and loss account'] },
    total_net_worth:                { label: 'Total Net Worth (TNW)', form: 'III', row: 23, type: 'subtotal', computed: true, formula: 'sum(ordinary_share_capital..surplus_deficit_pl)' },
    total_liabilities:              { label: 'Total Liabilities', form: 'III', row: 24, type: 'subtotal', computed: true, formula: 'total_outside_liabilities + total_net_worth' },
  },

  // ─── FORM III — Balance Sheet Assets ────────────────────────────────────────
  form_iii_assets: {
    cash_and_bank:                  { label: 'Cash & Bank Balances', form: 'III', row: 26, type: 'input', synonyms: ['cash', 'bank balance', 'cash and equivalents', 'cash in hand', 'balance with banks'] },
    short_term_investments:         { label: 'Short-Term Investments', form: 'III', row: 27, type: 'input', synonyms: ['current investments', 'liquid investments', 'mutual funds', 'fd within 1 yr'] },
    trade_receivables_domestic:     { label: 'Trade Receivables — Domestic', form: 'III', row: 28, type: 'input', synonyms: ['sundry debtors', 'trade debtors', 'accounts receivable', 'debtors', 'bills receivable'] },
    trade_receivables_export:       { label: 'Trade Receivables — Export', form: 'III', row: 29, type: 'input', synonyms: ['export debtors', 'export receivables', 'foreign debtors'] },
    instalments_deferred_rec:       { label: 'Instalments of Deferred Receivables', form: 'III', row: 30, type: 'input', synonyms: ['deferred receivables', 'instalments receivable'] },
    raw_material_imported:          { label: 'Raw Material Stock — Imported', form: 'III', row: 31, type: 'input', synonyms: ['imported stock', 'imported inventory', 'rm imported'] },
    raw_material_indigenous:        { label: 'Raw Material Stock — Indigenous', form: 'III', row: 32, type: 'input', synonyms: ['local rm', 'indigenous rm', 'domestic raw material stock'] },
    stock_in_process:               { label: 'Stock-in-Process / WIP', form: 'III', row: 33, type: 'input', synonyms: ['wip', 'work in progress', 'semi-finished goods', 'goods in process'] },
    finished_goods_stock:           { label: 'Finished Goods Stock', form: 'III', row: 34, type: 'input', synonyms: ['fg stock', 'finished goods inventory', 'closing stock'] },
    advance_to_suppliers:           { label: 'Advance to Suppliers', form: 'III', row: 35, type: 'input', synonyms: ['advance to vendors', 'prepaid purchases', 'supplier advance'] },
    advance_payment_taxes:          { label: 'Advance Payment of Taxes', form: 'III', row: 36, type: 'input', synonyms: ['advance tax', 'tds receivable', 'tax paid in advance'] },
    other_current_assets:           { label: 'Other Current Assets', form: 'III', row: 37, type: 'input', synonyms: ['other assets', 'prepaid expenses', 'loans and advances', 'other receivables'] },
    total_current_assets:           { label: 'Total Current Assets (TCA)', form: 'III', row: 38, type: 'subtotal', computed: true, formula: 'sum(cash_and_bank..other_current_assets)' },
    gross_block:                    { label: 'Gross Block (Fixed Assets)', form: 'III', row: 39, type: 'input', synonyms: ['gross fixed assets', 'total fixed assets', 'property plant equipment', 'ppe'] },
    depreciation_to_date:           { label: 'Accumulated Depreciation', form: 'III', row: 40, type: 'input', synonyms: ['accumulated depreciation', 'depreciation reserve', 'total depreciation'] },
    net_block:                      { label: 'Net Block', form: 'III', row: 41, type: 'subtotal', computed: true, formula: 'gross_block - depreciation_to_date' },
    other_non_current_assets:       { label: 'Other Non-Current Assets', form: 'III', row: 42, type: 'input', synonyms: ['long term investments', 'capital wip', 'intangibles', 'other assets non current'] },
    total_non_current_assets:       { label: 'Total Non-Current Assets', form: 'III', row: 43, type: 'subtotal', computed: true, formula: 'net_block + other_non_current_assets' },
    total_assets:                   { label: 'Total Assets', form: 'III', row: 44, type: 'subtotal', computed: true, formula: 'total_current_assets + total_non_current_assets' },
  },

  // ─── FORM V — MPBF (Working Capital Assessment) ─────────────────────────────
  form_v_mpbf: {
    total_current_assets_mpbf:      { label: 'Total Current Assets', form: 'V', row: 1, type: 'ref', ref: 'form_iii_assets.total_current_assets' },
    other_current_liabilities_mpbf: { label: 'Other Current Liabilities (excl. Bank)', form: 'V', row: 2, type: 'subtotal', computed: true, formula: 'total_current_liabilities - total_bank_borrowings' },
    working_capital_gap:            { label: 'Working Capital Gap (WCG)', form: 'V', row: 3, type: 'subtotal', computed: true, formula: 'total_current_assets - other_current_liabilities_mpbf' },
    mpbf_method_i:                  { label: 'MPBF Method I (75% of WCG)', form: 'V', row: 4, type: 'subtotal', computed: true, formula: '0.75 * working_capital_gap' },
    mpbf_method_ii:                 { label: 'MPBF Method II (75% of CA − OCL)', form: 'V', row: 5, type: 'subtotal', computed: true, formula: '0.75 * total_current_assets - other_current_liabilities_mpbf' },
    mpbf_binding:                   { label: 'MPBF (Binding — lower of I & II)', form: 'V', row: 6, type: 'subtotal', computed: true, formula: 'min(mpbf_method_i, mpbf_method_ii)' },
  },

  // ─── FORM VI — Financial Ratios ─────────────────────────────────────────────
  form_vi_ratios: {
    current_ratio:                  { label: 'Current Ratio', form: 'VI', row: 1, type: 'ratio', computed: true, formula: 'total_current_assets / total_current_liabilities', norm: '>= 1.33' },
    debt_equity_ratio:              { label: 'Debt-Equity Ratio', form: 'VI', row: 2, type: 'ratio', computed: true, formula: 'total_outside_liabilities / total_net_worth', norm: '<= 3.0' },
    tol_tnw:                        { label: 'TOL/TNW', form: 'VI', row: 3, type: 'ratio', computed: true, formula: 'total_outside_liabilities / total_net_worth', norm: '<= 3.0' },
    tl_tnw:                         { label: 'TL/TNW', form: 'VI', row: 4, type: 'ratio', computed: true, formula: 'total_term_liabilities / total_net_worth' },
    interest_coverage:              { label: 'Interest Coverage (ISCR)', form: 'VI', row: 5, type: 'ratio', computed: true, formula: 'operating_profit / total_interest', norm: '>= 1.5' },
    dscr:                           { label: 'DSCR', form: 'VI', row: 6, type: 'ratio', computed: true, formula: '(net_profit + depreciation_mfg + total_interest) / (total_interest + tl_instalments_within_1yr)', norm: '>= 1.5' },
    inventory_receivables_to_sales: { label: 'Inventory + Receivables / Net Sales', form: 'VI', row: 7, type: 'ratio', computed: true, formula: '(finished_goods_stock + trade_receivables_domestic + trade_receivables_export) / net_sales' },
    pat_to_net_sales:               { label: 'PAT / Net Sales %', form: 'VI', row: 8, type: 'ratio', computed: true, formula: 'net_profit / net_sales * 100' },
    net_working_capital:            { label: 'Net Working Capital (NWC)', form: 'VI', row: 9, type: 'subtotal', computed: true, formula: 'total_current_assets - total_current_liabilities' },
    tangible_net_worth:             { label: 'Tangible Net Worth (TNW)', form: 'VI', row: 10, type: 'subtotal', computed: true, formula: 'total_net_worth - other_non_current_assets' },
  },
};

/** Flat list of all items with their section keys, for synonym matching */
export function flatSchema() {
  const items = [];
  for (const [section, fields] of Object.entries(CMA_SCHEMA)) {
    for (const [key, meta] of Object.entries(fields)) {
      items.push({ section, key, ...meta });
    }
  }
  return items;
}

/** All synonyms as a lookup: synonym → { section, key } */
export function buildSynonymIndex() {
  const index = {};
  for (const item of flatSchema()) {
    const terms = [item.label.toLowerCase(), ...(item.synonyms ?? []).map(s => s.toLowerCase())];
    for (const term of terms) {
      index[term] = { section: item.section, key: item.key };
    }
  }
  return index;
}

export default CMA_SCHEMA;
