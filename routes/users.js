// routes/users.js – user accounts
// Roles: 'admin' = everything, 'secretary' = messages/doctors/leave + creating DOCTOR accounts,
//        'doctor' = only their own leave and details, linked to a doctor via doctorId.
// The owner account (id OWNER_ID, 'pieter') can never be deleted and only the owner can change it.
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const { verifyToken, requireAdmin, requireStaff } = require('../middleware/auth');

const MIN_PASSWORD = 10;
const ROLES = ['admin', 'secretary', 'doctor'];
const OWNER_ID = 1;   // 'pieter' – protected account

const SELECT = `
  SELECT u.id, u.username, u.email, u.role, u.doctorId, (u.id = ${OWNER_ID}) AS isOwner,
         TRIM(CONCAT(d.firstname, ' ', d.lastname)) AS doctorName
  FROM users u
  LEFT JOIN doctors d ON d.id = u.doctorId`;

/** Validate the request body. Returns the clean data or { error }. `isNew` = password required. */
function readPayload(body = {}, isNew) {
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const role = body.role;
  const doctorId = body.doctorId ? Number(body.doctorId) : null;
  const password = body.password ? String(body.password) : '';

  if (!username || username.length > 50) return { error: 'Vul een gebruikersnaam in (max. 50 tekens).' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Vul een geldig e-mailadres in.' };
  if (!ROLES.includes(role)) return { error: 'Kies een rol: admin, secretariaat of dokter.' };
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

const toJson = u => (u ? { ...u, isOwner: !!u.isOwner } : u);

/* GET /users – all accounts (no passwords) – admin + secretary (secretary needs it to see who has an account) */
router.get('/', verifyToken, requireStaff, async (req, res) => {
  try {
    res.json((await db.query(`${SELECT} ORDER BY u.role, u.username`)).map(toJson));
  } catch (err) {
    console.error('USERS GET error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* GET /users/:id */
router.get('/:id', verifyToken, requireStaff, async (req, res) => {
  try {
    const [user] = await db.query(`${SELECT} WHERE u.id = ?`, [Number(req.params.id)]);
    if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    res.json(toJson(user));
  } catch (err) {
    console.error('USERS GET/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* POST /users – create an account (secretary: only doctor accounts) */
router.post('/', verifyToken, requireStaff, async (req, res) => {
  const data = readPayload(req.body, true);
  if (data.error) return res.status(400).json({ error: data.error });
  if (req.user.role === 'secretary' && data.role !== 'doctor') {
    return res.status(403).json({ error: 'Het secretariaat kan enkel dokter-accounts aanmaken.' });
  }
  try {
    const hash = await bcrypt.hash(data.password, 12);
    const result = await db.query(
      'INSERT INTO users (username, email, password, role, doctorId) VALUES (?, ?, ?, ?, ?)',
      [data.username, data.email, hash, data.role, data.doctorId]
    );
    const [user] = await db.query(`${SELECT} WHERE u.id = ?`, [result.insertId]);
    res.status(201).json(toJson(user));
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: duplicateMessage(err) });
    console.error('USERS POST error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* PUT /users/:id – change an account (admin only; password only when a new one is given).
   The owner account can only be changed by the owner itself, and stays admin. */
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (id === OWNER_ID && req.user.id !== OWNER_ID) {
    return res.status(403).json({ error: 'Dit account kan enkel door de eigenaar zelf gewijzigd worden.' });
  }
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
    res.json(toJson(user));
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
    if (id === OWNER_ID) return res.status(403).json({ error: 'Dit account kan niet verwijderd worden.' });
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
