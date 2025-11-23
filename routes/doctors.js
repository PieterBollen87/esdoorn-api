// routes/doctors.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// -----------------------------------------------------------------
// Multer configuration – store images in ./uploads/
// -----------------------------------------------------------------
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    // keep original extension, prepend timestamp to avoid collisions
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage });

// -----------------------------------------------------------------
// Helper – convert DB row → API object (adds full URL for image)
// -----------------------------------------------------------------
function toApiObject(row, req) {
  const host = `${req.protocol}://${req.get('host')}`;
  return {
    id: row.id,
    firstname: row.firstname,
    lastname: row.lastname,
    email: row.email,
    phone: row.phone,
    agendaUrl: row.agendaUrl,
    imageUrl: row.imagePath ? `${host}/uploads/${row.imagePath}` : null
  };
}

// -----------------------------------------------------------------
// GET /doctors – list all doctors
// -----------------------------------------------------------------
router.get('/', (req, res) => {
  db.all('SELECT * FROM doctors ORDER BY lastname, firstname', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const result = rows.map(r => toApiObject(r, req));
    res.json(result);
  });
});

// -----------------------------------------------------------------
// GET /doctors/:id – single doctor
// -----------------------------------------------------------------
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM doctors WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Doctor not found' });
    res.json(toApiObject(row, req));
  });
});

// --------------------------------------------------------
// POST /doctors – create a new doctor (multipart/form-data)
// -----------------------------------------------------------------
router.post('/', upload.single('image'), (req, res) => {
  const { firstname, lastname, email, phone, agendaUrl } = req.body;
  const imagePath = req.file ? req.file.filename : null;

  // Very light validation – you can replace with Joi/Yup if you like
  if (!firstname || !lastname || !email || !phone || !agendaUrl) {
    // delete uploaded file if validation fails
    if (imagePath) fs.unlinkSync(path.join(uploadDir, imagePath));
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO doctors (firstname, lastname, email, phone, agendaUrl, imagePath)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const params = [firstname, lastname, email, phone, agendaUrl, imagePath];

  db.run(sql, params, function (err) {
    if (err) {
      if (imagePath) fs.unlinkSync(path.join(uploadDir, imagePath));
      return res.status(500).json({ error: err.message });
    }
    // Return the newly created record
    db.get('SELECT * FROM doctors WHERE id = ?', [this.lastID], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });
      res.status(201).json(toApiObject(row, req));
    });
  });
});

// --------------------------------------------------------
// PUT /doctors/:id – update a doctor (multipart/form-data)
// -----------------------------------------------------------------
router.put('/:id', upload.single('image'), (req, res) => {
  const id = Number(req.params.id);
  const { firstname, lastname, email, phone, agendaUrl } = req.body;
  const newImage = req.file ? req.file.filename : null;

  // First fetch the existing row (to know current imagePath)
  db.get('SELECT * FROM doctors WHERE id = ?', [id], (err, oldRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldRow) {
      if (newImage) fs.unlinkSync(path.join(uploadDir, newImage));
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const imagePath = newImage ? newImage : oldRow.imagePath;

    const sql = `
      UPDATE doctors
      SET firstname = ?, lastname = ?, email = ?, phone = ?, agendaUrl = ?, imagePath = ?
      WHERE id = ?
    `;
    const params = [
      firstname ?? oldRow.firstname,
      lastname ?? oldRow.lastname,
      email ?? oldRow.email,
      phone ?? oldRow.phone,
      agendaUrl ?? oldRow.agendaUrl,
      imagePath,
      id
    ];

    db.run(sql, params, function (e) {
      if (e) {
        if (newImage) fs.unlinkSync(path.join(uploadDir, newImage));
        return res.status(500).json({ error: e.message });
      }

      // If we replaced the image, delete the old file
      if (newImage && oldRow.imagePath) {
        const oldPath = path.join(uploadDir, oldRow.imagePath);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      // Return the updated record
      db.get('SELECT * FROM doctors WHERE id = ?', [id], (err2, updatedRow) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json(toApiObject(updatedRow, req));
      });
    });
  });
});

// -----------------------------------------------------------------
// DELETE /doctors/:id – remove a doctor (also deletes image)
// -----------------------------------------------------------------
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);

  // Grab the imagePath first so we can delete the file later
  db.get('SELECT imagePath FROM doctors WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Doctor not found' });

    db.run('DELETE FROM doctors WHERE id = ?', [id], function (e) {
      if (e) return res.status(500).json({ error: e.message });

      // Delete the image file if it existed
      if (row.imagePath) {
        const filePath = path.join(uploadDir, row.imagePath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      res.json({ message: 'Doctor deleted' });
    });
  });
});

module.exports = router;