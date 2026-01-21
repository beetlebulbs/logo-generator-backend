import fetch from "node-fetch";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendInvoiceEmail({
  to,
  subject,
  html,
  pdfPath // URL OR Buffer
}) {
  if (!to) {
    throw new Error("Brevo Email Error: recipient missing");
  }

  let pdfBuffer;

  // ✅ CASE 1: pdfPath is URL → DOWNLOAD IT
  if (typeof pdfPath === "string" && pdfPath.startsWith("http")) {
    const res = await fetch(pdfPath);
    if (!res.ok) {
      throw new Error("Failed to download PDF from Supabase");
    }

    const arrayBuffer = await res.arrayBuffer();
    pdfBuffer = Buffer.from(arrayBuffer);
  }

  // ✅ CASE 2: Buffer / Uint8Array → NORMALIZE
  else if (Buffer.isBuffer(pdfPath) || pdfPath instanceof Uint8Array) {
    pdfBuffer = Buffer.from(pdfPath);
  }

  // ❌ ANYTHING ELSE = BUG
  else {
    console.error("❌ INVALID PDF INPUT TYPE:", typeof pdfPath);
    console.error(pdfPath);
    throw new Error("Brevo Email Error: invalid PDF input");
  }

  // ✅ ALWAYS BASE64
  const pdfBase64 = pdfBuffer.toString("base64");

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
        content: pdfBase64,
        name: "Invoice.pdf",
        type: "application/pdf"
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
