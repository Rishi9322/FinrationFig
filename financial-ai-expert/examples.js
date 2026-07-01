// Example usage of Financial AI Expert System
// This file demonstrates all the key capabilities

import FinancialExpert from './lib/financial-expert.js';
import { DocumentParser, DocumentTransformer } from './lib/document-parser.js';

// Example 1: Initialize Expert
async function exampleInitialize() {
  console.log('📚 Example 1: Initialize Expert');
  const expert = new FinancialExpert();
  const initialized = await expert.initialize();
  console.log('Expert initialized:', initialized);
  return expert;
}

// Example 2: Create CMA Report
async function exampleCreateCMA(expert) {
  console.log('\n📝 Example 2: Create CMA Report');
  
  const financialData = {
    netSales: 1000000,
    costOfGoodsSold: 600000,
    grossProfit: 400000,
    operatingExpenses: 150000,
    interestExpense: 50000,
    netProfit: 200000,
    currentAssets: 500000,
    currentLiabilities: 250000,
    totalAssets: 1500000,
    totalLiabilities: 700000
  };

  const companyInfo = {
    name: 'ABC Manufacturing Pvt Ltd',
    industry: 'Manufacturing',
    period: 2024
  };

  const report = await expert.createCMAReport(financialData, companyInfo);
  console.log('CMA Report Generated');
  console.log(report.substring(0, 200) + '...');
  
  return report;
}

// Example 3: Analyze Financial Document
async function exampleAnalyzeDocument(expert) {
  console.log('\n🔍 Example 3: Analyze Financial Document');
  
  const documentContent = `
    Balance Sheet as of December 31, 2024
    
    ASSETS
    Current Assets:
    - Cash and Bank: ₹100,000
    - Inventory: ₹250,000
    - Receivables: ₹150,000
    Total Current Assets: ₹500,000
    
    Fixed Assets: ₹1,000,000
    Total Assets: ₹1,500,000
    
    LIABILITIES
    Current Liabilities:
    - Payables: ₹100,000
    - Short-term Borrowing: ₹150,000
    Total Current Liabilities: ₹250,000
    
    Long-term Debt: ₹450,000
    Total Liabilities: ₹700,000
    
    EQUITY: ₹800,000
  `;

  const analysis = await expert.analyzeDocument(documentContent, 'financial');
  console.log('Analysis Complete');
  console.log(analysis.substring(0, 300) + '...');
  
  return analysis;
}

// Example 4: Transform Document Format
async function exampleTransformDocument(expert) {
  console.log('\n🔄 Example 4: Transform Document Format');
  
  const rawData = {
    companyName: 'XYZ Trading Co',
    period: 2024,
    netSales: 2000000,
    cogs: 1200000,
    netProfit: 400000,
    currentAssets: 800000,
    currentLiabilities: 300000,
    totalAssets: 2500000,
    totalLiabilities: 1000000
  };

  const cmaFormat = DocumentTransformer.toCMAFormat(rawData);
  console.log('Data transformed to CMA format');
  console.log(JSON.stringify(cmaFormat, null, 2).substring(0, 300) + '...');
  
  return cmaFormat;
}

// Example 5: Create Financial Projections
async function exampleCreateProjections(expert) {
  console.log('\n📈 Example 5: Create Financial Projections');
  
  const historicalData = {
    year2022: { sales: 800000, profit: 120000 },
    year2023: { sales: 1000000, profit: 160000 },
    year2024: { sales: 1200000, profit: 200000 }
  };

  const assumptions = {
    salesGrowthRate: 0.15,
    profitMarginTarget: 0.20,
    capexIncrease: 0.10
  };

  const projections = await expert.createProjections(historicalData, assumptions);
  console.log('Projections created');
  console.log(projections.substring(0, 300) + '...');
  
  return projections;
}

// Example 6: Assess Credit Risk
async function exampleAssessCredit(expert) {
  console.log('\n⚠️  Example 6: Assess Credit Risk');
  
  const financialData = {
    currentAssets: 500000,
    currentLiabilities: 250000,
    totalAssets: 1500000,
    totalLiabilities: 700000,
    netProfit: 200000,
    netSales: 1000000,
    grossProfit: 400000,
    interestExpense: 50000,
    debtService: 100000
  };

  const companyProfile = {
    name: 'ABC Corp',
    industry: 'Manufacturing',
    loanAmount: 500000,
    loanTenure: 5
  };

  const assessment = await expert.assessCreditRisk(financialData, companyProfile);
  console.log('Credit risk assessment complete');
  console.log(assessment.substring(0, 300) + '...');
  
  return assessment;
}

