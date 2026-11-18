// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../db');               // <-- now the MySQL wrapper
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { verifyToken, getJwtSecret } = require('../middleware/auth');

// ------------------------------------------------
// Rate limiter – 5 attempts per 5 min per IP
// -------------------------------------------------
// Only FAILED attempts count, so doctors logging in from the same practice don't block each other
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Te veel mislukte inlogpogingen. Probeer het over een kwartier opnieuw.' }
});

// Separate limiter for password changes (doesn't eat into the login attempts)
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Te veel pogingen, probeer het later opnieuw.' }
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

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // Build JWT payload (include role)
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,              // 'admin' or 'doctor'
      doctorId: user.doctorId ?? null
    };

    const secret = getJwtSecret();
    if (!secret) {
      console.error('JWT_SECRET is not set in .env – login is disabled until it is.');
      return res.status(503).json({ error: 'Server not configured for login (JWT_SECRET missing)' });
    }
    const token = jwt.sign(payload, secret, { expiresIn: '8h' });

    res.json({ token });
  } catch (err) {
    console.error('LOGIN error:', err);
    res.status(500).json({ error: 'Internal server eror' });
 }
});

/* -------------------------------------------------
   POST /auth/change-password – any logged-in user changes their own password
   Body: { currentPassword, newPassword }
   ------------------------------------------------- */
router.post('/change-password', passwordLimiter, verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Vul je huidige en je nieuwe wachtwoord in.' });
  }
  if (String(newPassword).length < 10) {
    return res.status(400).json({ error: 'Het nieuwe wachtwoord moet minstens 10 tekens lang zijn.' });
  }
  try {
    const [user] = await db.query('SELECT id, password FROM users WHERE id = ?', [req.user.id]);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ error: 'Je huidige wachtwoord klopt niet.' });
    }
    const hash = await bcrypt.hash(String(newPassword), 12);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ message: 'Wachtwoord gewijzigd' });
  } catch (err) {
    console.error('CHANGE PASSWORD error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
