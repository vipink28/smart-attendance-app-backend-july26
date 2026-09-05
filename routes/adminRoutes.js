const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const admin = require('../controllers/adminController');

router.use(protect, authorize('admin'));

// Users (teachers/students)
router.post('/users', admin.createUser);
router.get('/users', admin.listUsers);
router.put('/users/:id', admin.updateUser);
router.patch('/users/:id/deactivate', admin.deactivateUser);
router.patch('/users/:id/reactivate', admin.reactivateUser);

// Classes
router.post('/classes', admin.createClass);
router.get('/classes', admin.listClasses);
router.put('/classes/:id', admin.updateClass);
router.patch('/classes/:id/assign-teacher', admin.assignTeacher);
router.patch('/classes/:id/students/add', admin.addStudentToClass);
router.patch('/classes/:id/students/remove', admin.removeStudentFromClass);
router.patch('/classes/:id/deactivate', admin.deactivateClass);

// Audit log
router.get('/audit-logs', admin.getAuditLogs);

module.exports = router;
