import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/test-pdf');
  
  // Wait for the file input to be available
  await page.waitForSelector('#pdf-upload');
  
  // Find a PDF in the project
  const pdfPath = path.resolve('./teest/Spar AY 26-27 Provisional 08.05.2026.pdf');
  
  // Upload the file
  const inputUploadHandle = await page.$('#pdf-upload');
  await inputUploadHandle.uploadFile(pdfPath);
  
  // Wait for result to change
  await new Promise(r => setTimeout(r, 5000));
  
  const resultText = await page.evaluate(() => document.getElementById('result').innerText);
  console.log('Test Result:\n' + resultText);
  
  await browser.close();
})();
