require('dotenv').config({ path: '.env.pdfblueprint' });

// Optional debug logs
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS length:', process.env.SMTP_PASS?.length);
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const multer = require('multer');

const upload = multer(); // for multipart/form-data
const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '30mb' }));

// ✅ SINGLE route definition — not nested
app.post("/send-blueprint", upload.single("pdfFile"), async (req, res) => {
  console.log("📨 /send-blueprint hit!");
  console.log("🧾 Body keys:", Object.keys(req.body));
  console.log("📎 File?", !!req.file, req.file && req.file.size);
  try {
    const { name, email, phone, challengeTitle, bundleName, html } = req.body;
    if (!email || !html) {
      return res.status(400).json({ message: 'Email and HTML required' });
    }

    console.log('Received request:', { name, email, phone, challengeTitle, bundleName });

    // 🧠 Launch Puppeteer
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '12mm', right: '12mm' },
    });
    await browser.close();

    // ✉️ Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // ✅ Verify SMTP
    await transporter.verify();
    console.log('SMTP verified successfully.');

    const ownerEmail = process.env.TO_EMAIL || process.env.SMTP_USER;

    const mailOptions = {
      from: `"Blueprint Generator" <${process.env.SMTP_USER}>`,
      to: ownerEmail,
      bcc: email,
      replyTo: email,
      subject: `Blueprint Request: ${bundleName || 'Blueprint'} — ${name || email}`,
      text: `New Blueprint request.\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nChallenge: ${challengeTitle}\nBundle: ${bundleName}`,
      html: `<p>New Blueprint request.</p>
             <ul>
               <li><b>Name:</b> ${name}</li>
               <li><b>Email:</b> ${email}</li>
               <li><b>Phone:</b> ${phone}</li>
               <li><b>Challenge:</b> ${challengeTitle}</li>
               <li><b>Bundle:</b> ${bundleName}</li>
             </ul>`,
      attachments: [
        {
          filename: `${(bundleName || 'blueprint').replace(/\s+/g, '_')}.pdf`,
          content: pdfBuffer,
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.response);
    res.json({ ok: true, message: 'Email sent successfully', info });
  } catch (err) {
    console.error('❌ Error sending blueprint:', err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  }
});

// ✅ Start server
const PORT = parseInt(process.env.PORT || '4000', 10);
app.listen(PORT, () =>
  console.log(`Blueprint email server running on port ${PORT}`)
);
