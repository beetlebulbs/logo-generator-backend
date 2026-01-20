import fetch from "node-fetch";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendInvoiceEmail({
  to,
  subject,
  html,
  pdfPath   // MUST be Supabase public https URL
}) {
  if (!to) {
    throw new Error("Brevo Email Error: recipient missing");
  }

  if (
    !pdfPath ||
    typeof pdfPath !== "string" ||
    !pdfPath.startsWith("https://")
  ) {
    console.error("❌ INVALID PDF URL:", pdfPath);
    throw new Error("Brevo Email Error: invalid PDF URL");
  }

  const payload = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    attachment: [
      {
        url: pdfPath,
        name: "Invoice.pdf"
      }
    ]
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
