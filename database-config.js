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
  },
  
  prepare: (sql) => {
    // PostgreSQL doesn't need prepare statements in the same way
    // Return an object that mimics SQLite's prepared statement
    return {
      run: (params, callback) => {
        db.run(sql, params, callback);
      },
      finalize: () => {
        // No-op for PostgreSQL
      }
    };
  },
  
  // Direct PostgreSQL query access for complex queries
  query: (sql, params) => pool.query(sql, params)
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

    // Create saved searches table
    await pool.query(`CREATE TABLE IF NOT EXISTS saved_searches (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      criteria TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Create player lists table
    await pool.query(`CREATE TABLE IF NOT EXISTS player_lists (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Create player list members table
    await pool.query(`CREATE TABLE IF NOT EXISTS player_list_members (
      id SERIAL PRIMARY KEY,
      list_id INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      notes TEXT,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (list_id) REFERENCES player_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      UNIQUE(list_id, player_id)
    )`);

    // Create indexes only after columns exist
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_is_published ON players(is_published)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_player_id ON messages(player_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_locations_coords ON player_locations(latitude, longitude)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_lists_user_id ON player_lists(user_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_list_members_list_id ON player_list_members(list_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_list_members_player_id ON player_list_members(player_id)`).catch(() => {});
    
    // Migrate metadata.published to is_published column
    console.log('Checking for is_published migration...');
    try {
      const result = await pool.query('SELECT id, data FROM players WHERE is_published IS NULL');
      if (result.rows.length > 0) {
        console.log(`Found ${result.rows.length} players to migrate is_published status`);
        for (const row of result.rows) {
          try {
            const playerData = JSON.parse(row.data);
            const isPublished = playerData.metadata?.published === true;
            await pool.query(
              'UPDATE players SET is_published = $1 WHERE id = $2',
              [isPublished, row.id]
            );
            console.log(`Migrated player ${row.id}: is_published = ${isPublished}`);
          } catch (e) {
            console.error(`Error migrating player ${row.id}:`, e);
          }
        }
      }
      
      // Set any remaining NULL values to false
      await pool.query('UPDATE players SET is_published = false WHERE is_published IS NULL');
      console.log('is_published migration complete');
    } catch (err) {
      console.error('Error during is_published migration:', err);
    }
    
    console.log('PostgreSQL tables initialized');
  } catch (err) {
    console.error('Error initializing PostgreSQL tables:', err);
    throw err;
  }
};

initPgTables();

module.exports = db;
module.exports.getDb = () => db;