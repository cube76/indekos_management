const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

console.log(`Database Config: Host=${dbConfig.host}, Port=${dbConfig.port}`);

const pool = mysql.createPool(dbConfig);

const db = {
  query: pool.query.bind(pool),
  end: pool.end.bind(pool)
};

async function initDB() {
  try {
    console.log('Initializing database tables...');
    
    // Ensure connection is ready
    await db.query('SELECT 1');

    // Create Buildings Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS buildings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        logo_url VARCHAR(255),
        address TEXT
      )
    `);
    console.log('Buildings table checked/created.');

    // Create Users Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL UNIQUE,
        password VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user'
      )
    `);
    console.log('Users table checked/created.');

    // Create Rooms Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_number VARCHAR(50) NOT NULL UNIQUE,
        building_name VARCHAR(100), -- Legacy, keeping for now but moving towards building_id
        building_id INT,
        price INT DEFAULT 0,
        status ENUM('empty', 'filled') DEFAULT 'empty',
        tenant_name VARCHAR(255),
        tenant_id_number VARCHAR(100),
        tenant_phone VARCHAR(50), 
        occupied_at DATETIME,
        FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL
      )
    `);
    
    // [FIX] Ensure building_id column exists (for existing tables)
    try {
        await db.query(`
            SELECT building_id FROM rooms LIMIT 1
        `);
    } catch (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR') {
             console.log('Adding missing building_id column to rooms table...');
             await db.query(`
                ALTER TABLE rooms 
                ADD COLUMN building_id INT,
                ADD CONSTRAINT fk_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL
             `);
        }
    }

    // Migration: Change price to INT (Remove decimals)
    try {
        await db.query('ALTER TABLE rooms MODIFY price INT DEFAULT 0');
    } catch (err) {
        console.error('Failed to migrate room price to INT:', err);
    }

    console.log('Rooms table checked/created.');

    // Migration: Extract Buildings from Rooms
    try {
        // 1. Check if we need to migrate buildings
        const [existingBuildings] = await db.query('SELECT COUNT(*) as count FROM buildings');
        if (existingBuildings[0].count === 0) {
            console.log('Migrating: Extracting buildings from existing rooms...');
            const [rooms] = await db.query('SELECT DISTINCT building_name FROM rooms WHERE building_name IS NOT NULL');
            
            for (const r of rooms) {
                if(r.building_name) {
                    await db.query('INSERT IGNORE INTO buildings (name) VALUES (?)', [r.building_name]);
                }
            }
            console.log(`Migrated ${rooms.length} buildings.`);
        }

        // 2. Link Rooms to Buildings
        console.log('Migrating: Linking rooms to building_ids...');
        await db.query(`
            UPDATE rooms r
            JOIN buildings b ON r.building_name = b.name
            SET r.building_id = b.id
            WHERE r.building_id IS NULL
        `);
        console.log('Rooms linked to buildings.');

    } catch (err) {
        console.error('Migration failed:', err);
    }

    // Migration: Fix Unique Room Number Constraint (Global -> Per Building)
    try {
        const [indexes] = await db.query("SHOW INDEX FROM rooms WHERE Key_name = 'room_number'");
        if (indexes.length > 0) {
            console.log('Migrating: Dropping global UNIQUE constraint on room_number...');
            await db.query('ALTER TABLE rooms DROP INDEX room_number');
            await db.query('ALTER TABLE rooms ADD UNIQUE KEY unique_room_per_building (building_id, room_number)');
            console.log('Added composite UNIQUE constraint (building_id, room_number).');
        } else {
             // Check if composite exists
             const [composite] = await db.query("SHOW INDEX FROM rooms WHERE Key_name = 'unique_room_per_building'");
             if (composite.length === 0) {
                 await db.query('ALTER TABLE rooms ADD UNIQUE KEY unique_room_per_building (building_id, room_number)');
             }
        }
    } catch (err) {
        console.error('Failed to update room constraints:', err);
    }

    // Create Payments Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        tenant_name VARCHAR(255),
        amount INT NOT NULL,
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        period_start DATETIME NOT NULL,
        period_end DATETIME NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      )
    `);

    // Migration: Change amount to INT (Remove decimals)
    try {
        await db.query('ALTER TABLE payments MODIFY amount INT NOT NULL');
    } catch (err) {
        console.error('Failed to migrate payment amount to INT:', err);
    }
    
    console.log('Payments table checked/created.');

    // Create Push Subscriptions Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        endpoint TEXT NOT NULL,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Push Subscriptions table checked/created.');

    // Migration: Check if tenant_name exists (for existing tables)
    try {
      await db.query('SELECT tenant_name FROM payments LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        console.log('Migrating: Adding tenant_name column to payments table...');
        await db.query('ALTER TABLE payments ADD COLUMN tenant_name VARCHAR(255) AFTER room_id');
      }
    }

    // Migration: Add payment_method and bank_name
    try {
        await db.query('SELECT payment_method FROM payments LIMIT 1');
    } catch (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR') {
            console.log('Migrating: Adding payment_method and bank_name columns to payments table...');
            await db.query(`
                ALTER TABLE payments 
                ADD COLUMN payment_method ENUM('cash', 'transfer') DEFAULT 'cash',
                ADD COLUMN bank_name VARCHAR(50)
            `);
        }
    }

    // Migration: Enforce Case Sensitivity on Users Table
    try {
        // [FIX] Removed UNIQUE to prevent creating duplicate indexes on every restart.
        // The UNIQUE constraint is preserved from creation or previous runs.
        await db.query('ALTER TABLE users MODIFY username VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL');
        await db.query('ALTER TABLE users MODIFY password VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL');
        console.log('Enforced binary collation (Case Sensitivity) on users table.');
    } catch (err) {
        console.error('Failed to migrate case sensitivity:', err);
    }

    // Seed Super Admin
    const [rows] = await db.query('SELECT * FROM users WHERE role = ?', ['superadmin']);
    if (rows.length === 0) {
      const username = process.env.SUPER_ADMIN_USERNAME;
      const password = process.env.SUPER_ADMIN_PASSWORD;
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 
        [username, hashedPassword, 'superadmin']);
      console.log(`Super Admin created: ${username}`);
    } else {
      console.log('Super Admin already exists.');
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

module.exports = { db, initDB };
