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
    // ✅ DEFINE SAFE VARIABLE *INSIDE FUNCTION*
    const safeBusinessType = businessType || "N/A";

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.verify();
    console.log("✅ SMTP connection verified");

    await transporter.sendMail({
      from: `"Beetlebulbs Form Lead" <${process.env.SMTP_USER}>`,
      to: "shahadat722020@gmail.com", // 🔥 IMPORTANT
      subject: "🔥 New Website Form Lead",
      html: `
        <h2>New Form Lead Received</h2>
        <hr/>

        <p><strong>Name:</strong> ${name || "N/A"}</p>
        <p><strong>Email:</strong> ${email || "N/A"}</p>
        <p><strong>Phone:</strong> ${phone || "N/A"}</p>

        <br/>

        <p><strong>Country:</strong> ${country || "N/A"}</p>
        <p><strong>State / Region:</strong> ${stateRegion || "N/A"}</p>
        <p><strong>ZIP / Area Code:</strong> ${zipCode || "N/A"}</p>

        <br/>

        <p><strong>Business Type:</strong> ${safeBusinessType}</p>
        <p><strong>Marketing Spend:</strong> ${marketingSpend || "N/A"}</p>
        <p><strong>Primary Goal:</strong> ${primaryGoal || "N/A"}</p>
        <p><strong>Biggest Challenge:</strong> ${biggestChallenge || "N/A"}</p>

        <br/>
        <p style="font-size:12px;opacity:0.7;">
          — Beetlebulbs Internal Lead System
        </p>
      `
    });

    console.log("✅ FORM LEAD EMAIL SENT");
  } catch (error) {
    console.error("❌ FORM LEAD EMAIL FAILED");
    console.error(error);
  }
}
