// middleware/auth.js
const jwt = require('jsonwebtoken');
const db  = require('../db');

/* Verify JWT, load user, attach to req.user */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const token = authHeader.split(' ')[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ error: 'Malformed Authorization header' });

  jwt.verify(token, process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD', async (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });

    // payload contains sub (user id) and role (admin/user)
    const user = await db.get('SELECT id, username, role FROM users WHERE id = ?', [payload.sub]);
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  });
}
/* Admin‑only guard */
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Admin privileges required' });
}

module.exports = { verifyToken, requireAdmin };