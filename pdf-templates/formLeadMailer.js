import nodemailer from "nodemailer";

console.log("📩 FORM LEAD MAILER ACTIVE");

export async function sendFormLeadEmail({
  name,
  email,
  phone,
  country,
  stateRegion,
  zipCode,
  businessType,
  marketingSpend,
  primaryGoal,
  biggestChallenge
}) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER, // your gmail
        pass: process.env.SMTP_PASS  // gmail APP PASSWORD
      },

      // ⏱️ IMPORTANT: prevent server hang
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000
    });

    const info = await transporter.sendMail({
      from: `"Beetlebulbs Form Lead" <${process.env.SMTP_USER}>`,
      to: "shahadat722020@gmail.com",
      subject: "🔥 New Website Form Lead",
      html: `
        <h2>New Form Lead</h2>
        <hr/>

        <p><b>Name:</b> ${name || "N/A"}</p>
        <p><b>Email:</b> ${email || "N/A"}</p>
        <p><b>Phone:</b> ${phone || "N/A"}</p>

        <p><b>Country:</b> ${country || "N/A"}</p>
        <p><b>State / Region:</b> ${stateRegion || "N/A"}</p>
        <p><b>ZIP:</b> ${zipCode || "N/A"}</p>

        <p><b>Business Type:</b> ${businessType || "N/A"}</p>
        <p><b>Marketing Spend:</b> ${marketingSpend || "N/A"}</p>
        <p><b>Primary Goal:</b> ${primaryGoal || "N/A"}</p>
        <p><b>Biggest Challenge:</b> ${biggestChallenge || "N/A"}</p>

        <br/>
        <p style="font-size:12px;opacity:0.6">
          — Beetlebulbs Internal Lead System
        </p>
      `
    });

    console.log("✅ FORM LEAD EMAIL SENT:", info.messageId);

  } catch (err) {
    console.error("❌ FORM LEAD EMAIL FAILED:", err.message);
  }
}
