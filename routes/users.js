// routes/users.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const { requireAdmin } = require('../middleware/auth');


/**
 * GET /users
 * Returns a list of all users (admin accounts). Only admins can call this.
 * Fields: id, username, role
 */
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT id, username, role FROM users ORDER BY username');
    res.json(rows);
  } catch (err) {
    console.error('USERS GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------
//  Users – create (admin‑only) & list (admin‑only)
// ----------------------------------------------------------

/**
 * GET /users
 * Returns a list of all users (id, username, role).
 * Admin‑only – the router is mounted after `verifyToken`,
 * and we additionally enforce `requireAdmin`.
 */
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT id, username, role FROM users ORDER BY username');
    res.json(rows);
  } catch (err) {
    console.error('USERS GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /users
 * Create a new user (admin‑only).
 *
 * Expected JSON body:
 * {
 *   "username": "newuser",
 *   "password": "plain‑text‑password",
 *   "role": "admin"          // optional – defaults to "admin"
 * }
 *
 * Returns: { id, username, role }
 */
router.post('/', requireAdmin, async (req, res) => {
  const { username, password, role = 'admin' } = req.body;

  // -----------------------------------------------------------------
  // Basic validation
  // -----------------------------------------------------------------
  if (!username || !password) {
    return res.status(400).json({ error: 'username & password are required' });
  }
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'role must be "admin" or "user"' });
  }

  try {
    // -------------------------------------------------------------
    // 1️⃣ Hash the password (cost factor 12 is a good default)
    // -------------------------------------------------------------
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);

    // -------------------------------------------------------
    // 2️⃣ Insert the new user
    // -------------------------------------------------------------
    const sql = `
      INSERT INTO users (username, passwordHash, role)
      VALUES (?,?,?)
    `;
    const result = await db.run(sql, [username, hash, role]);

    // ----------------------------------------------------------
    // 3️⃣ Return the newly created user (without the password hash)
    // -------------------------------------------------------------
    res.status(201).json({
      id: result.insertId,
      username,
      role
    });
  } catch (err) {
    // -------------------------------------------------------------
    // Duplicate username → SQLite would give SQLITE_CONSTRAINT,
    // MySQL gives ER_DUP_ENTRY (code: 'ER_DUP_ENTRY')
    // -----------------------------------------
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('USERS POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;