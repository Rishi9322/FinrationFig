// Document Parser & Transformer - Read and convert financial documents
import XLSX from 'xlsx';
import fs from 'fs';
import chalk from 'chalk';

export class DocumentParser {
  static async parseExcel(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const result = {};

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        result[sheetName] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      }

      console.log(chalk.green(`✅ Parsed Excel: ${Object.keys(result).length} sheets`));
      return result;
    } catch (error) {
      throw new Error(`Excel parsing error: ${error.message}`);
    }
  }

  static async parseJSON(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      console.log(chalk.green('✅ Parsed JSON'));
      return data;
    } catch (error) {
      throw new Error(`JSON parsing error: ${error.message}`);
    }
  }

  static async parseTXT(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      // Extract key-value pairs and structured data
      const data = {
        content: content,
        lines: lines,
        metrics: this.extractFinancialMetrics(content)
      };

      console.log(chalk.green('✅ Parsed TXT'));
      return data;
    } catch (error) {
      throw new Error(`TXT parsing error: ${error.message}`);
    }
  }

  static extractFinancialMetrics(text) {
    const metrics = {};
    // Simple regex patterns for common financial metrics
    const patterns = {
      revenue: /(?:revenue|sales|turnover)\s*:?\s*([\d,\.]+)/gi,
      profit: /(?:profit|earnings?|income)\s*:?\s*([\d,\.]+)/gi,
      assets: /(?:total assets|total liabilities)\s*:?\s*([\d,\.]+)/gi,
      equity: /(?:equity|net worth|capital)\s*:?\s*([\d,\.]+)/gi,
      debt: /(?:debt|borrowings|loans)\s*:?\s*([\d,\.]+)/gi,
      ratio: /(?:ratio)\s*:?\s*([\d\.]+)/gi
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const matches = text.matchAll(pattern);
      metrics[key] = Array.from(matches).map(m => parseFloat(m[1].replace(/,/g, '')));
    }

    return metrics;
  }

  static async parseCSV(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);
      console.log(chalk.green('✅ Parsed CSV'));
      return data;
    } catch (error) {
      throw new Error(`CSV parsing error: ${error.message}`);
    }
  }

  static async autoDetectAndParse(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();

    switch (ext) {
      case 'xlsx':
      case 'xls':
        return await this.parseExcel(filePath);
      case 'json':
        return await this.parseJSON(filePath);
      case 'csv':
        return await this.parseCSV(filePath);
      case 'txt':
        return await this.parseTXT(filePath);
      default:
        throw new Error(`Unsupported file format: .${ext}`);
    }
  }

  static async readPDFAsText(filePath) {
    // Note: Requires pdf-parse library
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdf = await import('pdf-parse/lib/pdf-parse.js');
      const data = await pdf(dataBuffer);
      console.log(chalk.green(`✅ Parsed PDF: ${data.numpages} pages`));
      return data.text;
    } catch (error) {
      throw new Error(`PDF parsing error: ${error.message}`);
    }
  }
}

