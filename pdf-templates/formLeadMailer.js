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
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // MUST be false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: `"BeetleBulbs Lead" <${process.env.SMTP_USER}>`,
      to: "shahadat722020@gmail.com",
      subject: "🔥 New Website Form Lead",
      html: `
        <h2>New Form Lead</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Country:</b> ${country}</p>
        <p><b>State:</b> ${stateRegion}</p>
        <p><b>ZIP:</b> ${zipCode}</p>
        <p><b>Business Type:</b> ${businessType}</p>
        <p><b>Marketing Spend:</b> ${marketingSpend}</p>
        <p><b>Goal:</b> ${primaryGoal}</p>
        <p><b>Challenge:</b> ${biggestChallenge}</p>
      `
    });

    console.log("✅ FORM LEAD EMAIL SENT:", info.messageId);

  } catch (err) {
    console.error("❌ FORM LEAD EMAIL FAILED:", err);
  }
}
