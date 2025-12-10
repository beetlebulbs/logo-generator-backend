require('dotenv').config({ path: '.env.pdfemail' });
const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


app.post('/submit-brief', upload.single('pdfFile'), async (req, res) => {
  const { name, email, phone } = req.body;
  const pdfFile = req.file;

  if (!pdfFile || !name || !email) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: `NEW SERVICE BRIEF: ${name} (${email})`,
      html: `
        <h2>New Service Brief Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
      `,
      attachments: [{
        filename: pdfFile.originalname || `Service_Brief_${Date.now()}.pdf`,
        content: pdfFile.buffer,
        contentType: 'application/pdf',
      }],
    });
    console.log(`✅ Email sent for ${name}`);
    res.json({ success: true, message: 'Email sent successfully!' });
  } catch (err) {
    console.error('❌ Email error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
