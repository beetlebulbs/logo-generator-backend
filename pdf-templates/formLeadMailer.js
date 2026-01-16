import fetch from "node-fetch";

console.log("📩 FORM LEAD MAILER ACTIVE (BREVO API)");

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
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        sender: {
          name: "BeetleBulbs Form Lead",
          email: "package@beetlebulbs.com"
        },
        to: [
          { email: process.env.FORM_LEADS_EMAIL }
        ],
        subject: "🔥 New Website Form Submission",
        htmlContent: `
          <h2>New Form Submission</h2>
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
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ BREVO API ERROR:", data);
      return;
    }

    console.log("✅ ADMIN FORM EMAIL SENT (BREVO API)", data.messageId);

  } catch (err) {
    console.error("❌ BREVO API FAILED:", err.message);
  }
}
