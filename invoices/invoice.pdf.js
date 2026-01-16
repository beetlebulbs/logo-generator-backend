import fs from "fs";
import path from "path";
import { chromium } from "playwright-chromium";
import { COMPANY } from "./invoice.config.js";

/* =====================================================
   GENERATE INVOICE / PROFORMA PDF
===================================================== */
const LOGO_PATH = path.resolve("uploads/logo.png");
export async function generateInvoicePDF(payload) {
  const {
    documentType,
    invoiceType,
    invoiceNo,
    invoiceDate,
    client,
    items = [],
    totals,
    dueDate
  } = payload;

  /* -------- SAFETY CHECK -------- */
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Invoice PDF Error: items missing");
  }

  /* -------- SOURCE OF TRUTH -------- */
  const isIndia = invoiceType === "INDIA";
  const currency = isIndia ? "₹" : "$";

  /* -------- NORMALISED INVOICE -------- */
  const invoice = {
    invoice_no: invoiceNo,
    document_type: documentType,
    invoice_date: invoiceDate,
    due_date: documentType === "PROFORMA" ? dueDate : null,

    client_name: client.name,
    client_email: client.email,
    client_phone: client.phone,
    client_address: client.address,
    client_state: client.state,
    client_country: isIndia ? "India" : client.country,
    client_zip: client.zip,
    client_gstin: client.gstin || null,

    subtotal: totals.subtotal,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst || 0,
    total: totals.total
  };

  const totalAmount = Number(invoice.total).toFixed(2);

  const amountInWords = amountToWords(
    invoice.total,
    isIndia ? "INR" : "USD"
  );

  /* -------- HTML TEMPLATE -------- */
  const logoBase64 = fs.existsSync(LOGO_PATH)
  ? fs.readFileSync(LOGO_PATH).toString("base64")
  : "";

