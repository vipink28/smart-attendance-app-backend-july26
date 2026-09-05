const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { scanLimiter } = require('../middleware/rateLimiter');
const attendance = require('../controllers/attendanceController');

// Teacher/Admin: open + manage a live QR session
router.post('/sessions', protect, authorize('teacher', 'admin'), attendance.createSession);
router.get('/sessions/:id/qr', protect, authorize('teacher', 'admin'), attendance.getCurrentQR);
router.patch('/sessions/:id/close', protect, authorize('teacher', 'admin'), attendance.closeSession);
router.get('/sessions/:id/status', protect, authorize('teacher', 'admin'), attendance.getSessionStatus);

// Student: scan the QR (rate-limited as an anti-proxy measure)
router.post('/scan', protect, authorize('student'), scanLimiter, attendance.scanAttendance);

module.exports = router;
