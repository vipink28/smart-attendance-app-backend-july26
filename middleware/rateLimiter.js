const rateLimit = require('express-rate-limit');

// General API limiter - generous, just guards against abuse/bots
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// Login limiter - slows down brute-force credential attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later.' },
});

// Attendance scan limiter (anti-proxy) - a legitimate student scans once.
// Repeated rapid attempts from the same IP strongly suggest someone trying
// to mark attendance for multiple accounts (buddy-punching) from one device.
const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: {
    message: 'Too many attendance scan attempts from this device/network. Please wait a moment.',
  },
});

module.exports = { apiLimiter, loginLimiter, scanLimiter };
