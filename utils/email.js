const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

function generateVerificationCode() {
  // 6-digit numeric code, e.g. "empty483920" -> "483920"
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(toEmail, name, code) {
  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || 'Happy Family Market'}" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Verify your email — Happy Family Market',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1b4332;">Hi ${name},</h2>
        <p>Welcome to Happy Family Market! Use the code below to verify your email address:</p>
        <div style="background: #eff7f2; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1b4332;">${code}</span>
        </div>
        <p style="color: #5b6b62; font-size: 13px;">This code expires in 15 minutes. If you didn't create an account, you can ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { generateVerificationCode, sendVerificationEmail };