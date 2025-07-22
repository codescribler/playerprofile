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

    // Check if we need to run the new normalized schema
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'players' AND column_name = 'data'
    `);
    
    if (rows.length > 0) {
      console.log('Legacy JSON schema detected. Run migrations/normalize-database.sql to upgrade.');
      // Keep old schema for now
      await pool.query(`CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        data TEXT NOT NULL,
        is_published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);
    } else {
      // Create normalized schema
      console.log('Creating normalized database schema...');
      
      await pool.query(`CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        
        -- Personal Information
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        date_of_birth DATE NOT NULL,
        nationality VARCHAR(100),
        
        -- Physical Attributes
        height_cm INTEGER,
        height_feet INTEGER,
        height_inches INTEGER,
        weight_kg DECIMAL(5,2),
        weight_lbs DECIMAL(5,2),
        preferred_foot VARCHAR(10) CHECK (preferred_foot IN ('Left', 'Right', 'Both')),
        weak_foot_strength INTEGER CHECK (weak_foot_strength >= 0 AND weak_foot_strength <= 100),
        
        -- Contact Information
        player_phone VARCHAR(20),
        player_email VARCHAR(255),
        guardian_name VARCHAR(200),
        guardian_phone VARCHAR(20),
        guardian_email VARCHAR(255),
        
        -- Playing Information
        years_playing INTEGER,
        based_location VARCHAR(255),
        
        -- Academic Information
        current_school VARCHAR(255),
        grade_year VARCHAR(50),
        
        -- Location
        postcode VARCHAR(10),
        city VARCHAR(100),
        county VARCHAR(100),
        country VARCHAR(100),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        
        -- Availability
        availability_status VARCHAR(20) CHECK (availability_status IN ('looking', 'not_looking', 'considering')),
        willing_to_relocate BOOLEAN DEFAULT FALSE,
        travel_radius INTEGER,
        
        -- Showcase
        showcase_description TEXT,
        
        -- Playing Style
        playing_style_summary TEXT,
        
        -- Media
        profile_photo TEXT,
        
        -- Metadata
        is_published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Create related tables
      await pool.query(`CREATE TABLE IF NOT EXISTS player_positions (
        id SERIAL PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        position VARCHAR(50) NOT NULL,
        suitability INTEGER CHECK (suitability >= 0 AND suitability <= 100),
        notes TEXT,
        position_order INTEGER,
        is_primary BOOLEAN DEFAULT FALSE
      )`);
      
      await pool.query(`CREATE TABLE IF NOT EXISTS player_teams (
        id SERIAL PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        club_name VARCHAR(255) NOT NULL,
        league VARCHAR(255),
        is_primary BOOLEAN DEFAULT FALSE,
        start_date DATE,
        end_date DATE
      )`);
      
      await pool.query(`CREATE TABLE IF NOT EXISTS player_abilities (
        player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
        
        -- Technical abilities (1-10)
        ball_control INTEGER CHECK (ball_control >= 1 AND ball_control <= 10),
        passing INTEGER CHECK (passing >= 1 AND passing <= 10),
        shooting INTEGER CHECK (shooting >= 1 AND shooting <= 10),
        dribbling INTEGER CHECK (dribbling >= 1 AND dribbling <= 10),
        first_touch INTEGER CHECK (first_touch >= 1 AND first_touch <= 10),
        crossing INTEGER CHECK (crossing >= 1 AND crossing <= 10),
        tackling INTEGER CHECK (tackling >= 1 AND tackling <= 10),
        heading INTEGER CHECK (heading >= 1 AND heading <= 10),
        
        -- Physical abilities (1-10)
        pace INTEGER CHECK (pace >= 1 AND pace <= 10),
        strength INTEGER CHECK (strength >= 1 AND strength <= 10),
        stamina INTEGER CHECK (stamina >= 1 AND stamina <= 10),
        agility INTEGER CHECK (agility >= 1 AND agility <= 10),
        balance INTEGER CHECK (balance >= 1 AND balance <= 10),
        jumping INTEGER CHECK (jumping >= 1 AND jumping <= 10),
        
        -- Mental abilities (1-10)
        decision_making INTEGER CHECK (decision_making >= 1 AND decision_making <= 10),
        positioning INTEGER CHECK (positioning >= 1 AND positioning <= 10),
        concentration INTEGER CHECK (concentration >= 1 AND concentration <= 10),
        leadership INTEGER CHECK (leadership >= 1 AND leadership <= 10),
        communication INTEGER CHECK (communication >= 1 AND communication <= 10),
        
        -- Athletic performance
        sprint_10m DECIMAL(4,2),
        sprint_30m DECIMAL(4,2),
        run_1km DECIMAL(5,2),
        bleep_test DECIMAL(3,1)
      )`);
      
      await pool.query(`CREATE TABLE IF NOT EXISTS player_representative_teams (
        id SERIAL PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        level VARCHAR(50) CHECK (level IN ('district', 'county', 'national')),
        team_name VARCHAR(255),
        season VARCHAR(50)
      )`);
      
      await pool.query(`CREATE TABLE IF NOT EXISTS player_trophies (
        id SERIAL PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        season VARCHAR(50),
        description TEXT
      )`);
      
      await pool.query(`CREATE TABLE IF NOT EXISTS player_strengths (
        id SERIAL PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        strength TEXT NOT NULL
      )`);
      
      await pool.query(`CREATE TABLE IF NOT EXISTS player_weaknesses (
        id SERIAL PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        weakness TEXT NOT NULL
      )`);
      
      await pool.query(`CREATE TABLE IF NOT EXISTS player_preferred_locations (
        id SERIAL PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        location VARCHAR(255) NOT NULL
      )`);
      
      // Create indexes
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_name ON players(first_name, last_name)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_dob ON players(date_of_birth)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_location ON players(city, postcode)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_coords ON players(latitude, longitude)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_published ON players(is_published)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_availability ON players(availability_status, willing_to_relocate)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_players_physical ON players(height_cm, preferred_foot)`);
      
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_positions_player ON player_positions(player_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_positions_lookup ON player_positions(position, player_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_teams_player ON player_teams(player_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_abilities_player ON player_abilities(player_id)`);
    }

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