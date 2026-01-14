import express from "express";
import nodemailer from "nodemailer";
import fetch from "node-fetch";

const router = express.Router();

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
       WHATSAPP (OPTIONAL – KEEP)
    =============================== */
    await fetch(
      `https://api.callmebot.com/whatsapp.php?phone=YOUR_NUMBER&text=${encodeURIComponent(
        message
      )}&apikey=YOUR_API_KEY`
    );

    /* ===============================
       EMAIL
    =============================== */
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"Beetlebulbs Leads" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: "🚀 New Growth Blueprint Lead",
      text: message
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Lead Error:", err);
    res.status(500).json({ ok: false });
  }
});

export default router;
