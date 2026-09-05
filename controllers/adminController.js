const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Class = require('../models/Class');
const { logAction } = require('../utils/auditLogger');

/* ------------------------------- USERS -------------------------------- */

// @desc    Create a teacher or student account (no public self-registration)
// @route   POST /api/admin/users
// @access  Admin
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, employeeId, studentId, phone } = req.body;

  if (!['teacher', 'student', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    employeeId: role === 'teacher' ? employeeId : undefined,
    studentId: role === 'student' ? studentId : undefined,
    phone,
    createdBy: req.user._id,
  });

  await logAction({
    action: 'CREATE_USER',
    performedBy: req.user._id,
    targetType: 'User',
    targetId: user._id,
    details: { role: user.role, email: user.email },
    ip: req.ip,
  });

  res.status(201).json({ user: user.toSafeObject() });
});

// @desc    List users, optionally filtered by role / active status
// @route   GET /api/admin/users?role=teacher&isActive=true
// @access  Admin
const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json({ users });
});

// @desc    Update a user's details
// @route   PUT /api/admin/users/:id
// @access  Admin
const updateUser = asyncHandler(async (req, res) => {
  const { name, phone, employeeId, studentId, lowAttendanceAlerts } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (employeeId !== undefined) user.employeeId = employeeId;
  if (studentId !== undefined) user.studentId = studentId;
  if (lowAttendanceAlerts !== undefined) user.lowAttendanceAlerts = lowAttendanceAlerts;

  await user.save();

  await logAction({
    action: 'UPDATE_USER',
    performedBy: req.user._id,
    targetType: 'User',
    targetId: user._id,
    details: req.body,
    ip: req.ip,
  });

  res.json({ user: user.toSafeObject() });
});

// @desc    Soft-delete (deactivate) a user - preserves attendance history
// @route   PATCH /api/admin/users/:id/deactivate
// @access  Admin
const deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.isActive = false;
  await user.save();

  await logAction({
    action: 'DEACTIVATE_USER',
    performedBy: req.user._id,
    targetType: 'User',
    targetId: user._id,
    ip: req.ip,
  });

  res.json({ message: 'User deactivated', user: user.toSafeObject() });
});

// @desc    Reactivate a previously deactivated user
// @route   PATCH /api/admin/users/:id/reactivate
// @access  Admin
const reactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.isActive = true;
  await user.save();

  await logAction({
    action: 'REACTIVATE_USER',
    performedBy: req.user._id,
    targetType: 'User',
    targetId: user._id,
    ip: req.ip,
  });

  res.json({ message: 'User reactivated', user: user.toSafeObject() });
});

/* ------------------------------- CLASSES -------------------------------- */

// @desc    Create a class
// @route   POST /api/admin/classes
// @access  Admin
const createClass = asyncHandler(async (req, res) => {
  const { name, code, teacher, students, schedule, location } = req.body;

  if (!location || location.lat === undefined || location.lng === undefined) {
    return res.status(400).json({ message: 'Class location (lat, lng) is required for geofencing' });
  }

  const newClass = await Class.create({
    name,
    code,
    teacher,
    students: students || [],
    schedule: schedule || [],
    location,
    createdBy: req.user._id,
  });

  await logAction({
    action: 'CREATE_CLASS',
    performedBy: req.user._id,
    targetType: 'Class',
    targetId: newClass._id,
    details: { name, code },
    ip: req.ip,
  });

  res.status(201).json({ class: newClass });
});

// @desc    List classes
// @route   GET /api/admin/classes
// @access  Admin
const listClasses = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const classes = await Class.find(filter)
    .populate('teacher', 'name email employeeId')
    .populate('students', 'name email studentId')
    .sort({ createdAt: -1 });

  res.json({ classes });
});

