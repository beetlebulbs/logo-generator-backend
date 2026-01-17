import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import SibApiV3Sdk from "sib-api-v3-sdk";

// Load env
dotenv.config({ path: ".env.network" });

const app = express();
app.use(cors());
app.use(express.json());

/* ==============================
   BREVO SETUP
============================== */
const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

/* ==============================
   SEND FORM (FREELANCER APPLY)
============================== */
app.post("/send-form", async (req, res) => {
  try {
    const formData = req.body;

    await emailApi.sendTransacEmail({
      sender: {
        email: "no-reply@beetlebulbs.com",
        name: "Beetlebulbs Network"
      },
      to: [{ email: process.env.TO_EMAIL }],
      subject: "Freelancer Application",
      htmlContent: `
        <h2>New Application Submitted</h2>

        ${Object.entries(formData)
          .map(
            ([key, value]) =>
              `<p><strong>${key}:</strong> ${value || "N/A"}</p>`
          )
          .join("")}
      `
    });

    console.log("✅ Brevo: Freelancer application email sent");
    res.json({ success: true, message: "Email sent successfully" });

  } catch (err) {
    console.error("❌ Brevo email failed:", err);
    res.status(500).json({ success: false, message: "Email failed" });
  }
});

/* ==============================
   SERVER START
============================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Network backend running on port ${PORT}`)
);
