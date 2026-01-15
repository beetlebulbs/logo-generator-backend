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
      service: "gmail",              // ✅ IMPORTANT
      auth: {
        user: process.env.SMTP_USER, // gmail
        pass: process.env.SMTP_PASS  // app password
      }
    });

    const info = await transporter.sendMail({
      from: `"Beetlebulbs Form Lead" <${process.env.SMTP_USER}>`,
      to: "shahadat722020@gmail.com",
      subject: "🔥 New Website Form Lead",
      html: `
        <h2>New Form Lead</h2>
        <p><b>Name:</b> ${name || "N/A"}</p>
        <p><b>Email:</b> ${email || "N/A"}</p>
        <p><b>Phone:</b> ${phone || "N/A"}</p>
        <p><b>Country:</b> ${country || "N/A"}</p>
        <p><b>State:</b> ${stateRegion || "N/A"}</p>
        <p><b>ZIP:</b> ${zipCode || "N/A"}</p>
        <p><b>Business Type:</b> ${businessType || "N/A"}</p>
        <p><b>Marketing Spend:</b> ${marketingSpend || "N/A"}</p>
        <p><b>Primary Goal:</b> ${primaryGoal || "N/A"}</p>
        <p><b>Biggest Challenge:</b> ${biggestChallenge || "N/A"}</p>
      `
    });

    console.log("✅ FORM LEAD EMAIL SENT:", info.messageId);

  } catch (err) {
    console.error("❌ FORM LEAD EMAIL FAILED:", err.message);
  }
}
