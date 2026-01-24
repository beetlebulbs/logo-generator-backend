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

    // -------- helpers --------
    const clean = (v) =>
      typeof v === "string" && v.trim() === "" ? "-" : v || "-";

    // normalize service key
    const serviceKey =
      service === "Brand Identity" ? "brand" :
      service === "Digital Presence" ? "digital" :
      service === "Growth Engine" ? "growth" :
      service;

    const SUBJECT_MAP = {
      brand: "🔥 Brand Identity Form Lead",
      digital: "🔥 Digital Presence Form Lead",
      growth: "🔥 Growth Engine Form Lead"
    };

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
        subject: SUBJECT_MAP[serviceKey] || "🔥 New Form Lead",

        htmlContent: `
          <h2>New Form Submission</h2>

          <p><b>Service:</b> ${clean(service)}</p>
          <p><b>Name:</b> ${clean(name)}</p>
          <p><b>Email:</b> ${clean(email)}</p>
          <p><b>Phone:</b> ${clean(phone)}</p>
          <p><b>Country:</b> ${clean(country)}</p>
          <p><b>State:</b> ${clean(stateRegion)}</p>
          <p><b>ZIP:</b> ${clean(zipCode)}</p>

          <hr />

          ${
            serviceKey === "brand"
              ? `
            <h3>Brand Identity</h3>
            <p>Identity For: ${clean(identityFor)}</p>
            <p>Brand Stage: ${clean(brandStage)}</p>
            <p>Brand Requirement: ${clean(brandRequirement)}</p>
            <p>Industry: ${clean(industry)}</p>
            `
              : ""
          }

          ${
            serviceKey === "digital"
              ? `
            <h3>Digital Presence</h3>
            <p>Requirement: ${clean(digitalRequirement)}</p>
            <p>Goal: ${clean(digitalGoal)}</p>
            <p>Existing Setup: ${clean(existingSetup)}</p>
            `
              : ""
          }

          ${
            serviceKey === "growth"
              ? `
            <h3>Growth Engine</h3>
            <p>Marketing Spend: ${clean(marketingSpend)}</p>
            <p>Primary Goal: ${clean(primaryGoal)}</p>
            <p>Biggest Challenge: ${clean(biggestChallenge)}</p>
            <p>Business Type: ${clean(businessType)}</p>
            `
              : ""
          }
        `
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ BREVO API ERROR:", data);
      return;
    }

    console.log("✅ ADMIN FORM EMAIL SENT", data.messageId);

  } catch (err) {
    console.error("❌ EMAIL FAILED:", err.message);
  }
}