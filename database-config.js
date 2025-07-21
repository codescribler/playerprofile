const { Pool } = require('pg');

// PostgreSQL configuration
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Please set DATABASE_URL with your PostgreSQL connection string');
  process.exit(1);
}

console.log('Using PostgreSQL database');
console.log('DATABASE_URL preview:', process.env.DATABASE_URL.substring(0, 20) + '...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create a wrapper to maintain compatibility with existing code
const db = {
  get: (sql, params, callback) => {
    let paramIndex = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
    
    console.log('PostgreSQL GET query:', pgSql, 'params:', params);
    
    pool.query(pgSql, params, (err, result) => {
      if (err) {
        console.error('PostgreSQL GET error:', err);
        return callback(err);
      }
      callback(null, result.rows[0]);
    });
  },
  
  all: (sql, params, callback) => {
    let paramIndex = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
    
    console.log('PostgreSQL ALL query:', pgSql, 'params:', params);
    
    pool.query(pgSql, params, (err, result) => {
      if (err) {
        console.error('PostgreSQL ALL error:', err);
        return callback(err);
      }
      callback(null, result.rows);
    });
  },
  
  run: (sql, params, callback) => {
    let paramIndex = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
    
    console.log('PostgreSQL RUN query:', pgSql, 'params:', params);
    
    pool.query(pgSql, params, (err, result) => {
      if (err) {
        console.error('PostgreSQL RUN error:', err);
        return callback(err);
      }
      callback.call({ changes: result.rowCount }, null);
    });
  },
  
  serialize: (callback) => {
    callback();
  }
};

// Initialize PostgreSQL tables
const initPgTables = async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'player',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      is_published BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Add missing columns to existing tables
    await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE`).catch(() => {});
    await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => {});

    await pool.query(`CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      player_id TEXT,
      sender_name TEXT,
      sender_email TEXT,
      sender_phone TEXT,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_read BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (player_id) REFERENCES players (id)
    )`);

    // Rename 'read' column to 'is_read' if it exists
    await pool.query(`ALTER TABLE messages RENAME COLUMN read TO is_read`).catch(() => {});
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE`).catch(() => {});

    // Create player_locations table for location-based searches
    await pool.query(`CREATE TABLE IF NOT EXISTS player_locations (
      player_id TEXT PRIMARY KEY,
      latitude FLOAT,
      longitude FLOAT,
      city TEXT,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )`);

    // Create indexes only after columns exist
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_is_published ON players(is_published)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_player_id ON messages(player_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_locations_coords ON player_locations(latitude, longitude)`).catch(() => {});
    
    console.log('PostgreSQL tables initialized');
  } catch (err) {
    console.error('Error initializing PostgreSQL tables:', err);
    throw err;
  }
};

initPgTables();

module.exports = db;