// middleware/auth.js
const jwt = require('jsonwebtoken');
const db  = require('../db');

/**
 * The secret that signs admin logins. It MUST be set in the server's .env (JWT_SECRET=...).
 * There is deliberately no fallback: a default value would be visible in the code,
 * and anyone who knows it could create their own admin login.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'CHANGE_ME_IN_PROD') return null;
  return secret;
}

/* Verify JWT, load user, attach to req.user */
function verifyToken(req, res, next) {
  const secret = getJwtSecret();
  if (!secret) {
    console.error('JWT_SECRET is not set in .env – admin actions are disabled until it is.');
    return res.status(503).json({ error: 'Server not configured for login (JWT_SECRET missing)' });
  }
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const token = authHeader.split(' ')[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ error: 'Malformed Authorization header' });

  jwt.verify(token, secret, async (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    try {
      // payload contains sub (user id) and role (admin/user)
      const users = await db.query('SELECT id, username, role, doctorId FROM users WHERE id = ?', [payload.sub]);
      const user = users[0] ?? null;
      if (!user) return res.status(401).json({ error: 'User not found' });
      req.user = { id: user.id, username: user.username, role: user.role, doctorId: user.doctorId ?? null };
      next();
    } catch (dbErr) {
      // Without this catch a database hiccup would crash the whole API process
      console.error('VERIFY TOKEN error:', dbErr.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
/* Admin‑only guard */
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Admin privileges required' });
}

/*
 * Roles:
 *  admin      – everything
 *  secretary  – messages, doctors (add/edit/order), everyone's leave, creating doctor accounts
 *  doctor     – only their own leave and their own details (account linked via doctorId)
 */
const isStaff = user => !!user && (user.role === 'admin' || user.role === 'secretary');

/* Admin or secretary */
function requireStaff(req, res, next) {
  if (isStaff(req.user)) return next();
  return res.status(403).json({ error: 'Geen toegang' });
}

/* Admin, secretary, or a doctor whose account is linked to a doctor (for "Mijn verlof" / "Mijn gegevens") */
function requireStaffOrDoctor(req, res, next) {
  if (isStaff(req.user)) return next();
  if (req.user && req.user.role === 'doctor' && req.user.doctorId) return next();
  return res.status(403).json({ error: 'Geen toegang' });
}

module.exports = { verifyToken, requireAdmin, requireStaff, requireStaffOrDoctor, isStaff, getJwtSecret };