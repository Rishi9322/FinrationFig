# Financial AI Expert - Complete Setup Guide

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd financial-ai-expert
npm install
```

### 2. Install Ollama (Required)

Ollama provides the local LLM that powers this system.

**Windows:**
- Download: https://ollama.ai/download/windows
- Run the installer
- Restart your computer

**macOS:**
- Download: https://ollama.ai/download/mac
- Run the installer

**Linux:**
```bash
curl https://ollama.ai/install.sh | sh
```

### 3. Start Ollama Service

```bash
# Ollama runs as a background service on Windows/macOS
# On Linux, start it:
ollama serve
```

### 4. Pull a Model

```bash
# Pull Mistral (recommended, ~4GB)
ollama pull mistral

# OR Neural Chat (smaller, ~3GB)
ollama pull neural-chat

# OR Llama 2 (versatile)
ollama pull llama2
```

### 5. Verify Setup

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Should return JSON with available models
```

## 🏃 Running the System

### Option A: API Server + Dashboard (Recommended)

**Terminal 1 - Start API Server:**
```bash
npm start
# Runs on http://localhost:3001
```

**Terminal 2 - Start Dashboard:**
```bash
npm run dashboard
# Runs on http://localhost:3000
```

**Browser:**
- Open http://localhost:3000
- Use the web interface for all operations

### Option B: CLI Tool

```bash
# Interactive mode
npm run cli -- interactive

# Create CMA Report from file
npm run cli -- create-cma -f data.json -n "Company Inc"

# Analyze document
npm run cli -- analyze document.txt

# Transform format
npm run cli -- transform data.xlsx -f cma -o output.json

# Check system health
npm run cli -- health

# Setup help
npm run cli -- setup
```

### Option C: Direct Node

```bash
# API only
node server/api.js

# Dashboard only
node server/dashboard.js

# CLI
node cli/index.js --help
```

## 📚 Core Modules

### 1. OllamaClient (`lib/ollama-client.js`)
- Connects to local Ollama LLM
- Manages model selection
- Handles streaming responses
- Supports chat and analysis prompts

**Usage:**
```javascript
import OllamaClient from './lib/ollama-client.js';

const ollama = new OllamaClient();
await ollama.initialize();
const response = await ollama.chat(systemPrompt, userMessage);
```

### 2. FinancialExpert (`lib/financial-expert.js`)
- AI-powered financial analysis
- 15+ expertise areas
- Multiple analysis types
- Risk assessment capabilities

**Usage:**
```javascript
import FinancialExpert from './lib/financial-expert.js';

const expert = new FinancialExpert();
await expert.initialize();

// Create CMA Report
const report = await expert.createCMAReport(financialData, companyInfo);

// Analyze document
const analysis = await expert.analyzeDocument(content);

// Transform document
const transformed = await expert.transformDocument(content, 'cma');

// Create projections
const projections = await expert.createProjections(historicalData, assumptions);

// Assess credit risk
const assessment = await expert.assessCreditRisk(financialData, companyProfile);
```

### 3. DocumentParser & Transformer (`lib/document-parser.js`)
- Parse multiple formats (JSON, Excel, CSV, TXT, PDF)
- Extract financial metrics automatically
- Transform between formats
- Support for standard financial reports

**Usage:**
```javascript
import { DocumentParser, DocumentTransformer } from './lib/document-parser.js';

// Parse
const data = await DocumentParser.autoDetectAndParse('file.xlsx');

// Transform to CMA
const cmaFormat = DocumentTransformer.toCMAFormat(data);

// Export
DocumentTransformer.toExcel(cmaFormat, 'output.xlsx');
```

## 🔌 REST API Endpoints

### Health & Info
- `GET /api/health` - System health check
- `GET /api/capabilities` - Expert capabilities
- `GET /api/models` - Available LLM models

### Document Processing
- `POST /api/create-cma` - Create CMA Report
- `POST /api/analyze` - Analyze document
- `POST /api/transform` - Transform document format
- `POST /api/process-file` - Upload and process file

### Financial Analysis
- `POST /api/create-projections` - Create financial projections
- `POST /api/assess-credit` - Assess credit risk

### Utilities
- `POST /api/set-model` - Change LLM model
- `POST /api/convert` - Convert between formats

## 📊 Example API Calls

### Create CMA Report
```bash
curl -X POST http://localhost:3001/api/create-cma \
  -H "Content-Type: application/json" \
  -d '{
    "financialData": {
      "netSales": 1000000,
      "grossProfit": 300000,
      "currentAssets": 500000,
      "currentLiabilities": 250000
    },
    "companyInfo": {
      "name": "ABC Corp",
      "period": 2024
    }
  }'
```

### Analyze Document
```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Company financials for FY2024...",
    "analysisType": "comprehensive"
  }'
```

