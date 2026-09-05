const asyncHandler = require('../utils/asyncHandler');
const Class = require('../models/Class');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const { recordsToCSV, recordsToPDF } = require('../utils/exportUtils');

/**
 * Shared helper: builds flattened, exportable rows for a class's attendance.
 * Access control (which classes the requester may query) is enforced by
 * the calling route/controller layer via the `authorize` + class-ownership
 * checks already present on teacher/admin routes.
 */
async function buildClassReportRows(classId) {
  const cls = await Class.findById(classId);
  const sessions = await AttendanceSession.find({ class: classId }).sort({ sessionDate: 1 });
  const sessionIds = sessions.map((s) => s._id);

  const records = await AttendanceRecord.find({ session: { $in: sessionIds } })
    .populate('student', 'name studentId')
    .populate('session', 'sessionDate');

  return records.map((r) => ({
    studentName: r.student?.name || 'Unknown',
    studentId: r.student?.studentId || '-',
    className: cls?.name || '-',
    date: r.session?.sessionDate ? new Date(r.session.sessionDate).toLocaleDateString() : '-',
    status: r.status,
    markedAt: new Date(r.markedAt).toLocaleTimeString(),
  }));
}

// @desc    Export a class's full attendance history as CSV
// @route   GET /api/reports/class/:id/csv
// @access  Teacher/Admin
const exportClassCSV = asyncHandler(async (req, res) => {
  const rows = await buildClassReportRows(req.params.id);
  const csv = recordsToCSV(rows);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.csv"');
  res.send(csv);
});

// @desc    Export a class's full attendance history as PDF
// @route   GET /api/reports/class/:id/pdf
// @access  Teacher/Admin
const exportClassPDF = asyncHandler(async (req, res) => {
  const cls = await Class.findById(req.params.id);
  const rows = await buildClassReportRows(req.params.id);
  recordsToPDF(res, { title: `${cls?.name || 'Class'} Attendance Report`, rows });
});

// @desc    Dashboard analytics for a class: overall %, trend over sessions,
//          and per-student breakdown - feeds recharts on the frontend.
// @route   GET /api/reports/class/:id/summary
// @access  Teacher/Admin
const getClassSummary = asyncHandler(async (req, res) => {
  const cls = await Class.findById(req.params.id).populate('students', 'name studentId');
  if (!cls) return res.status(404).json({ message: 'Class not found' });

  const sessions = await AttendanceSession.find({ class: cls._id }).sort({ sessionDate: 1 });
  const totalSessions = sessions.length;

  // Trend: present count per session (for a line/bar chart over time)
  const trend = [];
  for (const session of sessions) {
    const count = await AttendanceRecord.countDocuments({ session: session._id });
    trend.push({
      date: session.sessionDate,
      presentCount: count,
      totalStudents: cls.students.length,
    });
  }

  // Per-student breakdown (for defaulter list / bar chart)
  const perStudent = [];
  for (const student of cls.students) {
    const attended = await AttendanceRecord.countDocuments({
      class: cls._id,
      student: student._id,
    });
    const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
    perStudent.push({ student, attended, totalSessions, percentage });
  }

  const overallPercentage =
    perStudent.length > 0
      ? Math.round(perStudent.reduce((sum, s) => sum + s.percentage, 0) / perStudent.length)
      : 0;

  res.json({
    className: cls.name,
    totalSessions,
    overallPercentage,
    trend,
    perStudent,
  });
});

module.exports = { exportClassCSV, exportClassPDF, getClassSummary };
