const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Sends an email. Failures are logged but never thrown up to the caller -
 * a broken SMTP config should never crash attendance flows.
 */
async function sendEmail({ to, subject, html }) {
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error(`Email send failed to ${to}: ${err.message}`);
    return false;
  }
}

module.exports = sendEmail;
