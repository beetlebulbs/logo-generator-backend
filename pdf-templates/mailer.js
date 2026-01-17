import SibApiV3Sdk from "sib-api-v3-sdk";
import fs from "fs";

console.log("🔥🔥🔥 BREVO MAILER ACTIVE 🔥🔥🔥");

// Brevo client setup
const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

export async function sendPdfEmail({
  userEmail,
  adminEmail,
  pdfPath,
  packageName,
  name,
  phone
}) {
  console.log("📧 BREVO MAIL INPUT:", { name, phone, userEmail });

  // Load PDF
  const pdfBuffer = fs.readFileSync(pdfPath);

  /* =========================
     1️⃣ USER EMAIL (PDF)
  ========================= */
  await emailApi.sendTransacEmail({
    sender: {
      email: "no-reply@beetlebulbs.com",
      name: "Beetlebulbs®"
    },
    to: [{ email: userEmail }],
    subject: `${packageName} – Detailed Overview`,
    htmlContent: `
      <p>Hi ${name || "there"},</p>

      <p>Thank you for your interest in <strong>Beetlebulbs®</strong>.</p>

      <p>Please find attached the detailed overview of our 
      <strong>${packageName}</strong>.</p>

      <p>This document explains what you will receive, how it helps your brand, 
      and how the process works.</p>

      <p>If you have any questions, feel free to reply to this email.</p>

      <br/>
      <p>— Team Beetlebulbs®</p>
    `,
    attachment: [
      {
        content: pdfBuffer.toString("base64"),
        name: `${packageName}.pdf`
      }
    ]
  });

  /* =========================
     2️⃣ ADMIN / LEAD EMAIL
  ========================= */
  await emailApi.sendTransacEmail({
    sender: {
      email: "no-reply@beetlebulbs.com",
      name: "Beetlebulbs Website"
    },
    to: [{ email: adminEmail }],
    subject: `🔥 New Brand Identity Lead – ${packageName}`,
    htmlContent: `
      <h3>New Lead Received</h3>

      <p><strong>Name:</strong> ${name || "N/A"}</p>
      <p><strong>Email:</strong> ${userEmail}</p>
      <p><strong>Phone:</strong> ${phone || "N/A"}</p>
      <p><strong>Package:</strong> ${packageName}</p>
    `
  });

  console.log("✅ BREVO EMAILS SENT SUCCESSFULLY");
}
