const fetch = require('node-fetch');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function generateVerificationCode() {
  // 6-digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(toEmail, name, code) {
  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        name: process.env.EMAIL_FROM_NAME || 'Happy Family Market',
        email: process.env.EMAIL_FROM_ADDRESS,
      },
      to: [{ email: toEmail, name }],
      subject: 'Verify your email — Happy Family Market',
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1b4332;">Hi ${name},</h2>
          <p>Welcome to Happy Family Market! Use the code below to verify your email address:</p>
          <div style="background: #eff7f2; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1b4332;">${code}</span>
          </div>
          <p style="color: #5b6b62; font-size: 13px;">This code expires in 15 minutes. If you didn't create an account, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brevo email send failed (${res.status}): ${errText}`);
  }

  return res.json();
}

module.exports = { generateVerificationCode, sendVerificationEmail };