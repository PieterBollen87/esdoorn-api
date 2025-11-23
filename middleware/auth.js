// middleware/auth.js
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const token = authHeader.split(' ')[1]; // Expect "Bearer <token>"
  if (!token) return res.status(401).json({ error: 'Malformed Authorization header' });

  jwt.verify(token, process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD', (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    // Attach payload to request for downstream use (optional)
    req.user = payload;
    next();
  });
}

module.exports = verifyToken;