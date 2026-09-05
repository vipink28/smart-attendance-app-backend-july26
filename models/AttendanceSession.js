const mongoose = require('mongoose');

// A short-lived rotating token embedded in the QR image. We keep the last
// couple of issued tokens (not just the current one) so a student who
// scanned right as it rotated doesn't get unfairly rejected.
const activeTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    issuedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const attendanceSessionSchema = new mongoose.Schema(
  {
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sessionDate: { type: Date, default: Date.now },

    // Overall session window (e.g. 10 minutes from creation)
    expiresAt: { type: Date, required: true },
    isClosed: { type: Boolean, default: false },

    // Rotating sub-tokens for anti-screenshot-sharing protection
    activeTokens: [activeTokenSchema],

    // Location snapshot the geofence check is measured against.
    // Defaults to the class's fixed location but can be overridden if the
    // teacher generates the QR from their current position instead.
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
  },
  { timestamps: true }
);

attendanceSessionSchema.methods.isLive = function () {
  return !this.isClosed && this.expiresAt > new Date();
};

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