export class DocumentTransformer {
  static toJSON(data, metadata = {}) {
    return {
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      },
      data: data
    };
  }

  static toCSV(data) {
    if (Array.isArray(data)) {
      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);
      return csv;
    }
    throw new Error('CSV conversion requires array data');
  }

  static toExcel(data, fileName = 'output.xlsx') {
    const wb = XLSX.utils.book_new();

    if (Array.isArray(data)) {
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    } else {
      for (const [sheetName, sheetData] of Object.entries(data)) {
        const ws = XLSX.utils.json_to_sheet(
          Array.isArray(sheetData) ? sheetData : [sheetData]
        );
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
      }
    }

    XLSX.writeFile(wb, fileName);
    console.log(chalk.green(`✅ Saved Excel: ${fileName}`));
    return fileName;
  }

  static toTXT(data, format = 'structured') {
    let txt = '';

    if (format === 'structured') {
      if (Array.isArray(data)) {
        txt = data
          .map((item, i) => {
            const lines = Object.entries(item)
              .map(([k, v]) => `  ${k}: ${v}`)
              .join('\n');
            return `Item ${i + 1}:\n${lines}`;
          })
          .join('\n\n');
      } else {
        txt = Object.entries(data)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join('\n');
      }
    } else if (format === 'json') {
      txt = JSON.stringify(data, null, 2);
    }

    return txt;
  }

  static toCMAFormat(data) {
    // Transform parsed data into CMA report structure
    return {
      cmaReport: {
        companyInfo: {
          name: data.companyName || 'Company Name',
          industry: data.industry || 'Unknown',
          period: data.period || new Date().getFullYear()
        },
        financialPosition: {
          currentAssets: data.currentAssets || 0,
          currentLiabilities: data.currentLiabilities || 0,
          totalAssets: data.totalAssets || 0,
          totalLiabilities: data.totalLiabilities || 0,
          equity: (data.totalAssets || 0) - (data.totalLiabilities || 0)
        },
        profitability: {
          netSales: data.netSales || 0,
          grossProfit: data.grossProfit || 0,
          netProfit: data.netProfit || 0,
          profitMargin: data.netProfit && data.netSales ? 
            ((data.netProfit / data.netSales) * 100).toFixed(2) : 0
        },
        keyRatios: {
          currentRatio: data.currentAssets && data.currentLiabilities ?
            (data.currentAssets / data.currentLiabilities).toFixed(2) : 0,
          debtToEquity: data.totalLiabilities && (data.totalAssets - data.totalLiabilities) ?
            (data.totalLiabilities / (data.totalAssets - data.totalLiabilities)).toFixed(2) : 0,
          interestCoverage: data.grossProfit && data.interestExpense ?
            (data.grossProfit / data.interestExpense).toFixed(2) : 0,
          dscr: data.grossProfit && data.debtService ?
            (data.grossProfit / data.debtService).toFixed(2) : 0
        },
        workingCapital: {
          workingCapital: (data.currentAssets || 0) - (data.currentLiabilities || 0),
          wcPercentage: data.netSales ?
            (((data.currentAssets || 0) - (data.currentLiabilities || 0)) / data.netSales * 100).toFixed(2) : 0
        }
      }
    };
  }

  static toBalanceSheet(data) {
    return {
      balanceSheet: {
        period: data.period || new Date().getFullYear(),
        assets: {
          currentAssets: {
            inventory: data.inventory || 0,
            receivables: data.receivables || 0,
            cash: data.cash || 0,
            others: data.otherCurrentAssets || 0,
            total: (data.inventory || 0) + (data.receivables || 0) + (data.cash || 0)
          },
          nonCurrentAssets: {
            fixedAssets: data.fixedAssets || 0,
            intangibles: data.intangibles || 0,
            others: data.otherNonCurrentAssets || 0,
            total: (data.fixedAssets || 0) + (data.intangibles || 0)
          },
          totalAssets: data.totalAssets || 0
        },
        liabilities: {
          currentLiabilities: {
            payables: data.payables || 0,
            shortTermDebt: data.shortTermDebt || 0,
            others: data.otherCurrentLiabilities || 0,
            total: (data.payables || 0) + (data.shortTermDebt || 0)
          },
          nonCurrentLiabilities: {
            longTermDebt: data.longTermDebt || 0,
            others: data.otherNonCurrentLiabilities || 0,
            total: (data.longTermDebt || 0)
          },
          totalLiabilities: data.totalLiabilities || 0
        },
        equity: {
          paidUpCapital: data.paidUpCapital || 0,
          reserves: data.reserves || 0,
          retainedEarnings: data.retainedEarnings || 0,
          total: (data.paidUpCapital || 0) + (data.reserves || 0)
        }
      }
    };
  }

  static toIncomeStatement(data) {
    return {
      incomeStatement: {
        period: data.period || new Date().getFullYear(),
        operations: {
          netSales: data.netSales || 0,
          costOfGoodsSold: data.cogs || 0,
          grossProfit: (data.netSales || 0) - (data.cogs || 0),
          operatingExpenses: data.operatingExpenses || 0,
          operatingProfit: ((data.netSales || 0) - (data.cogs || 0)) - (data.operatingExpenses || 0)
        },
        financing: {
          interestExpense: data.interestExpense || 0,
          otherIncome: data.otherIncome || 0,
          profitBeforeTax: (((data.netSales || 0) - (data.cogs || 0)) - (data.operatingExpenses || 0)) - (data.interestExpense || 0) + (data.otherIncome || 0)
        },
        taxes: {
          taxRate: data.taxRate || 0.30,
          taxProvision: 0
        },
        netProfit: data.netProfit || 0
      }
    };
  }
}

export default { DocumentParser, DocumentTransformer };
