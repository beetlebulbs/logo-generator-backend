import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { COMPANY } from "./invoice.config.js";

const isProd = process.env.NODE_ENV === "production";

/* ===============================
   LAUNCH BROWSER (SAFE)
================================ */
async function launchBrowser() {
  if (isProd) {
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
  }

  return puppeteerCore.launch({
    headless: true
  });
}

/* =====================================================
   GENERATE INVOICE / PROFORMA PDF (BUFFER ONLY)
===================================================== */
export async function generateInvoicePDF(payload) {
  const {
    documentType,
    invoiceType,
    invoiceNo,
    invoiceDate,
    dueDate,
    client,
    items = [],
    totals
  } = payload;

  /* -------- SAFETY -------- */
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Invoice PDF Error: items missing");
  }

  const isIndia = invoiceType === "INDIA";
  const currency = isIndia ? "₹" : "$";

  /* -------- WATERMARK -------- */
  let watermarkText = `${COMPANY.name} Invoice`;

  if (documentType === "PROFORMA") {
    watermarkText = `${COMPANY.name} Proforma Invoice`;
  } else if (invoiceType === "INDIA") {
    watermarkText = `${COMPANY.name} Tax Invoice`;
  }

  const totalAmount = Number(totals.total).toFixed(2);
  const amountInWords = amountToWords(
    totals.total,
    isIndia ? "INR" : "USD"
  );

  /* -------- HTML -------- */
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
body {
  font-family: Arial, sans-serif;
  font-size: 12px;
  color: #111;
}
.watermark {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 46px;
  font-weight: bold;
  color: rgba(0,0,0,0.06);
  white-space: nowrap;
  pointer-events: none;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}
th, td {
  border: 1px solid #ccc;
  padding: 8px;
}
th {
  background: #f3f3f3;
}
.right { text-align: right; }
.center { text-align: center; }
.footer {
  font-size: 10px;
  margin-top: 20px;
  color: #555;
}
</style>
</head>

<body>

<div class="watermark">${watermarkText}</div>

<img src="https://www.beetlebulbs.com/logo1.png" style="max-width:180px; margin-bottom:10px;" />

<h2 style="text-align:center;">
${
  documentType === "PROFORMA"
    ? "PROFORMA INVOICE"
    : invoiceType === "INDIA"
      ? "TAX INVOICE"
      : "INVOICE"
}
</h2>

<p>
<strong>Invoice No:</strong> ${invoiceNo}<br/>
<strong>Invoice Date:</strong> ${invoiceDate}<br/>
${dueDate ? `<strong>Due Date:</strong> ${dueDate}<br/>` : ""}
</p>

<hr/>

<p>
<strong>Billed To:</strong><br/>
${client.name}<br/>
${client.address}<br/>
${client.state || ""}, ${client.country || ""} - ${client.zip || ""}<br/>
${client.email || ""}<br/>
${client.phone || ""}
</p>

<table>
<thead>
<tr>
<th>SL</th>
<th>Description</th>
<th>Qty</th>
<th>Rate</th>
<th>Amount</th>
</tr>
</thead>
<tbody>
${items.map((i, idx) => `
<tr>
<td class="center">${idx + 1}</td>
<td>${i.name}</td>
<td class="center">${i.qty}</td>
<td class="right">${currency}${Number(i.rate).toFixed(2)}</td>
<td class="right">${currency}${Number(i.amount).toFixed(2)}</td>
</tr>
`).join("")}
</tbody>
</table>

<table>
<tr>
<td class="right">Subtotal</td>
<td class="right">${currency}${Number(totals.subtotal).toFixed(2)}</td>
</tr>

${isIndia ? `
<tr>
<td class="right">CGST</td>
<td class="right">${currency}${Number(totals.cgst).toFixed(2)}</td>
</tr>
<tr>
<td class="right">SGST</td>
<td class="right">${currency}${Number(totals.sgst).toFixed(2)}</td>
</tr>
` : ""}

<tr>
<th class="right">TOTAL</th>
<th class="right">${currency}${totalAmount}</th>
</tr>
</table>

<p><strong>Amount in Words:</strong> ${amountInWords}</p>

<hr/>

<table width="100%">
<tr>
<td width="50%" valign="top">
<strong>Bank Details</strong><br/><br/>
Account Name: ${COMPANY.bank?.name || "BEETLEBULBS"}<br/>
Account No: ${COMPANY.bank?.account || "XXXXXXXXXX"}<br/>
IFSC: ${COMPANY.bank?.ifsc || "XXXXXXXX"}<br/>
Bank: ${COMPANY.bank?.bank || "HDFC BANK"}
</td>

<td width="50%" valign="top" style="text-align:right;">
<strong>Online Payment</strong><br/><br/>
Pay via Credit / Debit Card / UPI<br/><br/>
<a href="https://razorpay.me/@beetlebulbs" target="_blank">
https://razorpay.me/@beetlebulbs
</a>
</td>
</tr>
</table>

<div class="footer">
${isIndia
  ? "This is a computer-generated invoice under GST Act."
  : "This is a computer-generated invoice."
}
</div>

</body>
</html>
`;

  /* -------- PDF BUFFER -------- */
  const browser = await launchBrowser();
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.waitForSelector("img");

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true
  });

  await page.close();
  await browser.close();

  return pdfBuffer; // ✅ IMPORTANT
}

/* ===============================
   AMOUNT TO WORDS
================================ */
function amountToWords(amount, currency) {
  const number = Math.floor(Number(amount));
  return currency === "INR"
    ? `Rupees ${number} Only`
    : `USD ${number} Only`;
}
