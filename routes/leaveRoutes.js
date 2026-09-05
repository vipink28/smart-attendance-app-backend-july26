// Leave / attendance-regularization requests.
//   Student:  POST /api/leave           (submit a request)
//             GET  /api/leave/mine      (view own requests)
//   Teacher:  GET  /api/leave/class/:classId  (view requests for a class)
//             PATCH /api/leave/:id/review     (approve/reject)
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const leave = require('../controllers/leaveController');

router.post('/', protect, authorize('student'), leave.submitLeaveRequest);
router.get('/mine', protect, authorize('student'), leave.getMyLeaveRequests);
router.get('/class/:classId', protect, authorize('teacher', 'admin'), leave.getClassLeaveRequests);
router.patch('/:id/review', protect, authorize('teacher', 'admin'), leave.reviewLeaveRequest);

module.exports = router;