const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
h1 { font-size: 22px; margin-bottom: 15px; text-align:center; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
th, td { border: 1px solid #ccc; padding: 8px; }
th { background: #f3f3f3; }
.right { text-align: right; }
.center { text-align: center; }
.watermark {
  position: fixed;
  top: 35%;
  left: 15%;
  font-size: 80px;
  color: rgba(0,0,0,0.05);
  transform: rotate(-30deg);
}
.footer {
  font-size: 10px;
  margin-top: 20px;
  color: #555;
}
</style>
</head>

<body>

<div class="watermark">${COMPANY.name}</div>

<h1 style="text-align:center; margin-bottom:15px;">
${
  invoice.document_type === "PROFORMA"
    ? "PROFORMA INVOICE"
    : invoiceType === "GLOBAL"
      ? "INVOICE"
      : "TAX INVOICE"
}
</h1>

<table>
<tr>
<td style="vertical-align:top; max-width:280px;">
<img src="data:image/png;base64,${logoBase64}"
     style="height:20px; margin-bottom:1px;" /><br/>
208-A/9 F/F FLAT NO-2,<br/>
KH NO. 548/135, Savitri Nagar,<br/>
Sheikh Sarai Village, South Delhi – 110017 India<br/>
Email: ${COMPANY.email}<br/>
${COMPANY.gstin ? `GSTIN: ${COMPANY.gstin}` : ""}
</td>

<td class="right" style="vertical-align:top;">
Invoice No: <strong>${invoice.invoice_no}</strong><br/>
Invoice Date: ${invoice.invoice_date}<br/>
${invoice.due_date ? `Due Date: ${invoice.due_date}<br/>` : ""}
</td>
</tr>
</table>

<br/>
<div style="margin-left: 10px; margin-top: 1px;">
<strong>Billed To:</strong><br/>
${invoice.client_name}<br/>
${invoice.client_address}<br/>
${invoice.client_zip || ""}
${[invoice.client_state, invoice.client_country].filter(Boolean).join(", ")}<br/>
${invoice.client_phone ? `Phone: ${invoice.client_phone}<br/>` : ""}
${invoice.client_email ? `Email: ${invoice.client_email}<br/>` : ""}
${invoice.client_gstin ? `GSTIN: ${invoice.client_gstin}` : ""}
</div>
<table>
<thead>
<tr>
<th>SL No.</th>
<th>Service Description</th>
<th>SAC</th>
<th>Qty</th>
<th>Rate</th>
<th>Amount</th>
</tr>
</thead>
<tbody>
${items.map((i, idx) => `
<tr>
<td class="center">${idx + 1}</td>
<td>
<strong>${i.name || i.service_name}</strong><br/>
<small>${i.description || ""}</small>
</td>
<td class="center">${i.sac || "-"}</td>
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
<td class="right">${currency}${Number(invoice.subtotal).toFixed(2)}</td>
</tr>

${isIndia ? `
<tr>
<td class="right">CGST (9%)</td>
<td class="right">${currency}${Number(invoice.cgst).toFixed(2)}</td>
</tr>
<tr>
<td class="right">SGST (9%)</td>
<td class="right">${currency}${Number(invoice.sgst).toFixed(2)}</td>
</tr>
` : ""}

<tr>
<th class="right">TOTAL</th>
<th class="right">${currency}${totalAmount}</th>
</tr>
</table>

<p><strong>Amount in Words:</strong> ${amountInWords}</p>

<hr/>

<strong>Bank Details</strong><br/>
Account Name: ${COMPANY.bank?.name || "BEETLEBULBS"}<br/>
Account No: ${COMPANY.bank?.account || "50200108796363"}<br/>
IFSC: ${COMPANY.bank?.ifsc || "HDFC0001360"}<br/>
Bank: ${COMPANY.bank?.bank || "HDFC BANK"}

<br/><br/>

<strong>For ${COMPANY.name}</strong><br/><br/>
Authorised Signatory

<div class="footer">
${isIndia
  ? "This is a computer-generated invoice under GST Act. No signature required."
  : "This is a computer-generated invoice."
}
</div>

</body>
</html>
`;

  /* -------- FILE WRITE -------- */
  const baseDir = path.join("uploads", "invoices");
  fs.mkdirSync(baseDir, { recursive: true });

  const fileName = `${invoice.invoice_no.replace(/\//g, "-")}.pdf`;
  const filePath = path.join(baseDir, fileName);

  const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"]
});
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({ path: filePath, format: "A4" });
  await browser.close();

  return filePath;
}

/* ===============================
   AMOUNT TO WORDS
================================ */
function amountToWords(amount, currency) {
  const number = Math.floor(Number(amount));

  if (currency === "INR") {
    return `Rupees ${numberToIndianWords(number)} Only`;
  }

  return `USD ${numberToEnglishWords(number)} Only`;
}
function numberToIndianWords(num) {
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six",
    "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];

  const b = [
    "", "", "Twenty", "Thirty", "Forty",
    "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  if (num === 0) return "Zero";

  let str = "";

  if (Math.floor(num / 100000) > 0) {
    str += numberToIndianWords(Math.floor(num / 100000)) + " Lakh ";
    num %= 100000;
  }

  if (Math.floor(num / 1000) > 0) {
    str += numberToIndianWords(Math.floor(num / 1000)) + " Thousand ";
    num %= 1000;
  }

  if (Math.floor(num / 100) > 0) {
    str += numberToIndianWords(Math.floor(num / 100)) + " Hundred ";
    num %= 100;
  }

  if (num > 0) {
    if (str !== "") str += "";
    if (num < 20) {
      str += a[num];
    } else {
      str += b[Math.floor(num / 10)] + " " + a[num % 10];
    }
  }

  return str.trim();
}

function numberToEnglishWords(num) {
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six",
    "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];

  const b = [
    "", "", "Twenty", "Thirty", "Forty",
    "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  if (num === 0) return "Zero";

  let str = "";

  if (Math.floor(num / 1000000) > 0) {
    str += numberToEnglishWords(Math.floor(num / 1000000)) + " Million ";
    num %= 1000000;
  }

  if (Math.floor(num / 1000) > 0) {
    str += numberToEnglishWords(Math.floor(num / 1000)) + " Thousand ";
    num %= 1000;
  }

  if (Math.floor(num / 100) > 0) {
    str += numberToEnglishWords(Math.floor(num / 100)) + " Hundred ";
    num %= 100;
  }

  if (num > 0) {
    if (num < 20) {
      str += a[num];
    } else {
      str += b[Math.floor(num / 10)] + " " + a[num % 10];
    }
  }

  return str.trim();
}
