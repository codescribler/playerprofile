const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// Determine which database to use based on environment
console.log('Environment check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL preview:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'not set');

let db;

if (process.env.DATABASE_URL) {
  // Use PostgreSQL for production (Railway)
  console.log('Using PostgreSQL database');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Create a wrapper to make PostgreSQL work with SQLite-like API
  db = {
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        player_id TEXT,
        sender_name TEXT,
        sender_email TEXT,
        sender_phone TEXT,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_player_id ON messages(player_id)`);
      
      console.log('PostgreSQL tables initialized');
    } catch (err) {
      console.error('Error initializing PostgreSQL tables:', err);
    }
  };

  initPgTables();

} else {
  // Use SQLite for development
  console.log('Using SQLite database');
  const dbPath = path.join(__dirname, 'playerprofile.db');
  db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'player',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id TEXT,
      sender_name TEXT,
      sender_email TEXT,
      sender_phone TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (player_id) REFERENCES players (id)
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_players_visibility ON players(json_extract(data, '$.metadata.visibility'))`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_players_name ON players(json_extract(data, '$.personalInfo.fullName'))`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_players_position ON players(json_extract(data, '$.playingInfo.primaryPosition'))`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_player_id ON messages(player_id)`);
    
    console.log('SQLite tables initialized');
  });
}

module.exports = db;