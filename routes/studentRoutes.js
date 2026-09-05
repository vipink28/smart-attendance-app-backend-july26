const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const student = require('../controllers/studentController');

router.use(protect, authorize('student'));

router.get('/classes', student.getMyClasses);
router.get('/timetable', student.getTodayTimetable);
router.get('/attendance', student.getMyAttendance);

// Leave/regularization requests live under /api/leave (see leaveRoutes.js)

module.exports = router;
