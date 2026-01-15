import nodemailer from "nodemailer";

console.log("📩 FORM LEAD MAILER ACTIVE (BREVO)");

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
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_USER, // always "apikey"
        pass: process.env.BREVO_KEY
      }
    });

    const info = await transporter.sendMail({
      from: `"BeetleBulbs Form Lead" <package@beetlebulbs.com>`, // ✅ verified sender
      to: process.env.FORM_LEADS_EMAIL, // ✅ ONLY YOU
      subject: "🔥 New Website Form Submission",
      html: `
        <h2>New Form Submission</h2>
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
          — BeetleBulbs Internal Lead System
        </p>
      `
    });

    console.log("✅ ADMIN FORM EMAIL SENT (BREVO):", info.messageId);

  } catch (err) {
    console.error("❌ ADMIN FORM EMAIL FAILED (BREVO):", err);
  }
}
