console.log("📩 FORM LEAD MAILER ACTIVE (BREVO API)");

export async function sendFormLeadEmail(payload) {
  try {
    const {
      service,
      name,
      email,
      phone,
      country,
      stateRegion,
      zipCode,

      identityFor,
      brandStage,
      brandRequirement,
      industry,

      digitalRequirement,
      digitalGoal,
      existingSetup,

      marketingSpend,
      primaryGoal,
      biggestChallenge,
      businessType
    } = payload;
  const clean = (v) =>
      typeof v === "string" && v.trim() === "" ? "-" : v;
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
        to: [{ email: process.env.FORM_LEADS_EMAIL }],
        subject: `🔥 New ${service} Lead`,
        htmlContent: `
          <h2>New Form Submission</h2>

          <p><b>Service:</b> ${service}</p>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Phone:</b> ${phone}</p>
          <p><b>Country:</b> ${country}</p>
          <p><b>State:</b> ${stateRegion}</p>
          <p><b>ZIP:</b> ${zipCode}</p>

          <hr />

          <h3>Brand Identity</h3>
          <p>Identity For: ${clean(identityFor)}</p>
<p>Brand Stage: ${clean(brandStage)}</p>
<p>Brand Requirement: ${clean(brandRequirement)}</p>
<p>Industry: ${clean(industry)}</p>


          <h3>Digital Presence</h3>
        <p>Requirement: ${clean(digitalRequirement)}</p>
<p>Goal: ${clean(digitalGoal)}</p>
<p>Existing Setup: ${clean(existingSetup)}</p>


          <h3>Growth Engine</h3>
          <p>Marketing Spend: ${clean(marketingSpend)}</p>
<p>Primary Goal: ${clean(primaryGoal)}</p>
<p>Biggest Challenge: ${clean(biggestChallenge)}</p>
<p>Business Type: ${clean(businessType)}</p>

        `
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ BREVO ERROR:", data);
      return;
    }

    console.log("✅ ADMIN FORM EMAIL SENT", data.messageId);
  } catch (err) {
    console.error("❌ EMAIL FAILED:", err.message);
  }
}
