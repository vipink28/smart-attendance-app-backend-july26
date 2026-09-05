const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },

    // The session this request relates to, if the class already had one
    // that day (e.g. "I was in class but my scan failed").
    relatedSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSession' },

    date: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String, trim: true },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
