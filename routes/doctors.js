// routes/doctors.js
const express = require('express');
const router = express.Router();
const db = require('../db');            // MySQL wrapper
const multer = require('multer');
const { verifyToken, requireAdmin, requireStaff, requireStaffOrDoctor, isStaff } = require('../middleware/auth');

// ------------------------------------------------
// Photo upload: kept in memory and stored in the database (imageBase64).
// Only images, max 8 MB (the admin page shrinks photos before uploading, so they are much smaller).
// ------------------------------------------------
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => IMAGE_TYPES.includes(file.mimetype)
    ? cb(null, true)
    : cb(Object.assign(new Error('Kies een foto (jpg, png, webp of gif).'), { status: 400 }))
});
/** Same as upload.single('image'), but with a clear message instead of a crash when the file is wrong */
const upload = {
  single: field => (req, res, next) => multerUpload.single(field)(req, res, err => {
    if (!err) return next();
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'De foto is te groot (max. 8 MB).' : err.message;
    res.status(400).json({ error: msg });
  })
};

/** A doctor account may only change its own doctor (admin + secretary: everyone) */
function ownDoctorOnly(req, res, next) {
  if (isStaff(req.user) || Number(req.params.id) === req.user.doctorId) return next();
  return res.status(403).json({ error: 'Je kan enkel je eigen gegevens wijzigen.' });
}

/** The real image type from the first bytes (older photos were saved as PNG but labelled jpeg) */
function imageMime(base64) {
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Order of the doctors everywhere on the site:
 * 1. normal doctors, 2. HAIO (huisarts in opleiding), 3. "Vertegenwoordigers" always last.
 * Within each group: the order set in the admin (sortOrder, by dragging), then id.
 */
const ORDER = `ORDER BY (LOWER(TRIM(firstname)) LIKE 'vertegenwoordiger%' OR LOWER(TRIM(lastname)) LIKE 'vertegenwoordiger%'),
               haio, sortOrder, id`;

/** Checkbox value from a multipart form: '1' / 'on' / 'true' = yes. Hidden '0' + checkbox '1' arrives as an array. */
function readHaio(value) {
  const v = Array.isArray(value) ? value[value.length - 1] : value;
  return ['1', 'on', 'true'].includes(String(v).toLowerCase()) ? 1 : 0;
}

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
    haio: !!row.haio,
    sortOrder: row.sortOrder,
    imageUrl: row.imageBase64
    ? `data:${imageMime(row.imageBase64)};base64,${row.imageBase64}`
    : null
  };
}

/* ---------------------------------------------
   GET /doctors – list all doctors (admin only)
   ------------------------------------------------- */
router.get('/', async (req, res) => {
  try {
    const rows = await db.query(`SELECT * FROM doctors ${ORDER}`);
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
router.post('/', verifyToken, requireStaff, upload.single('image'), async (req, res) => {
  const { firstname, lastname, email, phone, agendaUrl } = req.body;
  const imageBase64 = req.file ? req.file.buffer.toString('base64') : null;

  if (!firstname || !lastname || !email || !phone || !agendaUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [result] = await db.pool.execute(
      `INSERT INTO doctors (firstname, lastname, email, phone, agendaUrl, imageBase64, haio, sortOrder)
       SELECT ?,?,?,?,?,?,?, COALESCE(MAX(sortOrder), 0) + 1 FROM doctors`,   // new doctors go to the end
      [firstname, lastname, email, phone, agendaUrl, imageBase64, readHaio(req.body.haio)]
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
   PUT /doctors/order – save the order set in the admin (drag & drop)
   Body: { ids: [3, 1, 2, ...] } – all doctor ids in the new order.
   (Must stay above PUT /:id, otherwise "order" would be read as an id.)
   ------------------------------------------------- */
router.put('/order', verifyToken, requireStaff, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : null;
  if (!ids || !ids.length || ids.some(id => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: 'ids must be a list of unique doctor ids' });
  }
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < ids.length; i++) {
      await conn.execute('UPDATE doctors SET sortOrder = ? WHERE id = ?', [i + 1, ids[i]]);
    }
    await conn.commit();
    const rows = await db.query(`SELECT * FROM doctors ${ORDER}`);
    res.json(rows.map(r => toApi(r, req)));
  } catch (err) {
    await conn.rollback();
    console.error('DOCTORS ORDER error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

/* -------------------------------------------------
   PUT /doctors/:id – update an existing doctor
   ------------------------------------------------- */
router.put('/:id', verifyToken, requireStaffOrDoctor, ownDoctorOnly, upload.single('image'), async (req, res) => {
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
      `UPDATE doctors SET firstname=?, lastname=?, email=?, phone=?, agendaUrl=?, imageBase64=?, haio=? WHERE id=?`,
      [
        firstname || old.firstname,
        lastname  || old.lastname,
        email     || old.email,
        phone     || old.phone,
        agendaUrl || old.agendaUrl,
        imageBase64,
        // HAIO: only admin/secretary can change it; not sent → keep as it was
        !isStaff(req.user) || req.body.haio === undefined ? old.haio : readHaio(req.body.haio),
        id
      ]
    );

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
  const rows = await db.query('SELECT id FROM doctors WHERE id = ?', [id]);
  const doctor = rows[0];
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  try {
    await db.pool.execute('DELETE FROM doctors WHERE id = ?', [id]);
    // The doctor's login account goes too (there is no foreign key that does this)
    await db.pool.execute('DELETE FROM users WHERE doctorId = ?', [id]);

    res.json({ message: 'Doctor deleted' });
  } catch (err) {
    console.error('DOCTORS DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Route to get all doctors with their holidays where the endDate is after today
// Route to get all doctors with their holidays where the endDate is after today
router.get('/doctors/holidays', async (req, res) => {
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