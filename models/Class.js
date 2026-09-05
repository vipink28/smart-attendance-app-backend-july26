const mongoose = require('mongoose');

const scheduleSlotSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      required: true,
    },
    startTime: { type: String, required: true }, // "09:00" 24hr format
    endTime: { type: String, required: true }, // "10:00"
  },
  { _id: false }
);

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    schedule: [scheduleSlotSchema],

    // Fixed classroom location used for the 50m geofence check.
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },

    isActive: { type: Boolean, default: true }, // soft delete
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Class', classSchema);
