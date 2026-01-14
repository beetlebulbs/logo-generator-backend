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

  if (!fs.existsSync(htmlPath)) {
    throw new Error("HTML not found: " + htmlPath);
  }
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 🔥 READ HTML
  let html = fs.readFileSync(htmlPath, "utf8");

  // ✅ Inject dynamic date
  if (data.generatedDate) {
    html = html.replaceAll("{{GENERATED_DATE}}", data.generatedDate);
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  // 🔑 Force viewport
  await page.setViewport({ width: 1240, height: 1754 });

  await page.addStyleTag({
    content: `body { background: #fff; }`
  });

  // 🔑 Load HTML
  await page.setContent(html, {
    waitUntil: "domcontentloaded"
  });

  // 🔥 Wait for logo
  await page.waitForSelector("img", { timeout: 5000 });

  // 🔑 Generate PDF
  await page.pdf({
    path: outPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true
  });

  await browser.close();
}
