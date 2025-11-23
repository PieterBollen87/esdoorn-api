// seed-users.js
// -------------------------------------------------
//  Create a single user (Pieter) with a bcrypt‑hashed password
// -------------------------------------------------
require('dotenv').config();          // loads .env (MySQL creds, JWT secret, etc.)
const db = require('./db');          // your MySQL wrapper (the same one used by the API)
const bcrypt = require('bcrypt');

(async () => {
  const username = 'Pieter';
  const email    = 'pieter@example.com';   // any dummy email works
  const plainPwd = 'Slacking9-Jackal2-Showing1-Ample0-Agency3';   // <‑‑ change this to whatever you want
  const role     = 'admin';                // make him an admin (or 'user' if you prefer)

  try {
    // 1️⃣ Check if the user already exists (avoid duplicates)
    const existing = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (existing) {
      console.log(`⚠️ User "${username}" already exists (id=${existing.id}).`);
      process.exit(0);
    }

    // 2️⃣ Hash the password (cost factor 12 = same as registration code)
    const hash = await bcrypt.hash(plainPwd, 12);
    console.log('✅ Password hashed:', hash);

    // 3️⃣ Insert the new user
    const sql = `
      INSERT INTO users (username, email, passwordHash, role)
      VALUES (?,?,?,?)
    `;
    const result = await db.run(sql, [username, email, hash, role]);

    console.log(`🎉 User created! id=${result.insertId}, username="${username}", role="${role}"`);
    process.exit(0);
  } catch (err) {
    // Duplicate username/email → MySQL error code ER_DUP_ENTRY
    if (err.code === 'ER_DUP_ENTRY') {
      console.error('❌ Duplicate username or email.');
    } else {
      console.error('❌ Unexpected error:', err);
    }
    process.exit(1);
  }
})();