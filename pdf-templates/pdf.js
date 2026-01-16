import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generatePDF(htmlFile, pdfFile, data = {}) {
  const htmlPath = path.join(__dirname, htmlFile);
  const outDir = path.join(__dirname, "generated");
  const outPath = path.join(outDir, pdfFile);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const html = fs.readFileSync(htmlPath, "utf8");

 const browser = await puppeteer.launch({
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage"
  ]
});

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  await page.pdf({
    path: outPath,
    format: "A4",
    printBackground: true
  });

  await browser.close();
  return outPath;
}
