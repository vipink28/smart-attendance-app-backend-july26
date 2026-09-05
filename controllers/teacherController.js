const asyncHandler = require("../utils/asyncHandler");
const Class = require("../models/Class");
const User = require("../models/User");
const AttendanceSession = require("../models/AttendanceSession");
const AttendanceRecord = require("../models/AttendanceRecord");

const LOW_ATTENDANCE_THRESHOLD = parseInt(
  process.env.LOW_ATTENDANCE_THRESHOLD_PERCENT || "75",
  10,
);

// @desc    Get classes assigned to the logged-in teacher
// @route   GET /api/teacher/classes
// @access  Teacher
const getMyClasses = asyncHandler(async (req, res) => {
  const classes = await Class.find({
    teacher: req.user._id,
    isActive: true,
  }).populate("students", "name email studentId");
  res.json({ classes });
});

const getSingleClass = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({
    _id: req.params.id,
    teacher: req.user._id,
    isActive: true,
  })
    .populate("teacher", "name email")
    .populate("students", "name email studentId");

  if (!cls) {
    return res
      .status(404)
      .json({ message: "Class not found or not assigned to you" });
  }

  res.json({ class: cls });
});

// @desc    Add a student to one of the teacher's own classes
// @route   PATCH /api/teacher/classes/:id/students/add
// @access  Teacher
const addStudentToClass = asyncHandler(async (req, res) => {
  const { studentId } = req.body;
  const cls = await Class.findOne({
    _id: req.params.id,
    teacher: req.user._id,
  });
  if (!cls)
    return res
      .status(404)
      .json({ message: "Class not found or not assigned to you" });

  const student = await User.findOne({
    _id: studentId,
    role: "student",
    isActive: true,
  });
  if (!student) return res.status(404).json({ message: "Student not found" });

  if (cls.students.includes(student._id)) {
    return res.status(409).json({ message: "Student already in class" });
  }

  cls.students.push(student._id);
  await cls.save();
  res.json({ class: cls });
});

// @desc    Remove a student from one of the teacher's own classes
// @route   PATCH /api/teacher/classes/:id/students/remove
// @access  Teacher
const removeStudentFromClass = asyncHandler(async (req, res) => {
  const { studentId } = req.body;
  const cls = await Class.findOne({
    _id: req.params.id,
    teacher: req.user._id,
  });
  if (!cls)
    return res
      .status(404)
      .json({ message: "Class not found or not assigned to you" });

  cls.students = cls.students.filter((s) => s.toString() !== studentId);
  await cls.save();
  res.json({ class: cls });
});

// @desc    Attendance records for a whole class (optionally filtered by date range)
// @route   GET /api/teacher/classes/:id/attendance?from=&to=
// @access  Teacher
const getClassAttendance = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({
    _id: req.params.id,
    teacher: req.user._id,
  });
  if (!cls)
    return res
      .status(404)
      .json({ message: "Class not found or not assigned to you" });

  const sessionFilter = { class: cls._id };
  if (req.query.from || req.query.to) {
    sessionFilter.sessionDate = {};
    if (req.query.from)
      sessionFilter.sessionDate.$gte = new Date(req.query.from);
    if (req.query.to) sessionFilter.sessionDate.$lte = new Date(req.query.to);
  }

  const sessions = await AttendanceSession.find(sessionFilter).sort({
    sessionDate: -1,
  });
  const sessionIds = sessions.map((s) => s._id);

  const records = await AttendanceRecord.find({ session: { $in: sessionIds } })
    .populate("student", "name studentId email")
    .populate("session", "sessionDate");

  res.json({ totalSessions: sessions.length, records });
});

// @desc    Attendance history for a single student within a class
// @route   GET /api/teacher/classes/:id/students/:studentId/attendance
// @access  Teacher
const getStudentAttendance = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({
    _id: req.params.id,
    teacher: req.user._id,
  });
  if (!cls)
    return res
      .status(404)
      .json({ message: "Class not found or not assigned to you" });

  const totalSessions = await AttendanceSession.countDocuments({
    class: cls._id,
  });
  const records = await AttendanceRecord.find({
    class: cls._id,
    student: req.params.studentId,
  }).sort({ markedAt: -1 });

  const percentage =
    totalSessions > 0 ? Math.round((records.length / totalSessions) * 100) : 0;

  res.json({
    totalSessions,
    attendedSessions: records.length,
    percentage,
    records,
  });
});

// @desc    List students below the attendance threshold for a class
// @route   GET /api/teacher/classes/:id/defaulters
// @access  Teacher
const getDefaulters = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({
    _id: req.params.id,
    teacher: req.user._id,
  }).populate("students", "name email studentId");
  if (!cls)
    return res
      .status(404)
      .json({ message: "Class not found or not assigned to you" });

  const totalSessions = await AttendanceSession.countDocuments({
    class: cls._id,
  });

  const defaulters = [];
  for (const student of cls.students) {
    const attended = await AttendanceRecord.countDocuments({
      class: cls._id,
      student: student._id,
    });
    const percentage =
      totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 100;
    if (percentage < LOW_ATTENDANCE_THRESHOLD) {
      defaulters.push({ student, attended, totalSessions, percentage });
    }
  }

  res.json({ threshold: LOW_ATTENDANCE_THRESHOLD, defaulters });
});

module.exports = {
  getMyClasses,
  addStudentToClass,
  removeStudentFromClass,
  getClassAttendance,
  getStudentAttendance,
  getDefaulters,
  getSingleClass,
};
