import express from "express";
import fetch from "node-fetch";
import SibApiV3Sdk from "sib-api-v3-sdk";

const router = express.Router();

/* ===============================
   BREVO SETUP
=============================== */
const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

/* ===============================
   LEAD ROUTE
=============================== */
router.post("/", async (req, res) => {
  try {
    const { name, phone, email, business } = req.body;

    const message = `
🚀 New Lead Received

Name: ${name}
Phone: ${phone}
Email: ${email || "-"}
Service Interested: ${business}
`;

    /* ===============================
       WHATSAPP (OPTIONAL – KEEP AS IS)
    =============================== */
    await fetch(
      `https://api.callmebot.com/whatsapp.php?phone=YOUR_NUMBER&text=${encodeURIComponent(
        message
      )}&apikey=YOUR_API_KEY`
    );

    /* ===============================
       EMAIL (BREVO)
    =============================== */
    await emailApi.sendTransacEmail({
      sender: {
        email: "no-reply@beetlebulbs.com",
        name: "Beetlebulbs Leads"
      },
      to: [{ email: process.env.EMAIL_TO }],
      subject: "🚀 New Growth Blueprint Lead",
      textContent: message
    });

    res.json({ ok: true });

  } catch (err) {
    console.error("Lead Error:", err);
    res.status(500).json({ ok: false });
  }
});

export default router;
