const mysql = require('mysql2/promise');
require('dotenv').config();

async function setup() {
  try {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD
    };
    console.log('Using password:', dbConfig);

    console.log(`Attempting connection to ${dbConfig.host}:${dbConfig.port}...`);
    const connection = await mysql.createConnection(dbConfig);
    
    const dbName = process.env.DB_NAME || 'residence_db';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.query(`USE \`${dbName}\``);
    await connection.query('DROP TABLE IF EXISTS payments');
    await connection.query('DROP TABLE IF EXISTS rooms');
    await connection.query('DROP TABLE IF EXISTS users');
    console.log(`Database ${dbName} prepared (tables dropped).`);
    
    await connection.end();
  } catch (error) {
    console.error('Failed to create DB:', error);
    process.exit(1);
  }
}

setup();
