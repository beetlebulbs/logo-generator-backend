 import nodemailer from "nodemailer";

console.log("🔥🔥🔥 ACTIVE MAILER FILE LOADED 🔥🔥🔥");

export async function sendPdfEmail({
  userEmail,
  adminEmail,
  pdfPath,
  packageName,
  name,
  phone
}) {
  console.log("📧 MAILER INPUT:", { name, phone, userEmail });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // USER EMAIL
  await transporter.sendMail({
    from: `"Beetlebulbs®" <package@beetlebulbs.com>`,
    to: userEmail,
    subject: `${packageName} – Detailed Overview`,
    html: `
      <p>Hi ${name || "there"},</p>
      <p>Thank you for your interest in <strong>Beetlebulbs®</strong>.</p>
      <p>Please find attached the detailed overview of our <strong>${packageName} PDF.</p>
      <p>This document explains what you will receive, how it helps your brand, and how the process works. <br/>
      If you have any questions, feel free to reply to this email.</p>
      <br/>
      <p>— Team Beetlebulbs®</p>
    `,
    attachments: [{ path: pdfPath }]
  });

 
  // ADMIN EMAIL
  await transporter.sendMail({
    from: `"Beetlebulbs Website" <info@beetlebulbs.com>`,
    to: adminEmail,
    subject: `🔥 New Brand Identity Lead – ${packageName}`,
    text: `
New lead received from landing page:

Name: ${name || "N/A"}
Email: ${userEmail}
Phone: ${phone || "N/A"}
Package: ${packageName}
    `
  });
}
