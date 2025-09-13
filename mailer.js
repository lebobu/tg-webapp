// mailer.js
const nodemailer = require('nodemailer');

const {
  SMTP_HOST, SMTP_PORT, SMTP_SECURE,
  SMTP_USER, SMTP_PASS, FROM_EMAIL
} = process.env;

const port = Number(SMTP_PORT) || 587;
const secure = String(SMTP_SECURE).toLowerCase() === 'true' || port === 465;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure,
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

async function sendMail({ to, subject, text, html, from }) {
  if (!SMTP_HOST) {
    console.warn('sendMail: SMTP not configured (SMTP_HOST missing). Skip.');
    return;
  }
  const info = await transporter.sendMail({
    from: from || FROM_EMAIL || SMTP_USER,
    to,
    subject,
    text,
    html,
  });
  return info;
}

module.exports = { sendMail };
