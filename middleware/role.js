/**
 * Usage: router.get('/path', protect, authorize('admin', 'teacher'), handler)
 * Must run AFTER `protect` so req.user is populated.
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: `Role '${req.user.role}' is not permitted to perform this action`,
    });
  }
  next();
};

module.exports = { authorize };
