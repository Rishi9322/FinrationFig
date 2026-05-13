# 💼 Financial AI Expert System

A complete local AI financial expert system that reads, creates, and transforms financial documents with zero external dependencies.

## ✨ Features

### 🤖 AI-Powered Financial Analysis
- **15+ Expertise Areas**: Balance sheets, ratios, working capital, credit analysis, and more
- **Local LLM**: Uses Ollama for private, fast processing (no internet required)
- **Professional Insights**: Bank-standard financial analysis and recommendations

### 📄 Document Processing
- **Multiple Formats**: Parse Excel, JSON, CSV, TXT, and PDF files
- **Format Transformation**: Convert between financial document types
- **Data Extraction**: Automatically extract financial metrics from documents

### 📋 Financial Reports
- **CMA Reports**: Professional Credit Monitoring Arrangement reports
- **Balance Sheets**: Complete balance sheet generation
- **Income Statements**: Full P&L statement creation
- **Financial Projections**: Forecast future financial performance

### 🎯 Financial Analysis
- **Ratio Analysis**: Current ratio, debt-to-equity, DSCR, and 8+ more
- **Credit Risk Assessment**: Evaluate creditworthiness automatically
- **Working Capital Analysis**: Optimize cash management
- **Variance Analysis**: Identify financial anomalies

