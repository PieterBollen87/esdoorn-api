// server.js
require('dotenv').config();               // optional – loads .env
const express = require('express');
const cors = require('cors');
const helmet  = require('helmet');
const path = require('path');

const { verifyToken, requireAdmin } = require('./middleware/auth');


const app = express();
if (!require('./middleware/auth').getJwtSecret()) {
  console.error('⚠️  JWT_SECRET is missing in .env – admin login is DISABLED until you add it.');
}
const PORT = process.env.PORT || 3000;


// -----------------------------------------------------------------
// Global middlewares
// -----------------------------------------------------------------
app.use(helmet());                       // security headers
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' })); // restrict in prod
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/users', require('./routes/users'));
// -----------------------------------------------------------------
// Route registration
// ----------------------------------------------------------
app.use('/auth', require('./routes/auth'));
app.use('/urgency', require('./routes/urgency'));
app.use('/doctors', require('./routes/doctors'));
app.use('/holidays', require('./routes/holidays'));
app.use('/welcome', require('./routes/welcome'));
app.use('/messages', require('./routes/messages'));
// app.use('/users', requireAdmin, require('./routes/users'));

// -----------------------------------------------------------------
// Simple health‑check
// -----------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'esdoorn‑api is running',
    endpoints: ['/welcome', '/messages', '/doctors', '/urgency', '/holidays', '/doctors/holidays', '/doctors_with_holidays']
  });
});

// -------------------------------------------------------
// HTTPS (dev only) – self‑signed certs
// -----------------------------------------------------------------
if (process.env.NODE_ENV === 'development') {
    const https = require('https');
    const fs = require('fs');
    const sslOptions = {
      key: fs.readFileSync(path.join(__dirname, 'ssl/key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'ssl/cert.pem'))
    };
    https.createServer(sslOptions, app).listen(PORT, () => {
      console.log(`🔐 HTTPS server listening on https://localhost:${PORT}`);
    });
  } else {
    // Production – plain HTTP (behind a reverse‑proxy that terminates TLS)
    app.listen(PORT, () => console.log(`🚀 API listening on http://localhost:${PORT}`));
    console.log(`🔐 HTT server listening on https://localhost:${PORT}`);
    console.log('test');
  }

// // -----------------------------------------------------------------
// // Start server
// // -----------------------------------------------------------------
// app.listen(PORT, () => {
//   console.log(`🚀 esdoorn‑api listening on http://localhost:${PORT}`);
// });
