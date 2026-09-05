const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    markedAt: { type: Date, default: Date.now },

    // Geo + anti-proxy metadata captured at scan time
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      accuracy: { type: Number }, // meters, from navigator.geolocation
    },
    distanceMeters: { type: Number, required: true },

    status: {
      type: String,
      enum: ['present', 'late', 'regularized'],
      default: 'present',
    },

    // Anti-proxy audit trail
    ip: { type: String },
    userAgent: { type: String },

    // Set when attendance was approved via a leave/regularization request
    // rather than an actual scan.
    regularizedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveRequest' },
  },
  { timestamps: true }
);

// A student can only have ONE attendance record per session - enforced at
// the DB level, not just in application logic.
attendanceRecordSchema.index({ session: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