### 🌐 Multiple Interfaces
- **REST API**: Integrate into any application
- **Web Dashboard**: Beautiful UI for analysis and transformation
- **CLI Tool**: Command-line interface for automation
- **Interactive Mode**: Interactive financial expert

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Ollama installed (https://ollama.ai)
- ~5GB free disk space (for models)

### Installation

```bash
# 1. Clone or navigate to project
cd financial-ai-expert

# 2. Install dependencies
npm install

# 3. Start Ollama (if not already running)
ollama serve

# 4. In another terminal, pull a model
ollama pull mistral

# 5. Start the system
npm start                # Start API server (port 3001)
npm run dashboard        # In another terminal: Start dashboard (port 3000)
```

**Then open:** http://localhost:3000

## 📚 Usage Examples

### Web Dashboard
1. Open http://localhost:3000
2. Upload financial documents
3. Choose transformation format
4. Generate reports and analysis
5. Download results

### REST API

```bash
# Create CMA Report
curl -X POST http://localhost:3001/api/create-cma \
  -H "Content-Type: application/json" \
  -d '{
    "financialData": {
      "netSales": 1000000,
      "grossProfit": 300000,
      "currentAssets": 500000,
      "currentLiabilities": 250000
    },
    "companyInfo": { "name": "ABC Corp" }
  }'

# Analyze Document
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Financial data...",
    "analysisType": "comprehensive"
  }'

# Process File
curl -X POST http://localhost:3001/api/process-file \
  -F "file=@data.xlsx" \
  -F "format=cma"
```

### CLI Tool

```bash
# Interactive mode
npm run cli -- interactive

# Create CMA from file
npm run cli -- create-cma -f data.json

# Analyze document
npm run cli -- analyze report.txt

# Transform format
npm run cli -- transform data.xlsx -f cma

# Check health
npm run cli -- health
```

### Programmatic Usage

```javascript
import FinancialExpert from './lib/financial-expert.js';
import { DocumentParser } from './lib/document-parser.js';

const expert = new FinancialExpert();
await expert.initialize();

// Parse document
const data = await DocumentParser.autoDetectAndParse('report.xlsx');

// Create analysis
const report = await expert.createCMAReport(data, {
  name: 'Company Inc',
  period: 2024
});

console.log(report);
```

## 🏗️ Architecture

### Core Components

```
Financial AI Expert
├── Ollama LLM Client
│   ├── Chat Interface
│   ├── Stream Processing
│   └── Model Management
├── Financial Expert Engine
│   ├── System Prompts (15+ expertise areas)
│   ├── Analysis Modules
│   ├── Ratio Calculations
│   └── Risk Assessment
├── Document Processing
│   ├── Parser (5+ formats)
│   ├── Transformer (6 output formats)
│   └── Metric Extractor
└── User Interfaces
    ├── REST API (11 endpoints)
    ├── Web Dashboard
    ├── CLI Tool
    └── Interactive Mode
```

### Data Flow

```
Input Document
    ↓
Parse & Extract
    ↓
AI Analysis
    ↓
Financial Processing
    ↓
Format Transformation
    ↓
Output Report
```

## 📊 API Endpoints

### Health & Configuration
- `GET /api/health` - System status
- `GET /api/capabilities` - Expert capabilities
- `GET /api/models` - Available LLM models
- `POST /api/set-model` - Switch LLM model

### Report Generation
- `POST /api/create-cma` - Generate CMA report
- `POST /api/create-projections` - Financial forecasts

### Document Processing
- `POST /api/analyze` - Analyze document
- `POST /api/transform` - Transform format
- `POST /api/process-file` - Upload and process

### Analysis
- `POST /api/assess-credit` - Credit risk assessment

### Utilities
- `POST /api/convert` - Format conversion

## 🎓 Financial Expertise

### Analysis Capabilities
- **Balance Sheet Analysis** - Assets, liabilities, equity structure
- **Income Statement Analysis** - Revenue, costs, profitability trends
- **Cash Flow Analysis** - Liquidity and operational efficiency
- **Financial Ratios** - 11+ standard financial ratios
- **Working Capital** - Inventory, receivables, payables optimization
- **Credit Analysis** - Creditworthiness and lending decisions
- **Trend Analysis** - Year-over-year and multi-year trends
- **Risk Assessment** - Financial health scoring and red flags
- **Projections** - 3-5 year financial forecasts
- **Compliance** - RBI guidelines, banking norms, accounting standards

### Supported Industries
- Manufacturing
- Trading & Distribution
- Services
- Retail
- Professional Services

### Financial Metrics
- Current Ratio & Quick Ratio
- Debt-to-Equity Ratio
- Debt Service Coverage Ratio (DSCR)
- Interest Coverage Ratio
- Return on Assets (ROA)
- Return on Equity (ROE)
- Profit Margin
- Asset Turnover
- Working Capital Cycle
- Age of Inventory
- Days Sales Outstanding (DSO)
- Cash Conversion Cycle

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
PORT=3001
DASHBOARD_PORT=3000

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# File Upload
MAX_FILE_SIZE=50mb
UPLOAD_DIR=./uploads

# API Configuration
API_TIMEOUT=120000
NODE_ENV=development
```

### Model Selection

**Recommended for Financial Analysis:**

1. **Mistral** (Default)
   - Good balance of speed and accuracy
   - ~4GB

2. **Neural Chat**
   - Lightweight, fastest
   - ~3GB

3. **Llama 2**
   - Powerful, comprehensive
   - ~7GB

4. **Dolphin Mixtral**
   - Most accurate but slowest
   - ~26GB

## 🐛 Troubleshooting

### Ollama Connection Failed
```bash
# Start Ollama
ollama serve

# Verify connection
curl http://localhost:11434/api/tags
```

### Model Not Found
```bash
# List models
ollama list

# Pull model
ollama pull mistral
```

### API Port Already in Use
```bash
# Use different port
PORT=3002 npm start
```

### Dashboard Won't Connect to API
- Ensure API server is running on http://localhost:3001
- Check firewall/CORS settings
- Verify browser console for errors

## 📈 Performance

### System Requirements

**Minimum:**
- 4GB RAM
- 10GB free disk space
- Dual-core processor

**Recommended:**
- 8GB+ RAM
- 20GB free disk space
- GPU support (NVIDIA/AMD)
- High-speed internet (for model download)

### Speed Optimization

- Smaller models = faster responses
- GPU acceleration = 5-10x speed boost
- Batch processing saves overhead
- Local operation = no network latency

## 🔐 Security

- **100% Local**: No data leaves your system
- **No APIs**: No external service dependencies
- **No Tracking**: Complete privacy
- **Open Source**: Audit the code yourself

## 📦 Project Structure

```
financial-ai-expert/
├── cli/                          # CLI Tool
│   └── index.js                 # Commands and interactive mode
├── lib/                          # Core Libraries
│   ├── ollama-client.js         # LLM Connection
│   ├── financial-expert.js      # AI Expert Engine
│   └── document-parser.js       # Document Processing
├── server/                       # Backend Services
│   ├── api.js                   # REST API Server
│   └── dashboard.js             # Dashboard Server
├── public/                       # Frontend
│   └── dashboard.html           # Web Dashboard UI
├── uploads/                      # File Upload Directory
├── package.json                 # Dependencies
├── SETUP_GUIDE.md              # Detailed Setup
├── README.md                    # This File
└── .env.example                 # Config Template
```

## 🚀 Deployment

### Local Development
```bash
npm start           # Start API
npm run dashboard   # Start Dashboard
```

### Production (Docker)
```dockerfile
FROM node:18-slim
WORKDIR /app
COPY . .
RUN npm install --production
EXPOSE 3001 3000
CMD ["npm", "start"]
```

### Linux Server
```bash
npm install
npm start &        # Run API in background
npm run dashboard &  # Run Dashboard in background
```

## 🤝 Contributing

To extend the system:

1. **Add Financial Modules**: Extend `FinancialExpert` class
2. **Add Document Parsers**: Extend `DocumentParser` class
3. **Add Analysis Types**: Update system prompts in `financial-expert.js`
4. **Add API Endpoints**: Extend `server/api.js`

## 📚 Learning Resources

- [Ollama Documentation](https://ollama.ai)
- [Financial Analysis Basics](https://www.investopedia.com)
- [Banking Norms](https://www.rbi.org.in)
- [Express.js Guide](https://expressjs.com)

## 📄 License

MIT License - Feel free to use commercially

## 🙏 Support

- Check SETUP_GUIDE.md for detailed setup
- Review API documentation in README
- Check console logs for error messages
- Verify Ollama is running and accessible

## 🎯 Future Enhancements

- [ ] Multi-language support
- [ ] Advanced visualization
- [ ] Database integration
- [ ] User authentication
- [ ] Audit logging
- [ ] Mobile app
- [ ] Custom model training
- [ ] Export to PDF/Word
- [ ] Collaboration features
- [ ] Historical tracking

## 📞 Contact

For issues, questions, or suggestions:
1. Review troubleshooting section
2. Check existing documentation
3. Verify system setup is complete
4. Test with sample data first

---

**Status:** Production Ready ✅
**Version:** 1.0.0
**Last Updated:** 2024
**Ollama Required:** Yes (Local LLM)

