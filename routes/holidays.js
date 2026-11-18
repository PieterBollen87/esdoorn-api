// routes/holidays.js – leave ("verlof") of the doctors
// Reading is public (the site shows it on the doctor cards).
// Admin + secretary: can manage everyone's leave. Doctor account: only their own (doctorId from their account, never from the request).
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireStaffOrDoctor, isStaff } = require('../middleware/auth');

// Dates as plain 'YYYY-MM-DD' text, so no time zone can shift them by a day
const SELECT = `
  SELECT h.id, h.doctorId,
         TRIM(CONCAT(d.firstname, ' ', d.lastname)) AS doctorName,
         DATE_FORMAT(h.startDate, '%Y-%m-%d') AS startDate,
         DATE_FORMAT(h.endDate, '%Y-%m-%d') AS endDate
  FROM holidays h
  JOIN doctors d ON d.id = h.doctorId`;

const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00Z'));

/** Validate start/end. Returns { startDate, endDate } or { error } */
function readDates(body = {}) {
  const { startDate, endDate } = body;
  if (!isDate(startDate) || !isDate(endDate)) return { error: 'Kies een begin- en einddatum.' };
  if (endDate < startDate) return { error: 'De einddatum mag niet vóór de begindatum liggen.' };
  return { startDate, endDate };
}

/** Which doctor this request may write for: a doctor always only themselves */
function targetDoctorId(req) {
  return req.user.role === 'doctor' ? req.user.doctorId : Number(req.body.doctorId);
}

/** A doctor may only change their own leave */
const mayChange = (req, holiday) => isStaff(req.user) || holiday.doctorId === req.user.doctorId;

/* GET /holidays – all leave (public) */
router.get('/', async (req, res) => {
  try {
    res.json(await db.query(`${SELECT} ORDER BY h.startDate DESC`));
  } catch (err) {
    console.error('HOLIDAYS GET error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* GET /holidays/:id */
router.get('/:id', async (req, res) => {
  try {
    const [holiday] = await db.query(`${SELECT} WHERE h.id = ?`, [Number(req.params.id)]);
    if (!holiday) return res.status(404).json({ error: 'Verlof niet gevonden' });
    res.json(holiday);
  } catch (err) {
    console.error('HOLIDAYS GET/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* POST /holidays – add leave */
router.post('/', verifyToken, requireStaffOrDoctor, async (req, res) => {
  const dates = readDates(req.body);
  if (dates.error) return res.status(400).json({ error: dates.error });
  const doctorId = targetDoctorId(req);
  if (!Number.isInteger(doctorId)) return res.status(400).json({ error: 'Kies een dokter.' });
  try {
    const result = await db.query('INSERT INTO holidays (doctorId, startDate, endDate) VALUES (?, ?, ?)',
      [doctorId, dates.startDate, dates.endDate]);
    const [holiday] = await db.query(`${SELECT} WHERE h.id = ?`, [result.insertId]);
    res.status(201).json(holiday);
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Deze dokter bestaat niet.' });
    console.error('HOLIDAYS POST error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* PUT /holidays/:id – change leave */
router.put('/:id', verifyToken, requireStaffOrDoctor, async (req, res) => {
  const id = Number(req.params.id);
  const dates = readDates(req.body);
  if (dates.error) return res.status(400).json({ error: dates.error });
  try {
    const [current] = await db.query(`${SELECT} WHERE h.id = ?`, [id]);
    if (!current) return res.status(404).json({ error: 'Verlof niet gevonden' });
    if (!mayChange(req, current)) return res.status(403).json({ error: 'Je kan enkel je eigen verlof wijzigen.' });
    const doctorId = isStaff(req.user) && req.body.doctorId ? Number(req.body.doctorId) : current.doctorId;
    await db.query('UPDATE holidays SET doctorId = ?, startDate = ?, endDate = ? WHERE id = ?',
      [doctorId, dates.startDate, dates.endDate, id]);
    const [holiday] = await db.query(`${SELECT} WHERE h.id = ?`, [id]);
    res.json(holiday);
  } catch (err) {
    console.error('HOLIDAYS PUT error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* DELETE /holidays/:id */
router.delete('/:id', verifyToken, requireStaffOrDoctor, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [current] = await db.query(`${SELECT} WHERE h.id = ?`, [id]);
    if (!current) return res.status(404).json({ error: 'Verlof niet gevonden' });
    if (!mayChange(req, current)) return res.status(403).json({ error: 'Je kan enkel je eigen verlof verwijderen.' });
    await db.query('DELETE FROM holidays WHERE id = ?', [id]);
    res.json({ message: 'Verlof verwijderd' });
  } catch (err) {
    console.error('HOLIDAYS DELETE error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
