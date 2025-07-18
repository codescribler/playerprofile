const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'playerprofile.db');
const db = new sqlite3.Database(dbPath);

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

  // Create messages table
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
});

module.exports = db;