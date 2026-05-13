// Dashboard Server - Serve the web dashboard
import express from 'express';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'dashboard running', timestamp: new Date().toISOString() });
});

// Start Server
app.listen(PORT, () => {
  console.log(chalk.green(`\n✅ Dashboard running on http://localhost:${PORT}`));
  console.log(chalk.blue('📊 Open in browser: http://localhost:3000'));
  console.log(chalk.gray('Make sure API server is running on http://localhost:3001\n'));
});

export default app;
