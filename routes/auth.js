// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../db');               // <-- now the MySQL wrapper
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { requireAdmin } = require('../middleware/auth');

// ------------------------------------------------
// Rate limiter – 5 attempts per 5 min per IP
// -------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, try again later.' }
});

/* -------------------------------------------------
   POST /auth/login – compare password with stored hash
   ------------------------------------------------- */
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username & password required' });
  }

  try {
    // SELECT * FROM users WHERE username = ?
    const users = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    const user = users[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // Build JWT payload (include role)
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role               // 'admin' or 'user'
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD',
      { expiresIn: '8h' }
    );

    res.json({ token });
  } catch (err) {
    console.error('LOGIN error:', err);
    res.status(500).json({ error: 'Internal server eror' });
 }
});

/* -------------------------------------------------
   POST /auth/register – hash password before INSERT
   -------------------------------------------- */
router.post('/register', requireAdmin, async (req, res) => {
  const { username, email, password, role = 'user' } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email & password required' });
  }
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'role must be "admin" or "user"' });
  }

  try {
    const hash = await bcrypt.hash(password, 12); // 12 rounds = good default

    // INSERT INTO users (username,email,passwordHash,role) VALUES (?,?,?,?)
    const result = await db.pool.execute(
      `INSERT INTO users (username, email, passwordHash, role)
       VALUES (?,?,?,?)`,
      [username, email, hash, role]
    );

    // `result[0].insertId` is the newly created user id
    const insertId = result[0].insertId;

    res.status(201).json({
      id: insertId,
      username,
      email,
      role
    });
  } catch (err) {
    // Duplicate username/email → MySQL error code ER_DUP_ENTRY (1062)
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    console.error('REGISTER error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;