// Example 7: Parse and Transform File
async function exampleParseFile() {
  console.log('\n📂 Example 7: Parse and Transform File');
  
  // This example shows the structure; actual parsing depends on having a file
  const exampleData = {
    companyName: 'Sample Corp',
    netSales: 5000000,
    netProfit: 750000,
    currentAssets: 2000000,
    currentLiabilities: 1000000,
    totalAssets: 5000000,
    totalLiabilities: 3000000
  };

  // Transform to different formats
  const jsonFormat = DocumentTransformer.toJSON(exampleData);
  const csvFormat = DocumentTransformer.toCSV([exampleData]);
  const balanceSheet = DocumentTransformer.toBalanceSheet(exampleData);
  const incomeStatement = DocumentTransformer.toIncomeStatement(exampleData);

  console.log('Available formats:');
  console.log('✓ JSON format');
  console.log('✓ CSV format');
  console.log('✓ Balance Sheet');
  console.log('✓ Income Statement');
  
  return { jsonFormat, balanceSheet, incomeStatement };
}

// Example 8: Get System Capabilities
async function exampleGetCapabilities(expert) {
  console.log('\n📚 Example 8: System Capabilities');
  
  const capabilities = expert.getCapabilities();
  
  console.log('\nExpertise Areas:');
  capabilities.expertise.forEach((area, i) => {
    console.log(`  ${i + 1}. ${area}`);
  });

  console.log('\nCapabilities:');
  capabilities.capabilities.forEach((cap, i) => {
    console.log(`  ${i + 1}. ${cap}`);
  });

  return capabilities;
}

// Example 9: Stream Real-time Analysis
async function exampleStreamAnalysis(expert) {
  console.log('\n🌊 Example 9: Stream Real-time Analysis');
  
  const content = `
    Our company's financial performance:
    - Revenue increased 20% YoY
    - Operating margin improved to 15%
    - Cash flow remains strong
    - Debt levels under control
  `;

  console.log('Streaming analysis (first 10 chunks):');
  let chunkCount = 0;

  const fullResponse = await expert.streamAnalysis(content, (chunk) => {
    if (chunkCount < 10) {
      console.log(`Chunk ${chunkCount + 1}:`, chunk.substring(0, 50));
      chunkCount++;
    }
  });

  console.log(`\nTotal response: ${fullResponse.length} characters`);
  return fullResponse;
}

// Example 10: Health Check
async function exampleHealthCheck(expert) {
  console.log('\n🏥 Example 10: Health Check');
  
  const health = await expert.healthCheck();
  console.log('System Status:');
  console.log('  Status:', health.status);
  console.log('  Connected:', health.connected);
  console.log('  Model:', health.model);
  console.log('  Capabilities:', health.capabilities);
  
  return health;
}

// Main execution
async function runExamples() {
  try {
    console.log('╔════════════════════════════════════════╗');
    console.log('║  Financial AI Expert - Usage Examples ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Initialize
    const expert = await exampleInitialize();

    // Run examples
    // Many examples are independent after initialization — run them in parallel
    await Promise.all([
      exampleCreateCMA(expert),
      exampleAnalyzeDocument(expert),
      exampleTransformDocument(expert),
      exampleCreateProjections(expert),
      exampleAssessCredit(expert),
      exampleParseFile(),
      exampleGetCapabilities(expert),
      exampleHealthCheck(expert)
    ]);

    // Stream example (optional, commented by default as it takes longer)
    // await exampleStreamAnalysis(expert);

    console.log('\n✅ All examples completed successfully!');
    console.log('\n📖 Next steps:');
    console.log('  1. Start the API: npm start');
    console.log('  2. Start the Dashboard: npm run dashboard');
    console.log('  3. Try the CLI: npm run cli -- interactive');
    console.log('  4. Check SETUP_GUIDE.md for more information\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Execute
runExamples();

export {
  exampleInitialize,
  exampleCreateCMA,
  exampleAnalyzeDocument,
  exampleTransformDocument,
  exampleCreateProjections,
  exampleAssessCredit,
  exampleParseFile,
  exampleGetCapabilities,
  exampleStreamAnalysis,
  exampleHealthCheck
};
