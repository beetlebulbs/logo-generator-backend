import nodemailer from "nodemailer";
import path from "path";

/* =====================================================
   SEND INVOICE EMAIL (SAFE & PRODUCTION READY)
===================================================== */
export async function sendInvoiceEmail({
  to,
  clientName,
  invoiceNo,
  pdfPath,
  total,
  documentType,
  invoiceType   // ✅ ADDED (ONLY NEW THING)
}) {
  try {
    /* ===============================
       TRANSPORTER
    =============================== */
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    /* ===============================
       CURRENCY LOGIC (SAFE)
    =============================== */
    const currencySymbol = invoiceType === "GLOBAL" ? "$" : "₹";

    /* ===============================
       SAFE ATTACHMENT
    =============================== */
    const attachments = [];

    if (pdfPath && typeof pdfPath === "string") {
      attachments.push({
        filename: path.basename(pdfPath),
        path: path.resolve(pdfPath)
      });
    }

    /* ===============================
       SEND MAIL
    =============================== */
    await transporter.sendMail({
      from:
        process.env.SMTP_FROM ||
        `"Beetlebulbs Accounts" <accounts@beetlebulbs.com>`,
      to,
      subject: `${
        documentType === "PROFORMA" ? "Proforma Invoice" : "Invoice"
      } ${invoiceNo} | Beetlebulbs`,
      html: `
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
      attachments
    });

    console.log("📧 Invoice email sent successfully to", to);

  } catch (err) {
    // ❗ Email failure should NEVER break invoice creation
    console.error("📧 Invoice Email Error (ignored):", err.message);
  }
}
