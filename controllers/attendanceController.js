const asyncHandler = require('../utils/asyncHandler');
const Class = require('../models/Class');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const { createSessionToken, verifySessionToken, generateQRImage } = require('../utils/generateQR');
const { getDistanceMeters } = require('../utils/haversine');

const SESSION_MINUTES = parseInt(process.env.ATTENDANCE_SESSION_MINUTES || '10', 10);
const MAX_DISTANCE = parseInt(process.env.MAX_ALLOWED_DISTANCE_METERS || '50', 10);
const MAX_ACCURACY = parseInt(process.env.MAX_ALLOWED_GPS_ACCURACY_METERS || '100', 10);

/* --------------------------- TEACHER ACTIONS ---------------------------- */

// @desc    Teacher starts a new attendance session (opens the QR window)
// @route   POST /api/attendance/sessions
// @access  Teacher
const createSession = asyncHandler(async (req, res) => {
  const { classId, useMyCurrentLocation, lat, lng } = req.body;

  const cls = await Class.findOne({ _id: classId, isActive: true });
  if (!cls) return res.status(404).json({ message: 'Class not found' });

  if (cls.teacher?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You are not assigned to this class' });
  }

  // Prevent opening two live sessions for the same class at once
  const existingLive = await AttendanceSession.findOne({
    class: classId,
    isClosed: false,
    expiresAt: { $gt: new Date() },
  });
  if (existingLive) {
    return res.status(409).json({ message: 'A live session already exists for this class' });
  }

  const location =
    useMyCurrentLocation && lat !== undefined && lng !== undefined
      ? { lat, lng }
      : cls.location;

  const now = new Date();
  const session = await AttendanceSession.create({
    class: cls._id,
    createdBy: req.user._id,
    sessionDate: now,
    expiresAt: new Date(now.getTime() + SESSION_MINUTES * 60 * 1000),
    location,
    activeTokens: [],
  });

  const { token, issuedAt, expiresAt } = createSessionToken(session._id);
  session.activeTokens.push({ token, issuedAt, expiresAt });
  await session.save();

  const { dataUrl, scanUrl } = await generateQRImage(token);

  res.status(201).json({
    session: {
      _id: session._id,
      class: session.class,
      sessionDate: session.sessionDate,
      expiresAt: session.expiresAt,
    },
    qr: { dataUrl, scanUrl, tokenExpiresAt: expiresAt },
  });
});

// @desc    Refresh/rotate the QR token for a live session (poll every ~30s)
// @route   GET /api/attendance/sessions/:id/qr
// @access  Teacher
const getCurrentQR = asyncHandler(async (req, res) => {
  const session = await AttendanceSession.findById(req.params.id);
  if (!session) return res.status(404).json({ message: 'Session not found' });

  if (!session.isLive()) {
    return res.status(410).json({ message: 'Session has expired or been closed' });
  }

  const { token, issuedAt, expiresAt } = createSessionToken(session._id);

  // Keep only unexpired tokens + the new one (avoid unbounded growth)
  const now = new Date();
  session.activeTokens = session.activeTokens.filter((t) => t.expiresAt > now);
  session.activeTokens.push({ token, issuedAt, expiresAt });
  await session.save();

  const { dataUrl, scanUrl } = await generateQRImage(token);

  res.json({
    qr: { dataUrl, scanUrl, tokenExpiresAt: expiresAt },
    sessionExpiresAt: session.expiresAt,
  });
});

// @desc    Teacher manually closes a session early
// @route   PATCH /api/attendance/sessions/:id/close
// @access  Teacher
const closeSession = asyncHandler(async (req, res) => {
  const session = await AttendanceSession.findById(req.params.id);
  if (!session) return res.status(404).json({ message: 'Session not found' });

  session.isClosed = true;
  await session.save();

  res.json({ message: 'Session closed' });
});

