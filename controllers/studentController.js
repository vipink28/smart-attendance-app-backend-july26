const asyncHandler = require('../utils/asyncHandler');
const Class = require('../models/Class');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');

// @desc    Get classes the logged-in student is enrolled in (with schedule)
// @route   GET /api/student/classes
// @access  Student
const getMyClasses = asyncHandler(async (req, res) => {
  const classes = await Class.find({ students: req.user._id, isActive: true }).populate(
    'teacher',
    'name email'
  );
  res.json({ classes });
});

// @desc    Today's timetable + whether a live QR session is currently open
// @route   GET /api/student/timetable
// @access  Student
const getTodayTimetable = asyncHandler(async (req, res) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = days[new Date().getDay()];

  const classes = await Class.find({ students: req.user._id, isActive: true }).populate(
    'teacher',
    'name'
  );

  const todaysClasses = [];
  for (const cls of classes) {
    const slots = cls.schedule.filter((s) => s.day === today);
    if (slots.length === 0) continue;

    const liveSession = await AttendanceSession.findOne({
      class: cls._id,
      isClosed: false,
      expiresAt: { $gt: new Date() },
    });

    todaysClasses.push({
      classId: cls._id,
      name: cls.name,
      code: cls.code,
      teacher: cls.teacher,
      slots,
      liveSessionId: liveSession ? liveSession._id : null,
    });
  }

  res.json({ today, classes: todaysClasses });
});

// @desc    Student's own attendance history + percentage, per class (or all)
// @route   GET /api/student/attendance?classId=
// @access  Student
const getMyAttendance = asyncHandler(async (req, res) => {
  const classFilter = req.query.classId
    ? { _id: req.query.classId, students: req.user._id }
    : { students: req.user._id };

  const classes = await Class.find(classFilter);

  const results = [];
  for (const cls of classes) {
    const totalSessions = await AttendanceSession.countDocuments({ class: cls._id });
    const records = await AttendanceRecord.find({
      class: cls._id,
      student: req.user._id,
    }).sort({ markedAt: -1 });

    const percentage = totalSessions > 0 ? Math.round((records.length / totalSessions) * 100) : 0;

    results.push({
      classId: cls._id,
      className: cls.name,
      totalSessions,
      attendedSessions: records.length,
      percentage,
      records,
    });
  }

  res.json({ attendance: results });
});

module.exports = { getMyClasses, getTodayTimetable, getMyAttendance };