// @desc    Update class details (name, schedule, location, etc.)
// @route   PUT /api/admin/classes/:id
// @access  Admin
const updateClass = asyncHandler(async (req, res) => {
  const { name, schedule, location } = req.body;
  const cls = await Class.findById(req.params.id);
  if (!cls) return res.status(404).json({ message: 'Class not found' });

  if (name !== undefined) cls.name = name;
  if (schedule !== undefined) cls.schedule = schedule;
  if (location !== undefined) cls.location = location;

  await cls.save();

  await logAction({
    action: 'UPDATE_CLASS',
    performedBy: req.user._id,
    targetType: 'Class',
    targetId: cls._id,
    details: req.body,
    ip: req.ip,
  });

  res.json({ class: cls });
});

// @desc    Assign / reassign a teacher to a class
// @route   PATCH /api/admin/classes/:id/assign-teacher
// @access  Admin
const assignTeacher = asyncHandler(async (req, res) => {
  const { teacherId } = req.body;
  const cls = await Class.findById(req.params.id);
  if (!cls) return res.status(404).json({ message: 'Class not found' });

  const teacher = await User.findOne({ _id: teacherId, role: 'teacher' });
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

  cls.teacher = teacher._id;
  await cls.save();

  await logAction({
    action: 'ASSIGN_TEACHER',
    performedBy: req.user._id,
    targetType: 'Class',
    targetId: cls._id,
    details: { teacherId },
    ip: req.ip,
  });

  res.json({ class: cls });
});

// @desc    Add a student to a class
// @route   PATCH /api/admin/classes/:id/students/add
// @access  Admin
const addStudentToClass = asyncHandler(async (req, res) => {
  const { studentId } = req.body;
  const cls = await Class.findById(req.params.id);
  if (!cls) return res.status(404).json({ message: 'Class not found' });

  const student = await User.findOne({ _id: studentId, role: 'student' });
  if (!student) return res.status(404).json({ message: 'Student not found' });

  if (cls.students.includes(student._id)) {
    return res.status(409).json({ message: 'Student already in class' });
  }

  cls.students.push(student._id);
  await cls.save();

  await logAction({
    action: 'ADD_STUDENT_TO_CLASS',
    performedBy: req.user._id,
    targetType: 'Class',
    targetId: cls._id,
    details: { studentId },
    ip: req.ip,
  });

  res.json({ class: cls });
});

// @desc    Remove a student from a class (attendance history is preserved)
// @route   PATCH /api/admin/classes/:id/students/remove
// @access  Admin
const removeStudentFromClass = asyncHandler(async (req, res) => {
  const { studentId } = req.body;
  const cls = await Class.findById(req.params.id);
  if (!cls) return res.status(404).json({ message: 'Class not found' });

  cls.students = cls.students.filter((s) => s.toString() !== studentId);
  await cls.save();

  await logAction({
    action: 'REMOVE_STUDENT_FROM_CLASS',
    performedBy: req.user._id,
    targetType: 'Class',
    targetId: cls._id,
    details: { studentId },
    ip: req.ip,
  });

  res.json({ class: cls });
});

// @desc    Soft-delete (deactivate) a class
// @route   PATCH /api/admin/classes/:id/deactivate
// @access  Admin
const deactivateClass = asyncHandler(async (req, res) => {
  const cls = await Class.findById(req.params.id);
  if (!cls) return res.status(404).json({ message: 'Class not found' });

  cls.isActive = false;
  await cls.save();

  await logAction({
    action: 'DEACTIVATE_CLASS',
    performedBy: req.user._id,
    targetType: 'Class',
    targetId: cls._id,
    ip: req.ip,
  });

  res.json({ message: 'Class deactivated', class: cls });
});

/* ------------------------------ AUDIT LOG ------------------------------- */

// @desc    View audit logs (who did what, when)
// @route   GET /api/admin/audit-logs
// @access  Admin
const AuditLog = require('../models/AuditLog');
const getAuditLogs = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find()
    .populate('performedBy', 'name email role')
    .sort({ createdAt: -1 })
    .limit(500);
  res.json({ logs });
});

module.exports = {
  createUser,
  listUsers,
  updateUser,
  deactivateUser,
  reactivateUser,
  createClass,
  listClasses,
  updateClass,
  assignTeacher,
  addStudentToClass,
  removeStudentFromClass,
  deactivateClass,
  getAuditLogs,
};
