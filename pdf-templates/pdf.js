import fs from "fs";
import path from "path";
import { chromium } from "playwright-chromium";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generatePDF(htmlFile, pdfFile, data = {}) {
  const htmlPath = path.join(__dirname, htmlFile);
  const outDir = path.join(__dirname, "generated");
  const outPath = path.join(outDir, pdfFile);

  if (!fs.existsSync(htmlPath)) {
    throw new Error("HTML not found: " + htmlPath);
  }
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let html = fs.readFileSync(htmlPath, "utf8");

  if (data.generatedDate) {
    html = html.replaceAll("{{GENERATED_DATE}}", data.generatedDate);
  }

  const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage"
  ]
});

  const page = await browser.newPage({
    viewport: { width: 1240, height: 1754 }
  });

  await page.setContent(html, { waitUntil: "load" });

  await page.pdf({
    path: outPath,
    format: "A4",
    printBackground: true
  });

  await browser.close();

  return outPath;
}