### Upload File
```bash
curl -X POST http://localhost:3001/api/process-file \
  -F "file=@document.xlsx" \
  -F "format=cma" \
  -F "analyze=true"
```

## 🎯 Capabilities

### Financial Analysis
- Balance Sheet Analysis
- Income Statement Review
- Cash Flow Analysis
- Financial Ratio Analysis
- Working Capital Assessment

### Document Creation
- CMA Report Generation
- Balance Sheet Creation
- Income Statement Creation
- Financial Statement Formatting

### Document Transformation
- PDF → JSON/Excel/CMA
- Excel → CMA/Balance Sheet
- JSON → Excel/PDF
- CSV → CMA/Reports

### Risk Assessment
- Credit Risk Evaluation
- Financial Health Scoring
- Anomaly Detection
- Risk Factor Identification

### Forecasting
- Financial Projections
- Trend Analysis
- Growth Forecasting
- Scenario Planning

## 🔧 Configuration

### Environment Variables

Create `.env` file in project root:

```env
# API Configuration
PORT=3001
DASHBOARD_PORT=3000

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=50mb

# API Keys (if needed)
API_TIMEOUT=120000
```

### Model Selection

**Recommended Models:**

1. **Mistral** (Best balance)
   - Size: ~4GB
   - Speed: Fast
   - Accuracy: Excellent
   - Use: Default choice

2. **Neural Chat** (Lightweight)
   - Size: ~3GB
   - Speed: Very Fast
   - Accuracy: Good
   - Use: Limited resources

3. **Llama 2** (Powerful)
   - Size: ~7GB
   - Speed: Moderate
   - Accuracy: Excellent
   - Use: Complex analysis

4. **Dolphin Mixtral** (Advanced)
   - Size: ~26GB
   - Speed: Slower
   - Accuracy: Outstanding
   - Use: Enterprise deployments

## 🐛 Troubleshooting

### Ollama Connection Failed

**Issue:** "Ollama not detected"

**Solution:**
1. Ensure Ollama is running: `ollama serve`
2. Check connection: `curl http://localhost:11434/api/tags`
3. Verify firewall settings

### Model Not Found

**Issue:** "Model not available"

**Solution:**
```bash
# List available models
ollama list

# Pull missing model
ollama pull mistral
```

### Slow Response

**Issue:** API responses take too long

**Solution:**
1. Use smaller model: `ollama pull neural-chat`
2. Reduce token count in config
3. Check system resources (RAM, GPU)
4. Use GPU acceleration if available

### File Upload Failed

**Issue:** Upload endpoint returns error

**Solution:**
1. Check file format supported
2. Verify file size < 50MB
3. Check disk space in uploads directory
4. Ensure proper permissions

## 📈 Performance Tips

1. **Use GPU Acceleration** (if available)
   - Ollama automatically uses GPU when available
   - Significant speed improvement possible

2. **Model Selection**
   - Choose smallest model for speed
   - Larger models for accuracy

3. **Batch Processing**
   - Process multiple documents together
   - Reduces overhead

4. **Caching**
   - Store frequently used analyses
   - Reuse LLM responses

## 🔐 Security Considerations

1. **Local Only**
   - No data sent to external services
   - All processing happens locally

2. **API Security**
   - Add authentication for production use
   - Use HTTPS in production

3. **File Security**
   - Validate file types
   - Scan for malware
   - Implement access controls

## 📦 Project Structure

```
financial-ai-expert/
├── cli/                      # Command-line interface
│   └── index.js             # CLI commands and interactive mode
├── lib/                      # Core libraries
│   ├── ollama-client.js     # Ollama LLM connection
│   ├── financial-expert.js  # AI financial expert
│   └── document-parser.js   # Document parsing and transformation
├── server/                   # API and Dashboard
│   ├── api.js               # Express.js REST API
│   └── dashboard.js         # Dashboard web server
├── public/                   # Static files
│   └── dashboard.html       # Web dashboard UI
├── uploads/                  # File uploads directory
├── package.json             # Dependencies
├── README.md                # Documentation
└── .env                     # Configuration (optional)
```

## 🚀 Next Steps

1. **Install & Setup** - Follow quick start above
2. **Start Services** - Run API and Dashboard
3. **Test Capabilities** - Use dashboard to explore features
4. **Integrate** - Add to your applications via API
5. **Customize** - Modify prompts and add domain knowledge

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review Ollama documentation: https://ollama.ai
3. Check API logs for error messages
4. Verify all services are running

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Built with Ollama for local LLM
- Uses Express.js for API
- Powered by advanced financial knowledge base
- Open source and community-driven

---

**Created for:** Financial document analysis and transformation
**Status:** Production Ready
**Version:** 1.0.0
