const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ['admin', 'teacher', 'student'],
      required: true,
    },
    // Only one of these will typically be set depending on role
    employeeId: { type: String, trim: true, sparse: true, unique: true },
    studentId: { type: String, trim: true, sparse: true, unique: true },
    phone: { type: String, trim: true },

    // Soft delete - never hard-remove a user so historical attendance
    // records / audit logs / relations remain valid.
    isActive: { type: Boolean, default: true },

    // Who created this account (admin only creates accounts - no public signup)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Email notification preferences
    lowAttendanceAlerts: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
