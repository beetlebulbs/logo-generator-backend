import fetch from "node-fetch";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendInvoiceEmail({
  to,
  subject,
  html,
  pdfPath // can be URL OR Buffer
}) {
  if (!to) {
    throw new Error("Brevo Email Error: recipient missing");
  }

  let attachment;

  // ✅ CASE 1: Public URL
  if (typeof pdfPath === "string" && pdfPath.startsWith("http")) {
    attachment = [{
      url: pdfPath,
      name: "Invoice.pdf"
    }];
  }

  // ✅ CASE 2: Buffer / Uint8Array (resend case)
  else if (Buffer.isBuffer(pdfPath) || pdfPath instanceof Uint8Array) {
    attachment = [{
      content: Buffer.from(pdfPath).toString("base64"),
      name: "Invoice.pdf"
    }];
  }

  else {
    console.error("❌ INVALID PDF INPUT:", pdfPath);
    throw new Error("Brevo Email Error: invalid PDF input");
  }

  const payload = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    attachment
  };

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo API failed: ${err}`);
  }

  return true;
}
