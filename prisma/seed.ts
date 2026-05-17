import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const calculators = [
  {
    slug: 'debt-equity',
    name: 'Debt to Equity Ratio',
    description: 'Calculate the debt to equity ratio for financial analysis',
    category: 'FINANCIAL',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  },
  {
    slug: 'quasi-debt-equity',
    name: 'Quasi Debt to Equity',
    description: 'Calculate quasi debt to equity ratio',
    category: 'FINANCIAL',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  },
  {
    slug: 'current-ratio',
    name: 'Current Ratio',
    description: 'Calculate current ratio for liquidity analysis',
    category: 'FINANCIAL',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  },
  {
    slug: 'dscr',
    name: 'Debt Service Coverage Ratio',
    description: 'Calculate DSCR for loan servicing capacity',
    category: 'FINANCIAL',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  },
  {
    slug: 'ebitda',
    name: 'EBITDA',
    description: 'Calculate EBITDA for profitability analysis',
    category: 'FINANCIAL',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  },
  {
    slug: 'iscr',
    name: 'Interest Service Coverage Ratio',
    description: 'Calculate ISCR for interest coverage',
    category: 'FINANCIAL',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  },
  {
    slug: 'net-working-capital',
    name: 'Net Working Capital',
    description: 'Calculate net working capital',
    category: 'FINANCIAL',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  },
  {
    slug: 'drawing-power',
    name: 'Drawing Power',
    description: 'Calculate maximum drawing power',
    category: 'FINANCIAL',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  },
  {
    slug: 'ageing',
    name: 'Ageing Analysis',
    description: 'Perform ageing analysis on receivables',
    category: 'ANALYSIS',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  },
  {
    slug: 'pid',
    name: 'PID Analysis',
    description: 'Calculate Profitability, Investment, and Distribution',
    category: 'ANALYSIS',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  },
  {
    slug: 'valuation',
    name: 'Business Valuation',
    description: 'Calculate business valuation metrics',
    category: 'VALUATION',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  },
  {
    slug: 'working-capital-cycle',
    name: 'Working Capital Cycle',
    description: 'Calculate working capital cycle',
    category: 'ANALYSIS',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  },
  {
    slug: 'cma-generator',
    name: 'CMA Generator',
    description: 'Generate Cooperative Management Account',
    category: 'GENERAL',
    enabled: true,
    isPublic: true,
    version: '1.0.0'
  }
];

async function main() {
  console.log('Seeding calculators...');

  for (const calc of calculators) {
    try {
      const existing = await prisma.calculatorFeature.findUnique({
        where: { slug: calc.slug }
      });

      if (!existing) {
        await prisma.calculatorFeature.create({
          data: calc
        });
        console.log(`✓ Created ${calc.name}`);
      } else {
        await prisma.calculatorFeature.update({
          where: { slug: calc.slug },
          data: {
            ...calc,
            enabled: true,
            isPublic: true
          }
        });
        console.log(`✓ Updated ${calc.name}`);
      }
    } catch (error) {
      console.error(`✗ Failed to seed ${calc.name}:`, error);
    }
  }

  console.log('✓ Seeding complete!');
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
