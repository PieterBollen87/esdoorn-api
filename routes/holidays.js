// routes/holidays.js
const express = require('express');
const router = express.Router();
const db = require('../db');

/* Helper – turn DB row into API object (adds doctor name) */
function toApi(row, req) {
  const host = `${req.protocol}://${req.get('host')}`;
  return {
    id: row.id,
    doctorId: row.doctorId,
    doctorName: row.doctorName,
    startDate: row.startDate,
    endDate: row.endDate
  };
}

/* GET /holidays – list all holiday entries */
router.get('/', (req, res) => {
  const sql = `
    SELECT h.id, h.doctorId, d.firstname || ' ' || d.lastname AS doctorName,
           h.startDate, h.endDate
    FROM holidays h
    JOIN doctors d ON d.id = h.doctorId
    ORDER BY h.startDate DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const result = rows.map(r => toApi(r, req));
    res.json(result);
  });
});

/* GET /holidays/:id – single entry */
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const sql = `
    SELECT h.id, h.doctorId, d.firstname || ' ' || d.lastname AS doctorName,
           h.startDate, h.endDate
    FROM holidays h
    JOIN doctors d ON d.id = h.doctorId
    WHERE h.id = ?
  `;
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Holiday not found' });
    res.json(toApi(row, req));
  });
});

/* POST /holidays – create a new holiday entry */
router.post('/', express.json(), (req, res) => {
  const { doctorId, startDate, endDate } = req.body;
  if (!doctorId || !startDate || !endDate) {
    return res.status(400).json({ error: 'doctorId, startDate and endDate required' });
  }
  const sql = `
    INSERT INTO holidays (doctorId, startDate, endDate)
    VALUES (?, ?, ?)
  `;
  db.run(sql, [doctorId, startDate, endDate], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    // Return the freshly created row (including doctor name)
    db.get(
      `SELECT h.id, h.doctorId,
              d.firstname || ' ' || d.lastname AS doctorName,
              h.startDate, h.endDate
       FROM holidays h
       JOIN doctors d ON d.id = h.doctorId
       WHERE h.id = ?`,
      [this.lastID],
      (e, row) => {
        if (e) return res.status(500).json({ error: e.message });
        res.status(201).json(toApi(row, req));
      }
    );
  });
});

/* PUT /holidays/:id – update an existing entry */
router.put('/:id', express.json(), (req, res) => {
  const id = Number(req.params.id);
  const { doctorId, startDate, endDate } = req.body;

  // First fetch current row (to keep unchanged fields)
  db.get('SELECT * FROM holidays WHERE id = ?', [id], (err, oldRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldRow) return res.status(404).json({ error: 'Holiday not found' });

    const sql = `
      UPDATE holidays
      SET doctorId = ?, startDate = ?, endDate = ?
      WHERE id = ?
    `;
    const params = [
      doctorId ?? oldRow.doctorId,
      startDate ?? oldRow.startDate,
      endDate ?? oldRow.endDate,
      id
    ];
    db.run(sql, params, function (e) {
      if (e) return res.status(500).json({ error: e.message });
      // Return updated row with doctor name
      db.get(
        `SELECT h.id, h.doctorId,
                d.firstname || ' ' || d.lastname AS doctorName,
                h.startDate, h.endDate
         FROM holidays h
         JOIN doctors d ON d.id = h.doctorId
         WHERE h.id = ?`,
        [id],
        (err2, row) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json(toApi(row, req));
        }
      );
    });
  });
});

/* DELETE /holidays/:id */
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.run('DELETE FROM holidays WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Holiday not found' });
    res.json({ message: 'Holiday deleted' });
  });
});

module.exports = router;