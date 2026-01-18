import fetch from "node-fetch";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const REQUEST_TIMEOUT = 10000; // 10 seconds

export async function sendInvoiceEmail({
  to,
  subject,
  html,
  pdfUrl
}) {
  if (!to) {
    throw new Error("Brevo Email Error: recipient email missing");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const payload = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    attachment: pdfUrl
      ? [
          {
            url: pdfUrl,
            name: "Invoice.pdf"
          }
        ]
      : []
  };

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Brevo API failed: ${errorText}`);
    }

    return true;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Brevo API timeout");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
