import nodemailer from "nodemailer";
import "dotenv/config";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: "apikey",
    pass: process.env.BREVO_SMTP_KEY
  }
});

async function testSMTP() {
  try {
    await transporter.sendMail({
      from: "accounts@beetlebulbs.com", // MUST be verified in Brevo
      to: "betlebulbs@gmail.com", // apna email daalo
      subject: "Brevo SMTP Test",
      text: "If you received this email, Brevo SMTP is working 🎉"
    });

    console.log("✅ BREVO SMTP WORKING");
  } catch (err) {
    console.error("❌ BREVO SMTP FAILED:", err.message);
    process.exit(1);
  }
}

testSMTP();
