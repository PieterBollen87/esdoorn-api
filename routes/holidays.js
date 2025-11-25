// routes/holidays.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

/**
 * Helper – convert a DB row to the API shape
 */
function toApi(row, req) {
  return {
    id: row.id,
    doctorId: row.doctorId,
    doctorName: row.doctorName,
    startDate: row.startDate,
    endDate: row.endDate
  };
}

/* -------------------------------------------------
   GET /holidays – list all holiday entries (admin only)
   ------------------------------------------------- */
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  const sql = `
    SELECT h.id, h.doctorId,
           CONCAT(d.firstname, ' ', d.lastname) AS doctorName,
           h.startDate, h.endDate
    FROM holidays h
    JOIN doctors d ON d.id = h.doctorId
    ORDER BY h.startDate DESC
  `;
  try {
    const rows = await db.query(sql);
    res.json(rows.map(r => toApi(r, req)));
  } catch (err) {
    console.error('HOLIDAYS GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------
   GET /holidays/:id – single holiday
   ------------------------------------------------- */
router.get('/:id', verifyToken, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const sql = `
    SELECT h.id, h.doctorId,
           CONCAT(d.firstname, ' ', d.lastname) AS doctorName,
           h.startDate, h.endDate
    FROM holidays h
    JOIN doctors d ON d.id = h.doctorId
    WHERE h.id = ?
  `;
  try {
    const row = await db.get(sql, [id]);
    if (!row) return res.status(404).json({ error: 'Holiday not found' });
    res.json(toApi(row, req));
  } catch (err) {
    console.error('HOLIDAYS GET/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------
   POST /holidays – create a new holiday
   ------------------------------------------------- */
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { doctorId, startDate, endDate } = req.body;
  console.log(req.body);
  if (!doctorId || !startDate || !endDate) {
    return res.status(400).json({ error: 'doctorId, startDate and endDate required' });
  }

  const sql = `INSERT INTO holidays (doctorId, startDate, endDate) VALUES (?,?,?)`;
  try {
    const result = await db.run(sql, [doctorId, startDate, endDate]);
    // Return the freshly created row with doctorName
    const row = await db.get(`
      SELECT h.id, h.doctorId,
             CONCAT(d.firstname, ' ', d.lastname) AS doctorName,
             h.startDate, h.endDate
      FROM holidays h
      JOIN doctors d ON d.id = h.doctorId
      WHERE h.id = ?`,
      [result.insertId]
    );
    res.status(201).json(toApi(row, req));
  } catch (err) {
    console.error('HOLIDAYS POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------
   PUT /holidays/:id – update an existing holiday
   ------------------------------------------------- */
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { doctorId, startDate, endDate } = req.body;

  // Load existing row
  const old = await db.get('SELECT * FROM holidays WHERE id = ?', [id]);
  if (!old) return res.status(404).json({ error: 'Holiday not found' });

  const sql = `UPDATE holidays SET doctorId=?, startDate=?, endDate=? WHERE id=?`;
  try {
    await db.run(sql, [
      doctorId || old.doctorId,
      startDate || old.startDate,
      endDate   || old.endDate,
      id
    ]);

    const updated = await db.get(`
      SELECT h.id, h.doctorId,
             CONCAT(d.firstname, ' ', d.lastname) AS doctorName,
             h.startDate, h.endDate
      FROM holidays h
      JOIN doctors d ON d.id = h.doctorId
      WHERE h.id = ?`,
      [id]
    );

    res.json(toApi(updated, req));
  } catch (err) {
    console.error('HOLIDAYS PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------
   DELETE /holidays/:id – remove a holiday
   ------------------------------------------------- */
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const result = await db.run('DELETE FROM holidays WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Holiday not found' });
    res.json({ message: 'Holiday deleted' });
  } catch (err) {
    console.error('HOLIDAYS DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
