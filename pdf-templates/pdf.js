import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generatePDF(htmlFile, pdfFile) {
  const htmlPath = path.join(__dirname, htmlFile);
  const outDir = path.join(__dirname, "generated");
  const outPath = path.join(outDir, pdfFile);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const html = fs.readFileSync(htmlPath, "utf8");

  const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: chromium.defaultViewport,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless
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
