import SibApiV3Sdk from "sib-api-v3-sdk";
import fs from "fs";
import path from "path";

/* =====================================================
   SEND INVOICE EMAIL (BREVO – SAFE & PRODUCTION READY)
===================================================== */

// Brevo setup
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
    /* ===============================
       CURRENCY LOGIC
    =============================== */
    const currencySymbol = invoiceType === "GLOBAL" ? "$" : "₹";

    /* ===============================
       ATTACHMENT (SAFE)
    =============================== */
    let attachment = [];

    if (pdfPath && typeof pdfPath === "string") {
      const pdfBuffer = fs.readFileSync(path.resolve(pdfPath));
      attachment.push({
        content: pdfBuffer.toString("base64"),
        name: path.basename(pdfPath)
      });
    }

    /* ===============================
       SEND EMAIL (BREVO)
    =============================== */
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

        <p>
          Please find attached your ${
            documentType === "PROFORMA" ? "Proforma Invoice" : "Invoice"
          }.
        </p>

        <p>
          <strong>Invoice No:</strong> ${invoiceNo}<br/>
          <strong>Total:</strong> ${currencySymbol}${Number(total).toFixed(2)}
        </p>

        <br/>

        <p>
          Regards,<br/>
          <strong>Beetlebulbs Accounts Team</strong><br/>
          <a href="https://www.beetlebulbs.com" target="_blank">
            www.beetlebulbs.com
          </a>
        </p>
      `,
      attachment
    });

    console.log("📧 Invoice email sent successfully to", to);

  } catch (err) {
    // ❗ Invoice creation must never fail because of email
    console.error("📧 Invoice Email Error (ignored):", err.message);
  }
}
