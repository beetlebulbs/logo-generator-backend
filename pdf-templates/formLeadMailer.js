import nodemailer from "nodemailer";

console.log("📩 GMAIL FORM LEAD MAILER ACTIVE");

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
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const info = await transporter.sendMail({
      from: `"Beetlebulbs Lead" <${process.env.SMTP_USER}>`,
      to: "betlebulbs@gmail.com", // SAME gmail for test
      subject: "🔥 New Website Lead (TEST)",
      html: `
        <h3>New Lead</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Country:</b> ${country}</p>
        <p><b>State:</b> ${stateRegion}</p>
        <p><b>ZIP:</b> ${zipCode}</p>
        <p><b>Business Type:</b> ${businessType}</p>
        <p><b>Marketing Spend:</b> ${marketingSpend}</p>
        <p><b>Primary Goal:</b> ${primaryGoal}</p>
        <p><b>Biggest Challenge:</b> ${biggestChallenge}</p>
      `
    });

    console.log("✅ GMAIL EMAIL SENT:", info.messageId);
  } catch (err) {
    console.error("❌ GMAIL EMAIL FAILED:", err.message);
  }
}
