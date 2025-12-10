import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";

// Load .env.network explicitly
dotenv.config({ path: ".env.network" });
const app = express();
app.use(cors());
app.use(express.json());

// ---- configure your email transporter ----
const transporter = nodemailer.createTransport({
  service: "gmail", // or use "smtp.mailgun.org", etc.
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // NOT your Gmail password. Use an App Password.
  },
});

// ---- POST endpoint to send form ----
app.post("/send-form", async (req, res) => {
  try {
    const formData = req.body;

    const mailOptions = {
      from: `"Beetlebulbs Network" <${process.env.EMAIL_USER}>`,
      to: process.env.TO_EMAIL,
      subject: "Freelancer Application",
      html: `
        <h2>New Application Submitted</h2>
        ${Object.entries(formData)
          .map(([key, value]) => `<p><strong>${key}:</strong> ${value || "N/A"}</p>`)
          .join("\n")}
  <p><strong>Name:</strong> ${formData.name}</p>
  <p><strong>Email:</strong> ${formData.email}</p>
  <p><strong>Address:</strong> ${formData.address}</p>
  <p><strong>State:</strong> ${formData.stateProvince}</p>
  <p><strong>Phone:</strong> ${formData.phone}</p>
  <p><strong>Highest Degree:</strong> ${formData.degree}</p>
  <p><strong>LinkedIn:</strong> ${formData.linkedin}</p>
  <p><strong>Primary Expertise:</strong> ${formData.primaryExpertise}</p>
  <p><strong>Experience (Years):</strong> ${formData.experience}</p>
  <p><strong>Niche Skills / Tools:</strong> ${formData.skills}</p>
  <p><strong>Primary Portfolio:</strong> ${formData.portfolioPrimary}</p>
  <p><strong>Secondary Portfolio:</strong> ${formData.portfolioSecondary}</p>
  <p><strong>Pricing Structure:</strong> ${formData.pricing}</p>
  <p><strong>Call Availability:</strong> ${formData.availability}</p>
  <p><strong>Weekly Capacity (Hours):</strong> ${formData.capacity}</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", formData.email);
    res.json({ success: true, message: "Email sent successfully" });
  } catch (err) {
    console.error("❌ Email sending failed:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// Listen on port from .env
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Network backend running on http://localhost:${PORT}`));
