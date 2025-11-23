// server.js
require('dotenv').config();               // optional – loads .env
const express = require('express');
const cors = require('cors');
const helmet  = require('helmet');
const path = require('path');

const app = express();
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

// -----------------------------------------------------------------
// Route registration
// ----------------------------------------------------------
app.use('/auth', require('./routes/auth'));

const verifyToken = require('./middleware/auth');
app.use(verifyToken);   // <-- everything below needs auth
app.use('/urgency', require('./routes/urgency'));
app.use('/doctors', require('./routes/doctors'));
app.use('/holidays', require('./routes/holidays'));
app.use('/welcome', require('./routes/welcome'));

// -----------------------------------------------------------------
// Simple health‑check
// -----------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'esdoorn‑api is running',
    endpoints: ['/welcome', '/doctors', '/urgency', '/holidays']
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
  }

// // -----------------------------------------------------------------
// // Start server
// // -----------------------------------------------------------------
// app.listen(PORT, () => {
//   console.log(`🚀 esdoorn‑api listening on http://localhost:${PORT}`);
// });
