import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

/* =====================================================
   BREVO SMTP – INVOICE MAILER
===================================================== */

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER, // a01bdh881@smtp-brevo.com
    pass: process.env.BREVO_SMTP_KEY   // SMTP key value
  }
});

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
    const currencySymbol = invoiceType === "GLOBAL" ? "$" : "₹";

    const attachments = [];
    if (pdfPath) {
      attachments.push({
        filename: path.basename(pdfPath),
        path: path.resolve(pdfPath)
      });
    }

    await transporter.sendMail({
      from: `"Beetlebulbs Accounts" <accounts@beetlebulbs.com>`,
      to,
      subject: `${
        documentType === "PROFORMA" ? "Proforma Invoice" : "Invoice"
      } ${invoiceNo} | Beetlebulbs`,
      html: `
        <p>Hello <strong>${clientName}</strong>,</p>
        <p>Please find attached your ${
          documentType === "PROFORMA" ? "Proforma Invoice" : "Invoice"
        }.</p>
        <p><strong>Total:</strong> ${currencySymbol}${Number(total).toFixed(2)}</p>
        <br/>
        <p>— Beetlebulbs Accounts</p>
      `,
      attachments
    });

    console.log("📧 Invoice email sent successfully");

  } catch (err) {
    console.error("❌ SMTP EMAIL FAILED:", err.message);
  }
}
