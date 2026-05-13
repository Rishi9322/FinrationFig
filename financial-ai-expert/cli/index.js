#!/usr/bin/env node

// CLI Interface - Command Line Tool for Financial Expert
import chalk from 'chalk';
import inquirer from 'inquirer';
import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import FinancialExpert from '../lib/financial-expert.js';
import { DocumentParser, DocumentTransformer } from '../lib/document-parser.js';

const expert = new FinancialExpert();
let initialized = false;

async function init() {
  if (!initialized) {
    console.log(chalk.blue('🚀 Initializing Financial AI Expert...'));
    await expert.initialize();
    initialized = true;
  }
}

// Create CMA Report Command
program
  .command('create-cma')
  .description('Create a CMA Report from financial data')
  .option('-f, --file <path>', 'Path to financial data file (JSON/Excel)')
  .option('-n, --name <company>', 'Company name')
  .option('-p, --period <year>', 'Financial period')
  .action(async (options) => {
    await init();
    try {
      let data = {};
      if (options.file) {
        if (!fs.existsSync(options.file)) {
          console.error(chalk.red('❌ File not found:', options.file));
          process.exit(1);
        }
        data = await DocumentParser.autoDetectAndParse(options.file);
      } else {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'revenue',
            message: 'Net Revenue:',
            default: 1000000
          },
          {
            type: 'input',
            name: 'profit',
            message: 'Net Profit:',
            default: 100000
          },
          {
            type: 'input',
            name: 'assets',
            message: 'Total Assets:',
            default: 5000000
          },
          {
            type: 'input',
            name: 'liabilities',
            message: 'Total Liabilities:',
            default: 2000000
          }
        ]);
        Object.keys(answers).forEach(key => {
          data[key] = parseFloat(answers[key]);
        });
      }

      const companyInfo = {
        name: options.name || 'Financial Report',
        period: options.period || new Date().getFullYear()
      };

      const report = await expert.createCMAReport(data, companyInfo);
      
      const outputFile = `cma-report-${Date.now()}.txt`;
      fs.writeFileSync(outputFile, report);
      console.log(chalk.green(`\n✅ CMA Report created: ${outputFile}`));
      console.log(chalk.cyan('\n' + report));
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

// Analyze Document Command
program
  .command('analyze')
  .description('Analyze a financial document')
  .argument('<file>', 'Path to document file')
  .option('-t, --type <type>', 'Analysis type (financial, legal, technical)', 'financial')
  .action(async (filePath, options) => {
    await init();
    try {
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red('❌ File not found:', filePath));
        process.exit(1);
      }

      let content;
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.txt') {
        content = fs.readFileSync(filePath, 'utf8');
      } else if (['.json', '.xlsx', '.xls', '.csv'].includes(ext)) {
        const data = await DocumentParser.autoDetectAndParse(filePath);
        content = JSON.stringify(data, null, 2);
      } else {
        console.error(chalk.red('❌ Unsupported file format'));
        process.exit(1);
      }

      console.log(chalk.blue(`\n🔍 Analyzing document... (${options.type} analysis)`));
      const analysis = await expert.analyzeDocument(content, options.type);
      
      const outputFile = `analysis-${Date.now()}.txt`;
      fs.writeFileSync(outputFile, analysis);
      console.log(chalk.green(`✅ Analysis saved: ${outputFile}`));
      console.log(chalk.cyan('\n' + analysis));
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

