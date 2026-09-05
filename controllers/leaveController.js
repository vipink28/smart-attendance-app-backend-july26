const asyncHandler = require('../utils/asyncHandler');
const LeaveRequest = require('../models/LeaveRequest');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceSession = require('../models/AttendanceSession');
const Class = require('../models/Class');

// @desc    Student submits a regularization request (e.g. "scan failed but I was present")
// @route   POST /api/leave
// @access  Student
const submitLeaveRequest = asyncHandler(async (req, res) => {
  const { classId, date, reason, relatedSessionId } = req.body;

  const cls = await Class.findOne({ _id: classId, students: req.user._id });
  if (!cls) return res.status(404).json({ message: 'Class not found or you are not enrolled' });

  const leave = await LeaveRequest.create({
    student: req.user._id,
    class: classId,
    date,
    reason,
    relatedSession: relatedSessionId || undefined,
  });

  res.status(201).json({ leaveRequest: leave });
});

// @desc    Student views their own leave/regularization requests
// @route   GET /api/leave/mine
// @access  Student
const getMyLeaveRequests = asyncHandler(async (req, res) => {
  const requests = await LeaveRequest.find({ student: req.user._id })
    .populate('class', 'name code')
    .sort({ createdAt: -1 });
  res.json({ requests });
});

// @desc    Teacher views pending/all leave requests for their classes
// @route   GET /api/leave/class/:classId
// @access  Teacher
const getClassLeaveRequests = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({ _id: req.params.classId, teacher: req.user._id });
  if (!cls) return res.status(404).json({ message: 'Class not found or not assigned to you' });

  const filter = { class: cls._id };
  if (req.query.status) filter.status = req.query.status;

  const requests = await LeaveRequest.find(filter)
    .populate('student', 'name studentId email')
    .sort({ createdAt: -1 });

  res.json({ requests });
});

// @desc    Teacher approves or rejects a leave/regularization request
// @route   PATCH /api/leave/:id/review
// @access  Teacher
const reviewLeaveRequest = asyncHandler(async (req, res) => {
  const { decision, reviewNote } = req.body; // decision: 'approved' | 'rejected'

  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ message: "decision must be 'approved' or 'rejected'" });
  }

  const leave = await LeaveRequest.findById(req.params.id).populate('class');
  if (!leave) return res.status(404).json({ message: 'Leave request not found' });

  if (leave.class.teacher.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'You do not teach this class' });
  }
  if (leave.status !== 'pending') {
    return res.status(409).json({ message: 'This request has already been reviewed' });
  }

  leave.status = decision;
  leave.reviewedBy = req.user._id;
  leave.reviewNote = reviewNote;
  leave.reviewedAt = new Date();
  await leave.save();

  // On approval: if it relates to a specific session and no attendance
  // record exists yet, create one marked as 'regularized'.
  if (decision === 'approved' && leave.relatedSession) {
    const alreadyMarked = await AttendanceRecord.findOne({
      session: leave.relatedSession,
      student: leave.student,
    });

    if (!alreadyMarked) {
      const session = await AttendanceSession.findById(leave.relatedSession);
      if (session) {
        await AttendanceRecord.create({
          session: session._id,
          class: leave.class._id,
          student: leave.student,
          location: { lat: session.location.lat, lng: session.location.lng },
          distanceMeters: 0,
          status: 'regularized',
          regularizedFrom: leave._id,
        });
      }
    }
  }

  res.json({ leaveRequest: leave });
});

module.exports = {
  submitLeaveRequest,
  getMyLeaveRequests,
  getClassLeaveRequests,
  reviewLeaveRequest,
};
