const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const report = require('../controllers/reportController');

router.use(protect, authorize('teacher', 'admin'));

router.get('/class/:id/csv', report.exportClassCSV);
router.get('/class/:id/pdf', report.exportClassPDF);
router.get('/class/:id/summary', report.getClassSummary);

module.exports = router;
