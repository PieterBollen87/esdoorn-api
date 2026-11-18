// routes/users.js – user accounts (admin only)
// Roles: 'admin' = everything, 'doctor' = only their own leave ("Mijn verlof"), linked to a doctor via doctorId.
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const SELECT = `
  SELECT u.id, u.username, u.email, u.role, u.doctorId,
         TRIM(CONCAT(d.firstname, ' ', d.lastname)) AS doctorName
  FROM users u
  LEFT JOIN doctors d ON d.id = u.doctorId`;

const MIN_PASSWORD = 10;
const ROLES = ['admin', 'doctor'];

/** Validate the request body. Returns the clean data or { error }. `isNew` = password required. */
function readPayload(body = {}, isNew) {
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const role = body.role;
  const doctorId = body.doctorId ? Number(body.doctorId) : null;
  const password = body.password ? String(body.password) : '';

  if (!username || username.length > 50) return { error: 'Vul een gebruikersnaam in (max. 50 tekens).' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Vul een geldig e-mailadres in.' };
  if (!ROLES.includes(role)) return { error: 'Kies een rol: admin of dokter.' };
  if (role === 'doctor' && !Number.isInteger(doctorId)) return { error: 'Kies bij een dokter-account de dokter.' };
  if (isNew && !password) return { error: 'Vul een wachtwoord in.' };
  if (password && password.length < MIN_PASSWORD) return { error: `Het wachtwoord moet minstens ${MIN_PASSWORD} tekens lang zijn.` };

  return { username, email, role, doctorId: role === 'doctor' ? doctorId : null, password };
}

/** Friendly message for unique-key errors */
function duplicateMessage(err) {
  const m = String(err.sqlMessage || err.message);
  if (/doctor/i.test(m)) return 'Deze dokter heeft al een account.';
  if (/email/i.test(m)) return 'Dit e-mailadres wordt al gebruikt.';
  return 'Deze gebruikersnaam bestaat al.';
}

async function adminCount() {
  const [row] = await db.query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'");
  return Number(row.n);
}

/* GET /users – all accounts (no passwords) */
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    res.json(await db.query(`${SELECT} ORDER BY u.role, u.username`));
  } catch (err) {
    console.error('USERS GET error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* GET /users/:id */
router.get('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [user] = await db.query(`${SELECT} WHERE u.id = ?`, [Number(req.params.id)]);
    if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    res.json(user);
  } catch (err) {
    console.error('USERS GET/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* POST /users – create an account */
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const data = readPayload(req.body, true);
  if (data.error) return res.status(400).json({ error: data.error });
  try {
    const hash = await bcrypt.hash(data.password, 12);
    const result = await db.query(
      'INSERT INTO users (username, email, password, role, doctorId) VALUES (?, ?, ?, ?, ?)',
      [data.username, data.email, hash, data.role, data.doctorId]
    );
    const [user] = await db.query(`${SELECT} WHERE u.id = ?`, [result.insertId]);
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: duplicateMessage(err) });
    console.error('USERS POST error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* PUT /users/:id – change an account (password only when a new one is given) */
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const data = readPayload(req.body, false);
  if (data.error) return res.status(400).json({ error: data.error });
  try {
    const [current] = await db.query(`${SELECT} WHERE u.id = ?`, [id]);
    if (!current) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    if (current.role === 'admin' && data.role !== 'admin') {
      if (id === req.user.id) return res.status(400).json({ error: 'Je kan je eigen admin-rechten niet afnemen.' });
      if (await adminCount() <= 1) return res.status(400).json({ error: 'Er moet minstens één admin blijven.' });
    }
    if (data.password) {
      const hash = await bcrypt.hash(data.password, 12);
      await db.query('UPDATE users SET username = ?, email = ?, role = ?, doctorId = ?, password = ? WHERE id = ?',
        [data.username, data.email, data.role, data.doctorId, hash, id]);
    } else {
      await db.query('UPDATE users SET username = ?, email = ?, role = ?, doctorId = ? WHERE id = ?',
        [data.username, data.email, data.role, data.doctorId, id]);
    }
    const [user] = await db.query(`${SELECT} WHERE u.id = ?`, [id]);
    res.json(user);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: duplicateMessage(err) });
    console.error('USERS PUT error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* DELETE /users/:id – never yourself, never the last admin */
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (id === req.user.id) return res.status(400).json({ error: 'Je kan je eigen account niet verwijderen.' });
    const [current] = await db.query(`${SELECT} WHERE u.id = ?`, [id]);
    if (!current) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    if (current.role === 'admin' && await adminCount() <= 1) {
      return res.status(400).json({ error: 'Er moet minstens één admin blijven.' });
    }
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Gebruiker verwijderd' });
  } catch (err) {
    console.error('USERS DELETE error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
