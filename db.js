// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'esdoorn.db');
const db = new sqlite3.Database(DB_PATH, err => {
  if (err) {
    console.error('❌ Failed to open DB:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite DB at', DB_PATH);
});

/* -------------------------------------------------
   Run the migration if tables are missing
   ------------------------------------------ */
db.serialize(() => {
  const sql = `
    CREATE TABLE IF NOT EXISTS welcome (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      html TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstname TEXT NOT NULL,
      lastname  TEXT NOT NULL,
      email     TEXT NOT NULL,
      phone     TEXT NOT NULL,
      agendaUrl TEXT NOT NULL,
      imagePath TEXT
    );

    CREATE TABLE IF NOT EXISTS urgency (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      html TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
    doctorId INTEGER NOT NULL,
      startDate TEXT NOT NULL,   -- ISO‑8601 (YYYY-MM-DD)
      endDate   TEXT NOT NULL,
      FOREIGN KEY (doctorId) REFERENCES doctors(id) ON DELETE CASCADE
    );
  `;
  db.exec(sql);
});

module.exports = db;