import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendInvoiceEmail({
  to,
  subject,
  html,
  pdfPath // URL | local path | Buffer | Uint8Array
}) {
  if (!to) {
    throw new Error("Brevo Email Error: recipient missing");
  }

  let pdfBuffer;

  /* ==================================================
     NORMALIZE PDF INPUT (STRICT + SAFE + NO GUESS)
  ================================================== */

  // ✅ CASE 1: Already a Buffer
  if (Buffer.isBuffer(pdfPath)) {
    pdfBuffer = pdfPath;
  }

  // ✅ CASE 2: Uint8Array
  else if (pdfPath instanceof Uint8Array) {
    pdfBuffer = Buffer.from(pdfPath);
  }

  // ✅ CASE 3: STRING → URL
  else if (
    typeof pdfPath === "string" &&
    (pdfPath.startsWith("http://") || pdfPath.startsWith("https://"))
  ) {
    try {
      const res = await fetch(pdfPath);
      if (!res.ok) {
        throw new Error(`PDF download failed: ${res.status}`);
      }
      const ab = await res.arrayBuffer();
      pdfBuffer = Buffer.from(ab);
    } catch (err) {
      console.error("❌ PDF URL FETCH FAILED:", pdfPath);
      throw new Error("Brevo Email Error: unable to download PDF");
    }
  }

  // ✅ CASE 4: STRING → LOCAL FILE PATH (🔥 THIS FIXES YOUR BUG)
  else if (typeof pdfPath === "string") {
    const resolvedPath = path.resolve(pdfPath);

    if (!fs.existsSync(resolvedPath)) {
      console.error("❌ PDF FILE NOT FOUND:", resolvedPath);
      throw new Error("Brevo Email Error: PDF file not found");
    }

    try {
      pdfBuffer = fs.readFileSync(resolvedPath);
    } catch (err) {
      console.error("❌ PDF FILE READ FAILED:", resolvedPath);
      throw new Error("Brevo Email Error: unable to read PDF file");
    }
  }

  // ❌ CASE 5: ANYTHING ELSE → HARD FAIL
  else {
    console.error("❌ INVALID PDF INPUT TYPE:", typeof pdfPath);
    console.error(pdfPath);
    throw new Error("Brevo Email Error: invalid PDF input");
  }

  /* ==================================================
     SEND EMAIL VIA BREVO
  ================================================== */

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
        content: pdfBuffer.toString("base64"),
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