// Transform Document Command
program
  .command('transform')
  .description('Transform document to different formats')
  .argument('<file>', 'Path to source file')
  .option('-f, --format <format>', 'Target format (cma, balancesheet, incomestatement, json, csv, excel)', 'json')
  .option('-o, --output <path>', 'Output file path')
  .action(async (filePath, options) => {
    await init();
    try {
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red('❌ File not found:', filePath));
        process.exit(1);
      }

      console.log(chalk.blue(`\n🔄 Transforming to ${options.format}...`));
      
      const data = await DocumentParser.autoDetectAndParse(filePath);
      let transformed = data;

      if (options.format === 'cma') {
        transformed = DocumentTransformer.toCMAFormat(data);
      } else if (options.format === 'balancesheet') {
        transformed = DocumentTransformer.toBalanceSheet(data);
      } else if (options.format === 'incomestatement') {
        transformed = DocumentTransformer.toIncomeStatement(data);
      }

      let outputFile = options.output || `transformed_${Date.now()}`;
      let fileContent;

      if (options.format === 'excel') {
        if (!outputFile.endsWith('.xlsx')) outputFile += '.xlsx';
        DocumentTransformer.toExcel(transformed, outputFile);
      } else if (options.format === 'csv') {
        if (!outputFile.endsWith('.csv')) outputFile += '.csv';
        fileContent = DocumentTransformer.toCSV(transformed);
        fs.writeFileSync(outputFile, fileContent);
      } else {
        if (!outputFile.endsWith('.json')) outputFile += '.json';
        fileContent = JSON.stringify(transformed, null, 2);
        fs.writeFileSync(outputFile, fileContent);
      }

      console.log(chalk.green(`✅ Transformed file saved: ${outputFile}`));
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

// Interactive Mode
program
  .command('interactive')
  .description('Start interactive mode')
  .action(async () => {
    await init();
    
    console.log(chalk.cyan('\n╔════════════════════════════════════════╗'));
    console.log(chalk.cyan('║   Financial AI Expert - Interactive   ║'));
    console.log(chalk.cyan('╚════════════════════════════════════════╝\n'));

    let running = true;
    while (running) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📝 Create CMA Report', value: 'cma' },
            { name: '🔍 Analyze Document', value: 'analyze' },
            { name: '🔄 Transform Document', value: 'transform' },
            { name: '📊 Create Projections', value: 'projections' },
            { name: '⚠️  Assess Credit Risk', value: 'credit' },
            { name: '❓ Show Capabilities', value: 'capabilities' },
            { name: '🚪 Exit', value: 'exit' }
          ]
        }
      ]);

      try {
        switch (action) {
          case 'cma':
            const { dataFile } = await inquirer.prompt([
              {
                type: 'input',
                name: 'dataFile',
                message: 'Path to financial data file (or press Enter to enter data manually):'
              }
            ]);
            if (dataFile && fs.existsSync(dataFile)) {
              const data = await DocumentParser.autoDetectAndParse(dataFile);
              const report = await expert.createCMAReport(data);
              console.log(chalk.green('\n' + report + '\n'));
            }
            break;

          case 'analyze':
            const { analyzeFile } = await inquirer.prompt([
              {
                type: 'input',
                name: 'analyzeFile',
                message: 'Path to document file:'
              }
            ]);
            if (fs.existsSync(analyzeFile)) {
              const content = fs.readFileSync(analyzeFile, 'utf8');
              const analysis = await expert.analyzeDocument(content);
              console.log(chalk.green('\n' + analysis + '\n'));
            }
            break;

          case 'capabilities':
            const caps = expert.getCapabilities();
            console.log(chalk.cyan('\n📚 Expert Capabilities:'));
            console.log(chalk.gray('Expertise Areas: ' + caps.expertise.join(', ')));
            console.log(chalk.gray('Capabilities: ' + caps.capabilities.join(', ')));
            console.log();
            break;

          case 'exit':
            running = false;
            console.log(chalk.blue('\n👋 Thank you for using Financial AI Expert!\n'));
            break;
        }
      } catch (error) {
        console.error(chalk.red('❌ Error:', error.message));
      }
    }
  });

// Health Check Command
program
  .command('health')
  .description('Check system health')
  .action(async () => {
    await init();
    const health = await expert.healthCheck();
    console.log(chalk.cyan('\n📊 System Health:\n'));
    console.log(chalk.gray(`Status: ${health.status}`));
    console.log(chalk.gray(`Connected: ${health.connected ? '✅ Yes' : '❌ No'}`));
    console.log(chalk.gray(`Model: ${health.model}`));
    console.log(chalk.gray(`Capabilities: ${health.capabilities}`));
    console.log();
  });

// Setup Command
program
  .command('setup')
  .description('Setup and configuration')
  .action(async () => {
    console.log(chalk.cyan('\n🔧 Financial AI Expert Setup\n'));
    console.log(chalk.yellow('Required Setup Steps:\n'));
    
    console.log(chalk.white('1. Install Ollama:'));
    console.log(chalk.gray('   - Visit: https://ollama.ai/download'));
    console.log(chalk.gray('   - Download and install for your OS\n'));
    
    console.log(chalk.white('2. Start Ollama:'));
    console.log(chalk.gray('   - Run: ollama serve\n'));
    
    console.log(chalk.white('3. Pull a Model:'));
    console.log(chalk.gray('   - Run: ollama pull mistral'));
    console.log(chalk.gray('   - Or: ollama pull neural-chat\n'));
    
    console.log(chalk.white('4. Verify Installation:'));
    console.log(chalk.gray('   - Run: financial-expert-cli health\n'));
    
    console.log(chalk.green('✅ Setup complete! You can now use all commands.\n'));
  });

// Version and Help
program.version('1.0.0', '-v, --version', 'Show version');
program.on('--help', () => {
  console.log('\n' + chalk.cyan('Examples:') + '\n');
  console.log(chalk.gray('  $ financial-expert-cli create-cma -f data.json -n "Company Inc"'));
  console.log(chalk.gray('  $ financial-expert-cli analyze document.txt'));
  console.log(chalk.gray('  $ financial-expert-cli transform data.xlsx -f cma -o output.json'));
  console.log(chalk.gray('  $ financial-expert-cli interactive'));
  console.log(chalk.gray('  $ financial-expert-cli setup\n'));
});

// Parse and execute
program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
