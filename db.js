require('dotenv').config();               // loads .env
const mysql = require('mysql2/promise');

// --------------------------------------------
// 1️⃣ Build a connection pool
// -----------------------------------------------
const pool = mysql.createPool({
  host:     process.env.MYSQL_DB_HOST    || '127.0.0.1',
  port:     parseInt(process.env.MYSQL_DB_PORT, 10) || 3306,
  user:     process.env.MYSQL_DB_USER     || 'root',
 password: process.env.MYSQL_DB_PASSWORD || '',
  database: process.env.MYSQL_DB_NAME       || 'esdoorn',
  waitForConnections: true,
  connectionLimit: 10,          // adjust to your traffic
  queueLimit: 0
});

// ------------------------------------------------
// 2️⃣ Tiny helper – mimics the old SQLite API
// -------------------------------------------------
async function query(sql, params) {
  // `pool.execute` returns [rows, fields]; we only need rows
  let [rows] = [];  
  if (params === undefined || !params) {
        [rows] = await pool.execute(sql);
    } else {
        [rows] = await pool.execute(sql, params);
    }

//   const [rows] = await pool.execute(sql, params);
  return rows;                  // array of objects (or empty array)
}

// --------------------------------------------
// 3️⃣ Export the pool (for transactions) and the helper
// -----------------------------------------
module.exports = {
  pool,          // for explicit transaction handling if you need it
  query          // simple SELECT/INSERT/UPDATE/DELETE wrapper
};