// @desc    Live view of who has scanned in for an open session
// @route   GET /api/attendance/sessions/:id/status
// @access  Teacher
const getSessionStatus = asyncHandler(async (req, res) => {
  const session = await AttendanceSession.findById(req.params.id).populate('class');
  if (!session) return res.status(404).json({ message: 'Session not found' });

  const records = await AttendanceRecord.find({ session: session._id }).populate(
    'student',
    'name studentId'
  );

  const totalStudents = session.class.students.length;

  res.json({
    session: {
      _id: session._id,
      isLive: session.isLive(),
      expiresAt: session.expiresAt,
    },
    totalStudents,
    presentCount: records.length,
    records,
  });
});

/* --------------------------- STUDENT ACTION ----------------------------- */

// @desc    Student scans the QR to mark attendance (geofenced + anti-proxy)
// @route   POST /api/attendance/scan
// @access  Student
const scanAttendance = asyncHandler(async (req, res) => {
  const { token, lat, lng, accuracy } = req.body;

  if (!token || lat === undefined || lng === undefined) {
    return res.status(400).json({ message: 'token, lat and lng are required' });
  }

  // 1. Verify + decode the rotating QR token
  let decoded;
  try {
    decoded = verifySessionToken(token);
  } catch (err) {
    return res.status(410).json({ message: 'QR code has expired. Ask your teacher to refresh it.' });
  }

  const session = await AttendanceSession.findById(decoded.sessionId).populate('class');
  if (!session) return res.status(404).json({ message: 'Attendance session not found' });

  if (!session.isLive()) {
    return res.status(410).json({ message: 'This attendance session has ended' });
  }

  // Confirm this exact token is still one of the currently valid ones
  // (protects against a token minted for a previous rotation being replayed)
  const matchingToken = session.activeTokens.find(
    (t) => t.token === token && t.expiresAt > new Date()
  );
  if (!matchingToken) {
    return res.status(410).json({ message: 'QR code has expired. Please rescan the latest code.' });
  }

  // 2. Confirm the student actually belongs to this class
  const isEnrolled = session.class.students.some(
    (s) => s.toString() === req.user._id.toString()
  );
  if (!isEnrolled) {
    return res.status(403).json({ message: 'You are not enrolled in this class' });
  }

  // 3. Anti-proxy check: reject low-quality GPS accuracy readings.
  // A large accuracy radius means the device itself isn't sure where it is
  // (e.g. indoors, spoofed, or a stale cached fix), so we can't trust the
  // distance calculation below.
  if (accuracy !== undefined && accuracy > MAX_ACCURACY) {
    return res.status(400).json({
      message: `Location signal too weak/unreliable (accuracy ${Math.round(
        accuracy
      )}m). Move to an open area and try again.`,
    });
  }

  // 4. Geofence check - must be within the allowed radius of the classroom
  const distance = getDistanceMeters(session.location, { lat, lng });
  if (distance > MAX_DISTANCE) {
    return res.status(403).json({
      message: `You are ${Math.round(distance)}m from the classroom. Must be within ${MAX_DISTANCE}m to mark attendance.`,
      distanceMeters: Math.round(distance),
      maxDistanceMeters: MAX_DISTANCE,
    });
  }

  // 5. Prevent duplicate marking (also enforced by unique DB index)
  const existing = await AttendanceRecord.findOne({ session: session._id, student: req.user._id });
  if (existing) {
    return res.status(409).json({ message: 'Attendance already marked for this session' });
  }

  try {
    const record = await AttendanceRecord.create({
      session: session._id,
      class: session.class._id,
      student: req.user._id,
      location: { lat, lng, accuracy },
      distanceMeters: Math.round(distance),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ message: 'Attendance marked successfully', record });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Attendance already marked for this session' });
    }
    throw err;
  }
});

module.exports = {
  createSession,
  getCurrentQR,
  closeSession,
  getSessionStatus,
  scanAttendance,
};
