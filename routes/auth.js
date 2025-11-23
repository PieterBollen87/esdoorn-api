// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// -------------------------------------------------------------
// Rate limiter – 5 attempts per 5 minutes per IP (adjust as you like)
// -----------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min
  max: 5,
  message: { error: 'Too many login attempts, try again later.' }
});

// --------------------------------------------------------
// POST /auth/login – returns a JWT if credentials are valid
// -----------------------------------------------------------------
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'username & password required' });

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // Sign a JWT (expires in 8 h – adjust as needed)
    const token = jwt.sign(
      { sub: user.id, username: user.username },
      process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD',
      { expiresIn: '8h' }
    );

    res.json({ token });
  });
});

// -------------------------------------------------------------
// POST /auth/register – one‑time admin creation (disable in prod)
// -------------------------------------------------------
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username & password required' });
    }
  
    // Hash the password with a strong cost factor (12 is a good default)
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);
  
    db.run(
      'INSERT INTO users (username, passwordHash) VALUES (?,?)',
      [username, hash],
      function (err) {
        if (err) {
          // Duplicate usernames will hit SQLITE_CONSTRAINT
          if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: 'Username already exists' });
          }
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, username });
      }
    );
  });

module.exports = router;