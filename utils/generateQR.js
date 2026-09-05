const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const QR_TOKEN_TTL_SECONDS = parseInt(process.env.QR_TOKEN_TTL_SECONDS || '40', 10);

/**
 * Creates a short-lived signed token for a given attendance session.
 * This is the value actually encoded in the QR image. Rotating this every
 * ~30-40s means a screenshot shared in a group chat goes stale fast, while
 * the overall session (10 min) stays open for students scanning live.
 */
function createSessionToken(sessionId) {
  const nonce = uuidv4();
  const token = jwt.sign(
    { sessionId: sessionId.toString(), nonce },
    process.env.QR_TOKEN_SECRET,
    { expiresIn: QR_TOKEN_TTL_SECONDS }
  );

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + QR_TOKEN_TTL_SECONDS * 1000);

  return { token, issuedAt, expiresAt };
}

function verifySessionToken(token) {
  return jwt.verify(token, process.env.QR_TOKEN_SECRET);
}

/**
 * Renders a QR code as a base64 data URL encoding a scan URL that the
 * frontend's QR scanner page can open, e.g.
 *   https://<client>/attend/<token>
 */
async function generateQRImage(token) {
  const scanUrl = `${process.env.CLIENT_URL}/attend/${token}`;
  const dataUrl = await QRCode.toDataURL(scanUrl, { margin: 1, width: 300 });
  return { dataUrl, scanUrl };
}

module.exports = { createSessionToken, verifySessionToken, generateQRImage, QR_TOKEN_TTL_SECONDS };
