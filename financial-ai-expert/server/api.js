// REST API Server — Financial AI Expert + CMA Extraction Engine
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import bodyParser from 'body-parser';
import chalk from 'chalk';
import FinancialExpert from '../lib/financial-expert.js';
import { DocumentParser, DocumentTransformer } from '../lib/document-parser.js';
import { extractCmaValues, computeCmaModel } from '../lib/cma-extractor.js';
import { CMA_SCHEMA } from '../lib/cma-schema.js';
import fs from 'fs';
import path from 'path';

const app = express();
const upload = multer({ dest: 'uploads/' });
const expert = new FinancialExpert();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Initialize expert on startup
let expertReady = false;
expert.initialize().then(() => {
  expertReady = true;
  console.log(chalk.green('✅ Financial Expert ready'));
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: expertReady ? 'ready' : 'initializing',
    timestamp: new Date().toISOString(),
    expert: expert.ollama.isConnected ? 'connected' : 'offline',
    model: expert.ollama.model
  });
});

// Get Capabilities
app.get('/api/capabilities', (req, res) => {
  res.json(expert.getCapabilities());
});

// Create CMA Report
app.post('/api/create-cma', async (req, res) => {
  try {
    if (!expertReady) {
      return res.status(503).json({ error: 'Expert not ready' });
    }

    const { financialData, companyInfo } = req.body;
    if (!financialData) {
      return res.status(400).json({ error: 'Financial data required' });
    }

    const report = await expert.createCMAReport(financialData, companyInfo);
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze Document
app.post('/api/analyze', async (req, res) => {
  try {
    if (!expertReady) {
      return res.status(503).json({ error: 'Expert not ready' });
    }

    const { content, analysisType = 'comprehensive' } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }

    const analysis = await expert.analyzeDocument(content, analysisType);
    res.json({ success: true, analysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transform Document
app.post('/api/transform', async (req, res) => {
  try {
    if (!expertReady) {
      return res.status(503).json({ error: 'Expert not ready' });
    }

    const { content, targetFormat = 'cma' } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }

    const transformed = await expert.transformDocument(content, targetFormat);
    res.json({ success: true, transformed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload and Process File
app.post('/api/process-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    // Parse file
    let data = await DocumentParser.autoDetectAndParse(filePath);
    
    // Transform to requested format
    const format = req.body.format || 'json';
    let transformed = data;

    if (format === 'cma') {
      transformed = DocumentTransformer.toCMAFormat(data);
    } else if (format === 'balancesheet') {
      transformed = DocumentTransformer.toBalanceSheet(data);
    } else if (format === 'incomestatement') {
      transformed = DocumentTransformer.toIncomeStatement(data);
    }

    // Optional: Analyze with AI
    if (req.body.analyze === 'true' && expertReady) {
      const analysis = await expert.analyzeDocument(JSON.stringify(transformed, null, 2));
      transformed.aiAnalysis = analysis;
    }

    // Cleanup
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      originalFile: req.file.originalname,
      format: format,
      data: transformed
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

// Create Financial Projections
app.post('/api/create-projections', async (req, res) => {
  try {
    if (!expertReady) {
      return res.status(503).json({ error: 'Expert not ready' });
    }

    const { historicalData, assumptions = {} } = req.body;
    if (!historicalData) {
      return res.status(400).json({ error: 'Historical data required' });
    }

    const projections = await expert.createProjections(historicalData, assumptions);
    res.json({ success: true, projections });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assess Credit Risk
app.post('/api/assess-credit', async (req, res) => {
  try {
    if (!expertReady) {
      return res.status(503).json({ error: 'Expert not ready' });
    }

    const { financialData, companyProfile = {} } = req.body;
    if (!financialData) {
      return res.status(400).json({ error: 'Financial data required' });
    }

    const assessment = await expert.assessCreditRisk(financialData, companyProfile);
    res.json({ success: true, assessment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List Available Models
app.get('/api/models', async (req, res) => {
  try {
    const models = await expert.ollama.getAvailableModels();
    res.json({ success: true, models });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set Active Model
app.post('/api/set-model', async (req, res) => {
  try {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({ error: 'Model name required' });
    }
    await expert.ollama.setModel(model);
    res.json({ success: true, model });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Convert Document Format
app.post('/api/convert', async (req, res) => {
  try {
    const { data, fromFormat = 'json', toFormat = 'excel' } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Data required' });
    }

    let converted;
    if (toFormat === 'csv') {
      converted = DocumentTransformer.toCSV(data);
    } else if (toFormat === 'excel') {
      const fileName = `output_${Date.now()}.xlsx`;
      DocumentTransformer.toExcel(data, fileName);
      converted = { file: fileName };
    } else if (toFormat === 'txt') {
      converted = DocumentTransformer.toTXT(data);
    } else if (toFormat === 'json') {
      converted = DocumentTransformer.toJSON(data);
    }

    res.json({ success: true, data: converted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── CMA Extraction Endpoints (PRD §6.2) ────────────────────────────────────

/**
 * POST /api/cma/extract
 * Body: { items: Array<{ label, value, year, source_file, source_page?, source_row? }>, years: string[] }
 * Runs rule-based + LLM extraction and returns extraction.json
 */
app.post('/api/cma/extract', async (req, res) => {
  try {
    const { items, years = ['default'] } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array required' });
    }
    const ollama = expertReady ? expert.ollama : null;
    const extraction = await extractCmaValues(items, ollama);
    res.json({ success: true, extraction, years });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/cma/compute
 * Body: { extraction: object, years: string[] }
 * Runs the deterministic computation engine and returns full CMA model + tie-outs
 */
app.post('/api/cma/compute', (req, res) => {
  try {
    const { extraction, years } = req.body;
    if (!extraction || !years) {
      return res.status(400).json({ error: 'extraction and years required' });
    }
    const { model, tieOuts } = computeCmaModel(extraction, years);
    res.json({ success: true, model, tieOuts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/cma/extract-and-compute
 * Convenience: extract + compute in one call
 */
app.post('/api/cma/extract-and-compute', async (req, res) => {
  try {
    const { items, years = ['default'] } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array required' });
    }
    const ollama = expertReady ? expert.ollama : null;
    const extraction = await extractCmaValues(items, ollama);
    const { model, tieOuts } = computeCmaModel(extraction, years);
    res.json({ success: true, extraction, model, tieOuts, years });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/cma/schema
 * Returns the canonical CMA schema for the frontend
 */
app.get('/api/cma/schema', (_req, res) => {
  res.json({ success: true, schema: CMA_SCHEMA });
});

/**
 * POST /api/cma/credit-opinion  (streaming)
 * Body: { model: object, years: string[], companyName: string }
 * Streams AI credit opinion from local Qwen model
 */
app.post('/api/cma/credit-opinion', async (req, res) => {
  try {
    if (!expertReady) return res.status(503).json({ error: 'Ollama not ready' });

    const { model, years, companyName = 'the borrower' } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const systemPrompt = `You are a senior credit analyst at a commercial bank evaluating a working capital and term loan facility application under the RBI CMA framework.

Write a structured credit assessment report for ${companyName}:

1. BORROWER PROFILE (2-3 sentences)
2. FINANCIAL PERFORMANCE — revenue CAGR, PAT%, operating efficiency
3. LIQUIDITY — Current Ratio trend vs. RBI norm ≥ 1.33, NWC trend
4. LEVERAGE — TOL/TNW vs. norm ≤ 3.0, TL/TNW
5. DSCR ANALYSIS — average DSCR, minimum DSCR, adequacy (norm ≥ 1.5)
6. WORKING CAPITAL — MPBF assessment, CC limit justification
7. KEY STRENGTHS (3-5 bullets)
8. KEY RISKS & CONCERNS (3-5 bullets)
9. CREDIT RECOMMENDATION — APPROVE / APPROVE WITH CONDITIONS / DECLINE
   - Recommended CC Limit: ₹ ___ Lakhs
   - Term Loan: ₹ ___ Lakhs (if applicable)
   - Covenants: Current Ratio ≥ ___, DSCR ≥ ___, TOL/TNW ≤ ___
10. CREDIT RISK RATING: LOW / MODERATE / HIGH

Use exact numbers from the CMA data. 500-700 words. Formal banking language.`;

    await expert.ollama.streamChat(
      systemPrompt,
      `CMA Data (years: ${years.join(', ')}):\n${JSON.stringify(model, null, 2)}`,
      (chunk) => res.write(`data: ${JSON.stringify({ chunk })}\n\n`),
      { temperature: 0.3 }
    );

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /api/health',
      'GET /api/capabilities',
      'GET /api/models',
      'POST /api/create-cma',
      'POST /api/analyze',
      'POST /api/transform',
      'POST /api/process-file',
      'POST /api/create-projections',
      'POST /api/assess-credit',
      'POST /api/set-model',
      'POST /api/convert'
    ]
  });
});

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(chalk.green(`\n✅ Financial AI Expert API Server running on http://localhost:${PORT}`));
  console.log(chalk.blue('\nAvailable Endpoints:'));
  console.log(chalk.gray(`  GET  /api/health                - Server health check`));
  console.log(chalk.gray(`  GET  /api/capabilities          - AI capabilities`));
  console.log(chalk.gray(`  POST /api/create-cma            - Create CMA report`));
  console.log(chalk.gray(`  POST /api/analyze               - Analyze financial document`));
  console.log(chalk.gray(`  POST /api/transform             - Transform document format`));
  console.log(chalk.gray(`  POST /api/process-file          - Upload and process file`));
  console.log(chalk.gray(`  POST /api/create-projections    - Create financial projections`));
  console.log(chalk.gray(`  POST /api/assess-credit         - Assess credit risk\n`));
});

export default app;
