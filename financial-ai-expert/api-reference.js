#!/usr/bin/env node

// Financial AI Expert - Quick API Reference Guide
// This file provides ready-to-use API examples for all endpoints

const API_BASE = 'http://localhost:3001/api';

// ============================================
// 1. HEALTH CHECK
// ============================================
async function checkHealth() {
  console.log('GET /api/health');
  const res = await fetch(`${API_BASE}/health`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// ============================================
// 2. GET CAPABILITIES
// ============================================
async function getCapabilities() {
  console.log('GET /api/capabilities');
  const res = await fetch(`${API_BASE}/capabilities`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// ============================================
// 3. CREATE CMA REPORT
// ============================================
async function createCMA() {
  console.log('POST /api/create-cma');
  const payload = {
    financialData: {
      netSales: 1000000,
      grossProfit: 300000,
      currentAssets: 500000,
      currentLiabilities: 250000,
      totalAssets: 1500000,
      totalLiabilities: 700000,
      netProfit: 200000,
      interestExpense: 50000,
      debtService: 100000
    },
    companyInfo: {
      name: 'ABC Manufacturing Pvt Ltd',
      industry: 'Manufacturing',
      period: 2024
    }
  };

  const res = await fetch(`${API_BASE}/create-cma`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// ============================================
// 4. ANALYZE DOCUMENT
// ============================================
async function analyzeDocument() {
  console.log('POST /api/analyze');
  const payload = {
    content: `Balance Sheet for FY2024:
    
Assets:
- Current Assets: ₹500,000
- Fixed Assets: ₹1,000,000
- Total: ₹1,500,000

Liabilities:
- Current: ₹250,000
- Long-term: ₹450,000
- Total: ₹700,000

Equity: ₹800,000`,
    analysisType: 'comprehensive'
  };

  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// ============================================
// 5. TRANSFORM DOCUMENT
// ============================================
async function transformDocument() {
  console.log('POST /api/transform');
  const payload = {
    content: `Company: XYZ Trading
Revenue: ₹2,000,000
Profit: ₹400,000
Assets: ₹2,500,000
Liabilities: ₹1,000,000`,
    targetFormat: 'cma'
  };

  const res = await fetch(`${API_BASE}/transform`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// ============================================
// 6. CREATE PROJECTIONS
// ============================================
async function createProjections() {
  console.log('POST /api/create-projections');
  const payload = {
    historicalData: {
      year2022: { sales: 800000, profit: 120000 },
      year2023: { sales: 1000000, profit: 160000 },
      year2024: { sales: 1200000, profit: 200000 }
    },
    assumptions: {
      salesGrowthRate: 0.15,
      profitMarginTarget: 0.20,
      capexIncrease: 0.10
    }
  };

  const res = await fetch(`${API_BASE}/create-projections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// ============================================
// 7. ASSESS CREDIT RISK
// ============================================
async function assessCredit() {
  console.log('POST /api/assess-credit');
  const payload = {
    financialData: {
      currentAssets: 500000,
      currentLiabilities: 250000,
      totalAssets: 1500000,
      totalLiabilities: 700000,
      netProfit: 200000,
      netSales: 1000000,
      interestExpense: 50000,
      debtService: 100000
    },
    companyProfile: {
      name: 'ABC Corp',
      industry: 'Manufacturing',
      loanAmount: 500000
    }
  };

  const res = await fetch(`${API_BASE}/assess-credit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// ============================================
// 8. GET AVAILABLE MODELS
// ============================================
async function getModels() {
  console.log('GET /api/models');
  const res = await fetch(`${API_BASE}/models`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// ============================================
// 9. SET ACTIVE MODEL
// ============================================
async function setModel() {
  console.log('POST /api/set-model');
  const payload = { model: 'neural-chat' };

  const res = await fetch(`${API_BASE}/set-model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// ============================================
// 10. FORMAT CONVERSION
// ============================================
async function convert() {
  console.log('POST /api/convert');
  const payload = {
    data: [
      {
        company: 'ABC Corp',
        revenue: 1000000,
        profit: 200000,
        assets: 1500000
      }
    ],
    fromFormat: 'json',
    toFormat: 'csv'
  };

  const res = await fetch(`${API_BASE}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// ============================================
// MAIN MENU
// ============================================
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
╔════════════════════════════════════════╗
║  Financial AI Expert - API Reference  ║
╚════════════════════════════════════════╝

Usage: node api-reference.js <command>

Commands:
  health          - Check system health
  capabilities    - Get expert capabilities
  cma             - Create CMA Report
  analyze         - Analyze document
  transform       - Transform document format
  projections     - Create financial projections
  credit          - Assess credit risk
  models          - Get available models
  set-model       - Set active model
  convert         - Convert format

Examples:
  node api-reference.js health
  node api-reference.js cma
  node api-reference.js analyze

API Base: ${API_BASE}
    `);
    return;
  }

  const command = args[0];

  try {
    switch (command) {
      case 'health':
        await checkHealth();
        break;
      case 'capabilities':
        await getCapabilities();
        break;
      case 'cma':
        await createCMA();
        break;
      case 'analyze':
        await analyzeDocument();
        break;
      case 'transform':
        await transformDocument();
        break;
      case 'projections':
        await createProjections();
        break;
      case 'credit':
        await assessCredit();
        break;
      case 'models':
        await getModels();
        break;
      case 'set-model':
        await setModel();
        break;
      case 'convert':
        await convert();
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log('Run without arguments for help');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
