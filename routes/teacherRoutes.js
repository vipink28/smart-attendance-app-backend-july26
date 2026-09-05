const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");
const teacher = require("../controllers/teacherController");

router.use(protect, authorize("teacher", "admin"));

router.get("/classes", teacher.getMyClasses);
router.get("/classes/:id", teacher.getSingleClass);
router.patch("/classes/:id/students/add", teacher.addStudentToClass);
router.patch("/classes/:id/students/remove", teacher.removeStudentFromClass);
router.get("/classes/:id/attendance", teacher.getClassAttendance);
router.get(
  "/classes/:id/students/:studentId/attendance",
  teacher.getStudentAttendance,
);
router.get("/classes/:id/defaulters", teacher.getDefaulters);

// Leave/regularization requests live under /api/leave (see leaveRoutes.js)

module.exports = router;
