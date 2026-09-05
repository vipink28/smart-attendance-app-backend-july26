const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

/**
 * Converts an array of flattened attendance rows into a CSV string.
 * Expected row shape: { studentName, studentId, className, date, status, markedAt }
 */
function recordsToCSV(rows) {
  const fields = ['studentName', 'studentId', 'className', 'date', 'status', 'markedAt'];
  const parser = new Parser({ fields });
  return parser.parse(rows);
}

/**
 * Streams a simple tabular PDF report directly to the HTTP response.
 */
function recordsToPDF(res, { title, rows }) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).text(title, { align: 'center' });
  doc.moveDown();

  const colWidths = [130, 90, 110, 80, 70, 80];
  const headers = ['Student', 'Student ID', 'Class', 'Date', 'Status', 'Marked At'];
  let y = doc.y;

  doc.fontSize(10).font('Helvetica-Bold');
  let x = doc.x;
  headers.forEach((h, i) => {
    doc.text(h, x, y, { width: colWidths[i], continued: false });
    x += colWidths[i];
  });

  doc.moveDown(0.5);
  doc.font('Helvetica');

  rows.forEach((row) => {
    y = doc.y;
    if (y > 750) {
      doc.addPage();
      y = doc.y;
    }
    x = doc.x;
    const values = [
      row.studentName,
      row.studentId || '-',
      row.className,
      row.date,
      row.status,
      row.markedAt || '-',
    ];
    values.forEach((val, i) => {
      doc.text(String(val), x, y, { width: colWidths[i] });
      x += colWidths[i];
    });
    doc.moveDown(0.3);
  });

  doc.end();
}

module.exports = { recordsToCSV, recordsToPDF };
