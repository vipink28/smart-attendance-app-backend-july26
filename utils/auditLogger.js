const AuditLog = require('../models/AuditLog');

/**
 * Fire-and-forget audit log write. Never blocks or throws into the caller's
 * request flow - an audit log failure shouldn't fail the actual operation.
 */
async function logAction({ action, performedBy, targetType, targetId, details, ip }) {
  try {
    await AuditLog.create({ action, performedBy, targetType, targetId, details, ip });
  } catch (err) {
    console.error(`Audit log failed [${action}]: ${err.message}`);
  }
}

module.exports = { logAction };
