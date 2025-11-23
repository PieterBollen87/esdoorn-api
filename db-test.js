import 'dotenv/config';       // loads .env automatically
import mysql from 'mysql2/promise';

console.log(process.env.MYSQL_DB_HOST);
async function main() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_DB_HOST,
        user: process.env.MYSQL_DB_USER,
        password: process.env.MYSQL_DB_PASSWORD,
        database: process.env.MYSQL_DB_NAME,
        port: process.env.MYSQL_DB_PORT || 3306,
    });

    const [rows] = await connection.execute('SELECT * FROM users');
    console.log(rows);

    await connection.end();
}

main().catch(console.error);