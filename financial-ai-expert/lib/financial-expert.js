// Financial Expert System - AI Agent with Financial Knowledge
import OllamaClient from './ollama-client.js';
import chalk from 'chalk';

export class FinancialExpert {
  constructor() {
    this.ollama = new OllamaClient();
    this.financialContext = this.buildFinancialContext();
    this.initialized = false;
  }

  async initialize() {
    await this.ollama.initialize();
    this.initialized = this.ollama.isConnected;
    return this.initialized;
  }

  buildFinancialContext() {
    return {
      expertise: [
        'Balance Sheet Analysis',
        'Income Statement Review',
        'Cash Flow Analysis',
        'Financial Ratios (Liquidity, Profitability, Leverage, Efficiency)',
        'CMA (Credit Monitoring Arrangement) Report Creation',
        'Working Capital Assessment',
        'Debt Service Coverage Ratio (DSCR)',
        'Current Ratio and Quick Ratio Analysis',
        'Inventory Management',
        'Receivables Analysis',
        'Risk Assessment',
        'Financial Projections',
        'Budget Planning',
        'Variance Analysis',
        'Financial Compliance'
      ],
      knowledgeDomains: {
        accounting: 'Indian GAAP, AS Standards, Bank norms',
        financing: 'Working Capital, Term Loans, Collateral requirements',
        regulation: 'RBI guidelines, Banking norms, Compliance requirements',
        industries: 'Manufacturing, Trading, Services, Retail'
      },
      capabilities: [
        'Create financial reports from raw data',
        'Transform documents into financial formats',
        'Analyze financial health and ratios',
        'Generate recommendations',
        'Detect anomalies and red flags',
        'Create financial projections',
        'Assess credit worthiness'
      ]
    };
  }

  getSystemPrompt(task) {
    const basePrompt = `You are a highly experienced Financial Expert with deep knowledge in:
    - Financial Analysis and Accounting
    - CMA Report Creation
    - Banking and Credit Analysis
    - Financial Ratio Analysis
    - Indian Accounting Standards
    - Working Capital Management
    - Risk Assessment
    
Your expertise areas: ${this.financialContext.expertise.join(', ')}

You provide accurate, actionable financial insights. Always:
1. Ground your analysis in numbers and facts
2. Provide clear calculations when needed
3. Highlight risks and opportunities
4. Use standard financial terminology
5. Include specific recommendations
6. Reference relevant financial ratios
7. Consider regulatory and banking norms`;

    const taskPrompts = {
      cmaReport: `${basePrompt}\n\nCURRENT TASK: Create a professional CMA Report based on the provided financial data. Include:
- Financial Position Summary
- Balance Sheet Analysis
- Income Statement Analysis
- Key Financial Ratios (Current Ratio, Debt-to-Equity, Interest Coverage, DSCR)
- Working Capital Assessment
- Risk Analysis
- Recommendations and Conclusions
Use proper financial terminology and follow bank CMA standards.`,

      analysis: `${basePrompt}\n\nCURRENT TASK: Provide comprehensive financial analysis of the provided document. Include:
- Key Findings
- Financial Health Assessment
- Ratio Analysis
- Trend Analysis
- Strengths and Weaknesses
- Risk Factors
- Recommendations`,

      transformation: `${basePrompt}\n\nCURRENT TASK: Transform the provided document into a proper financial document. Extract key financial data and present it in standard financial format with:
- Clear categories and line items
- Proper financial classifications
- Supporting calculations
- Professional formatting`,

      projection: `${basePrompt}\n\nCURRENT TASK: Create financial projections based on historical data. Include:
- Historical trend analysis
- Growth assumptions
- Projected Balance Sheet
- Projected Income Statement
- Cash Flow Projections
- Sensitivity Analysis`,

      default: basePrompt
    };

    return taskPrompts[task] || taskPrompts.default;
  }

  async createCMAReport(financialData, companyInfo = {}) {
    if (!this.initialized) {
      throw new Error('Financial Expert not initialized. Call initialize() first.');
    }

    const message = `Create a CMA Report for:
Company: ${companyInfo.name || 'Unknown Company'}
Period: ${companyInfo.period || 'Current Period'}

Financial Data:
${JSON.stringify(financialData, null, 2)}

Create a professional, bank-ready CMA Report with all sections.`;

    console.log(chalk.blue('📝 Generating CMA Report...'));
    return this.ollama.chat(this.getSystemPrompt('cmaReport'), message);
  }

  async analyzeDocument(documentContent, analysisType = 'comprehensive') {
    if (!this.initialized) {
      throw new Error('Financial Expert not initialized.');
    }

    const message = `Analyze this financial document and provide ${analysisType} analysis:

${documentContent}

Provide detailed financial analysis with specific insights, numbers, and recommendations.`;

    console.log(chalk.blue('🔍 Analyzing financial document...'));
    return this.ollama.chat(this.getSystemPrompt('analysis'), message);
  }

  async transformDocument(documentContent, targetFormat = 'cma') {
    if (!this.initialized) {
      throw new Error('Financial Expert not initialized.');
    }

    const message = `Transform this document into a ${targetFormat.toUpperCase()} format:

${documentContent}

Extract key financial data and present it in standard ${targetFormat} format.`;

    console.log(chalk.blue(`🔄 Transforming to ${targetFormat} format...`));
    return this.ollama.chat(this.getSystemPrompt('transformation'), message);
  }

  async createProjections(historicalData, assumptions = {}) {
    if (!this.initialized) {
      throw new Error('Financial Expert not initialized.');
    }

    const message = `Create financial projections based on:

Historical Data:
${JSON.stringify(historicalData, null, 2)}

Growth Assumptions:
${JSON.stringify(assumptions, null, 2)}

Generate detailed financial projections for next 3-5 years.`;

    console.log(chalk.blue('📈 Creating financial projections...'));
    return this.ollama.chat(this.getSystemPrompt('projection'), message);
  }

  async assessCreditRisk(financialData, companyProfile = {}) {
    if (!this.initialized) {
      throw new Error('Financial Expert not initialized.');
    }

    const message = `Assess credit risk for:
Company: ${companyProfile.name || 'Company'}
Industry: ${companyProfile.industry || 'Unknown'}
Loan Amount: ${companyProfile.loanAmount || 'Unknown'}

Financial Data:
${JSON.stringify(financialData, null, 2)}

Provide credit risk assessment with:
- Credit Rating (AAA to C scale)
- Risk Factors
- Lending Recommendations
- Required Collateral
- Terms and Conditions`;

    console.log(chalk.blue('⚠️  Assessing credit risk...'));
    return this.ollama.chat(this.getSystemPrompt('analysis'), message);
  }

  async streamAnalysis(documentContent, onChunk) {
    if (!this.initialized) {
      throw new Error('Financial Expert not initialized.');
    }

    const message = `Analyze this financial document in detail:

${documentContent.substring(0, 5000)}...

Provide comprehensive financial analysis.`;

    console.log(chalk.blue('🔍 Streaming analysis...'));
    return this.ollama.streamChat(
      this.getSystemPrompt('analysis'),
      message,
      onChunk
    );
  }

  getCapabilities() {
    return this.financialContext;
  }

  async healthCheck() {
    return {
      status: this.initialized ? 'ready' : 'not-initialized',
      connected: this.ollama.isConnected,
      model: this.ollama.model,
      capabilities: this.financialContext.capabilities.length
    };
  }
}

export default FinancialExpert;
