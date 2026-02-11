import SibApiV3Sdk from "sib-api-v3-sdk";
import fs from "fs";

// 🔥 BREVO CLIENT SETUP
const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

export async function sendBookEmail({
  userEmail,
  adminEmail,
  pdfPath,
  packageName,   // ✅ single source of truth
  phone,
  name
}) {
  console.log("📘 Sending BOOK email:", packageName, "→", userEmail);

  const pdfBuffer = fs.readFileSync(pdfPath);

  // (Future use – email hero images if needed)
  const coverMap = {
    1: "https://beetlebulbs.com/email-assets/vol1-cover.png",
    2: "https://beetlebulbs.com/email-assets/vol2-cover.png",
    3: "https://beetlebulbs.com/email-assets/vol3-cover.png"
  };

  await emailApi.sendTransacEmail({
    sender: {
      email: "no-reply@beetlebulbs.com",
      name: "Beetlebulbs®"
    },

    to: [{ email: userEmail }],

    subject: `${packageName} — Your eBook is Ready`,

    htmlContent: `
      <p>Hi ${name || "there"},</p>

      <p>
        Thank you for purchasing <strong>${packageName}</strong>.
      </p>

      <p>
        You’ll find your eBook attached to this email.
        We recommend going through it in sequence and applying it step-by-step.
      </p>

      <hr style="margin:20px 0;" />

      <p><strong>What’s next in the Brand Identity 2026 system?</strong></p>

      <p>
        <strong>Brand Identity 2026 – Vol. 02</strong><br/>
        Focuses on launching, scaling, and sustaining brands in real markets —
        covering positioning, rollout systems, and controlled growth.
      </p>

      <p>
        <strong>Brand Identity 2026 – Vol. 03</strong><br/>
        Designed for long-term brand governance — legal protection,
        consistency, and evolution as your brand grows.
      </p>

      <p style="margin-top:16px;">
        Many readers continue with the next volumes after completing this one,
        as all three are designed as a connected system.
      </p>

      <br/>
      <p>— Team Beetlebulbs®</p>
    `,

    attachment: [
      {
        content: pdfBuffer.toString("base64"),
        name: `${packageName}.pdf`   // ✅ FIXED
      }
    ]
  });

  console.log("✅ Book email sent successfully");
}
