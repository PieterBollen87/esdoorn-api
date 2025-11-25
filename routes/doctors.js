// routes/doctors.js
const express = require('express');
const router = express.Router();
const db = require('../db');            // MySQL wrapper
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// ------------------------------------------------
// Multer setup – store uploaded avatars in ./uploads
// ------------------------------------------
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.memoryStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage });

// ---------------------------------------------
// Helper – turn a DB row into the API shape (adds image URL)
// -------------------------------------------------
function toApi(row, req) {
  const host = `${req.protocol}://${req.get('host')}`;
  return {
    id: row.id,
    firstname: row.firstname,
   lastname: row.lastname,
    email: row.email,
    phone: row.phone,
    agendaUrl: row.agendaUrl,
    imageUrl: row.imageBase64
    ? `data:image/jpeg;base64,${row.imageBase64}`
    : null
  };
}

/* ---------------------------------------------
   GET /doctors – list all doctors (admin only)
   ------------------------------------------------- */
router.get('/', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM doctors ORDER BY id');
    const result = rows.map(r => toApi(r, req));
    res.json(result);
  } catch (err) {
    console.error('DOCTORS GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------
   GET /doctors/:id – single doctor
   ------------------------------------------------- */
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const rows = await db.query('SELECT * FROM doctors WHERE id = ?', [id]);
    const doctor = rows[0];
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(toApi(doctor, req));
  } catch (err) {
    console.error('DOCTORS GET/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------
   POST /doctors – create a new doctor (multipart)
   ------------------------------------------------- */
router.post('/', verifyToken, requireAdmin, upload.single('image'), async (req, res) => {
  const { firstname, lastname, email, phone, agendaUrl } = req.body;
  const imageBase64 = req.file ? req.file.buffer.toString('base64') : null;

  if (!firstname || !lastname || !email || !phone || !agendaUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [result] = await db.pool.execute(
      `INSERT INTO doctors (firstname, lastname, email, phone, agendaUrl, imageBase64)
       VALUES (?,?,?,?,?,?)`,
      [firstname, lastname, email, phone, agendaUrl, imageBase64]
    );
    console.log(result);
    const insertId = result.insertId;
    const rows = await db.query('SELECT * FROM doctors WHERE id = ?', [insertId]);
    // const newDoc = newDocRows[0];
    res.status(201).json(toApi(rows[0], req));
  } catch (err) {
    console.error('DOCTORS POST error:', err);
    res.status(500).json({ error: err.message });
 }
});

/* -------------------------------------------------
   PUT /doctors/:id – update an existing doctor
   ------------------------------------------------- */
router.put('/:id', verifyToken, requireAdmin, upload.single('image'), async (req, res) => {
  const id = Number(req.params.id);
  const { firstname, lastname, email, phone, agendaUrl } = req.body;

  // Load the existing row first (to keep the old image if not replaced)
  const oldRows = await db.query('SELECT * FROM doctors WHERE id = ?', [id]);
  const old = oldRows[0];
  if (!old) return res.status(404).json({ error: 'Doctor not found' });

  const imageBase64 = req.file
  ? req.file.buffer.toString('base64')
  : old.imageBase64;

  try {
    await db.pool.execute(
      `UPDATE doctors SET firstname=?, lastname=?, email=?, phone=?, agendaUrl=?, imageBase64=? WHERE id=?`,
      [
        firstname || old.firstname,
        lastname  || old.lastname,
        email     || old.email,
        phone     || old.phone,
        agendaUrl || old.agendaUrl,
        imageBase64,
        id
      ]
    );

    // If we replaced the image, delete the old file
    if (req.file && old.imagePath) {
      const oldPath = path.join(uploadDir, old.imagePath);
      if (fs.existsSync(oldPath)) await fs.promises.unlink(oldPath);
    }

    const updatedRows = await db.query('SELECT * FROM doctors WHERE id = ?', [id]);
    res.json(toApi(updatedRows[0], req));
  } catch (err) {
    console.error('DOCTORS PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------
   DELETE /doctors/:id – remove a doctor (and its image)
   -------------------------------------------- */
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const rows = await db.query('SELECT imagePath FROM doctors WHERE id = ?', [id]);
  const doctor = rows[0];
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  try {
    await db.pool.execute('DELETE FROM doctors WHERE id = ?', [id]);

    // Delete the avatar file if it existed
    if (doctor.imagePath) {
      const imgPath = path.join(uploadDir, doctor.imagePath);
      if (fs.existsSync(imgPath)) await fs.promises.unlink(imgPath);
    }

    res.json({ message: 'Doctor deleted' });
  } catch (err) {
    console.error('DOCTORS DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

const moment = require('moment'); // Use moment.js for date handling

// Route to get all doctors with their holidays where the endDate is after today
// Route to get all doctors with their holidays where the endDate is after today
router.get('/doctors-with-holidays', async (req, res) => {
  try {
    // Get today's date in 'YYYY-MM-DD' format
    const today = new Date();
    const todayFormatted = today.toISOString().split('T')[0]; // Format: 'YYYY-MM-DD'

    // Query to fetch doctors and their holidays where the holiday endDate is after today
    const sql = `
      SELECT 
        d.id AS doctorId, 
        d.firstname, 
        d.lastname, 
        h.id AS holidayId, 
        h.startDate, 
        h.endDate
      FROM doctors d
      LEFT JOIN holidays h ON d.id = h.doctorId
      WHERE h.endDate > ? OR h.endDate IS NULL
      ORDER BY d.id, h.startDate;
    `;
    
    const rows = await db.query(sql, [todayFormatted]);
    
    // Process the rows to organize them by doctor
    const doctorsWithHolidays = rows.reduce((acc, row) => {
      const doctorId = row.doctorId;
      
      // If the doctor is not in the accumulator, add them
      if (!acc[doctorId]) {
        acc[doctorId] = {
          id: doctorId,
          firstname: row.firstname,
          lastname: row.lastname,
          holidays: []
        };
      }
      
      // Add the holiday to the doctor's list of holidays
      if (row.holidayId) {
        acc[doctorId].holidays.push({
          id: row.holidayId,
          startDate: row.startDate,
          endDate: row.endDate
        });
      }

      return acc;
    }, {});

    // Convert the object to an array of doctors with their holidays
    const result = Object.values(doctorsWithHolidays);
    
    res.json(result);
  } catch (err) {
    console.error('Error fetching doctors with holidays:', err);
    res.status(500).json({ error: err.message });
  }
});



module.exports = router;