const cron = require('node-cron');
const Class = require('../models/Class');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const sendEmail = require('../utils/sendEmail');

const THRESHOLD = parseInt(process.env.LOW_ATTENDANCE_THRESHOLD_PERCENT || '75', 10);

async function runLowAttendanceCheck() {
  console.log('[cron] Running low-attendance check...');
  const classes = await Class.find({ isActive: true }).populate('students', 'name email lowAttendanceAlerts');

  for (const cls of classes) {
    const totalSessions = await AttendanceSession.countDocuments({ class: cls._id });
    if (totalSessions === 0) continue; // nothing to evaluate yet

    for (const student of cls.students) {
      if (!student.lowAttendanceAlerts) continue;

      const attended = await AttendanceRecord.countDocuments({
        class: cls._id,
        student: student._id,
      });
      const percentage = Math.round((attended / totalSessions) * 100);

      if (percentage < THRESHOLD) {
        await sendEmail({
          to: student.email,
          subject: `Low attendance warning - ${cls.name}`,
          html: `
            <p>Hi ${student.name},</p>
            <p>Your attendance in <strong>${cls.name}</strong> is currently
            <strong>${percentage}%</strong>, which is below the required
            ${THRESHOLD}%.</p>
            <p>You have attended ${attended} out of ${totalSessions} sessions.</p>
            <p>Please contact your teacher if you believe this is incorrect,
            or submit a regularization request from the app.</p>
          `,
        });
      }
    }
  }
  console.log('[cron] Low-attendance check complete.');
}

function scheduleLowAttendanceCron() {
  const schedule = process.env.LOW_ATTENDANCE_CRON || '0 7 * * *'; // default: daily 7am
  cron.schedule(schedule, runLowAttendanceCheck);
  console.log(`[cron] Low-attendance email job scheduled: "${schedule}"`);
}

module.exports = { scheduleLowAttendanceCron, runLowAttendanceCheck };
