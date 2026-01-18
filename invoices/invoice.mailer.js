import SibApiV3Sdk from "sib-api-v3-sdk";
import fs from "fs";
import path from "path";

/* =====================================================
   SEND INVOICE EMAIL — BREVO TRANSACTIONAL
===================================================== */

// Brevo client
const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

export async function sendInvoiceEmail({
  to,
  clientName,
  invoiceNo,
  pdfPath,
  total,
  documentType,
  invoiceType
}) {
  try {
    const currency = invoiceType === "GLOBAL" ? "$" : "₹";

    let attachment = [];

    if (pdfPath && fs.existsSync(pdfPath)) {
      const pdfBuffer = fs.readFileSync(path.resolve(pdfPath));
      attachment.push({
        content: pdfBuffer.toString("base64"),
        name: path.basename(pdfPath)
      });
    }

    await emailApi.sendTransacEmail({
      sender: {
        email: "accounts@beetlebulbs.com",
        name: "Beetlebulbs Accounts"
      },
      to: [{ email: to }],
      subject: `${
        documentType === "PROFORMA" ? "Proforma Invoice" : "Invoice"
      } ${invoiceNo} | Beetlebulbs`,
      htmlContent: `
        <p>Hello <strong>${clientName}</strong>,</p>

        <p>Please find attached your ${
          documentType === "PROFORMA" ? "Proforma Invoice" : "Invoice"
        }.</p>

        <p>
          <strong>Invoice No:</strong> ${invoiceNo}<br/>
          <strong>Total:</strong> ${currency}${Number(total).toFixed(2)}
        </p>

        <p>
          Regards,<br/>
          <strong>Beetlebulbs Accounts Team</strong><br/>
          <a href="https://www.beetlebulbs.com">www.beetlebulbs.com</a>
        </p>
      `,
      attachment
    });

    console.log("📧 Brevo invoice email sent to", to);

  } catch (err) {
    console.error("❌ BREVO EMAIL FAILED:", err.response?.body || err.message);
  }
}
