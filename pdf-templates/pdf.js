import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @param {string} htmlFile - HTML template filename
 * @param {string} pdfFile  - Output PDF filename
 * @param {object} data     - Dynamic data (generatedDate)
 */
export async function generatePDF(htmlFile, pdfFile, data = {}) {
  const htmlPath = path.join(__dirname, htmlFile);
  const outDir = path.join(__dirname, "generated");
  const outPath = path.join(outDir, pdfFile);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1️⃣ Read HTML template
  let html = fs.readFileSync(htmlPath, "utf8");

  // 2️⃣ 🔥 REPLACE GENERATED DATE (THIS FIXES YOUR ISSUE)
  if (data.generatedDate) {
    html = html.replace(
      /{{GENERATED_DATE}}/g,
      data.generatedDate
    );
  }

  // 3️⃣ Launch Chromium (Render-safe)
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless
  });

  const page = await browser.newPage();

  // 4️⃣ Set HTML content
  await page.setContent(html, { waitUntil: "networkidle0" });

  // 5️⃣ Generate PDF
  await page.pdf({
    path: outPath,
    format: "A4",
    printBackground: true
  });

  await browser.close();
  return outPath;
}
