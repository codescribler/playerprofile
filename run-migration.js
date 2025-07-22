const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkAndRunMigration() {
  const client = await pool.connect();
  
  try {
    // Check if migration is needed
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'players' AND column_name = 'data'
    `);
    
    if (rows.length === 0) {
      console.log('Database is already using normalized schema. No migration needed.');
      return { success: true, message: 'Already migrated' };
    }
    
    console.log('Legacy JSON schema detected. Starting migration...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Get all existing players
    const { rows: players } = await client.query('SELECT * FROM players');
    console.log(`Found ${players.length} players to migrate`);
    
    // Create a temporary table with new schema
    await client.query(`CREATE TABLE IF NOT EXISTS players_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      date_of_birth DATE,
      nationality VARCHAR(100),
      height_cm INTEGER,
      height_feet INTEGER,
      height_inches INTEGER,
      weight_kg DECIMAL(5,2),
      weight_lbs DECIMAL(5,2),
      preferred_foot VARCHAR(10) CHECK (preferred_foot IN ('Left', 'Right', 'Both')),
      weak_foot_strength INTEGER CHECK (weak_foot_strength >= 0 AND weak_foot_strength <= 100),
      player_phone VARCHAR(20),
      player_email VARCHAR(255),
      guardian_name VARCHAR(200),
      guardian_phone VARCHAR(20),
      guardian_email VARCHAR(255),
      years_playing INTEGER,
      based_location VARCHAR(255),
      current_school VARCHAR(255),
      grade_year VARCHAR(50),
      postcode VARCHAR(10),
      city VARCHAR(100),
      county VARCHAR(100),
      country VARCHAR(100),
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),
      availability_status VARCHAR(20) CHECK (availability_status IN ('looking', 'not_looking', 'considering')),
      willing_to_relocate BOOLEAN DEFAULT FALSE,
      travel_radius INTEGER,
      showcase_description TEXT,
      playing_style_summary TEXT,
      profile_photo TEXT,
      is_published BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )`);
    
    // Create related tables
    await client.query(`CREATE TABLE IF NOT EXISTS player_positions (
      id SERIAL PRIMARY KEY,
      player_id TEXT NOT NULL,
      position VARCHAR(50) NOT NULL,
      suitability INTEGER CHECK (suitability >= 0 AND suitability <= 100),
      notes TEXT,
      position_order INTEGER,
      is_primary BOOLEAN DEFAULT FALSE
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS player_teams (
      id SERIAL PRIMARY KEY,
      player_id TEXT NOT NULL,
      club_name VARCHAR(255) NOT NULL,
      league VARCHAR(255),
      is_primary BOOLEAN DEFAULT FALSE,
      start_date DATE,
      end_date DATE
    )`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS player_abilities (
      player_id TEXT PRIMARY KEY,
      ball_control INTEGER CHECK (ball_control >= 1 AND ball_control <= 10),
      passing INTEGER CHECK (passing >= 1 AND passing <= 10),
      shooting INTEGER CHECK (shooting >= 1 AND shooting <= 10),
      dribbling INTEGER CHECK (dribbling >= 1 AND dribbling <= 10),
      first_touch INTEGER CHECK (first_touch >= 1 AND first_touch <= 10),
      crossing INTEGER CHECK (crossing >= 1 AND crossing <= 10),
      tackling INTEGER CHECK (tackling >= 1 AND tackling <= 10),
      heading INTEGER CHECK (heading >= 1 AND heading <= 10),
      pace INTEGER CHECK (pace >= 1 AND pace <= 10),
      strength INTEGER CHECK (strength >= 1 AND strength <= 10),
      stamina INTEGER CHECK (stamina >= 1 AND stamina <= 10),
      agility INTEGER CHECK (agility >= 1 AND agility <= 10),
      balance INTEGER CHECK (balance >= 1 AND balance <= 10),
      jumping INTEGER CHECK (jumping >= 1 AND jumping <= 10),
      decision_making INTEGER CHECK (decision_making >= 1 AND decision_making <= 10),
      positioning INTEGER CHECK (positioning >= 1 AND positioning <= 10),
      concentration INTEGER CHECK (concentration >= 1 AND concentration <= 10),
      leadership INTEGER CHECK (leadership >= 1 AND leadership <= 10),
      communication INTEGER CHECK (communication >= 1 AND communication <= 10),
      sprint_10m DECIMAL(4,2),
      sprint_30m DECIMAL(4,2),
      run_1km DECIMAL(5,2),
      bleep_test DECIMAL(3,1)
    )`);
    
    // Migrate each player
    let migrated = 0;
    for (const player of players) {
      try {
        const data = JSON.parse(player.data);
        
        // Insert into new players table
        await client.query(`
          INSERT INTO players_new (
            id, user_id, first_name, last_name, date_of_birth, nationality,
            height_cm, height_feet, height_inches, weight_kg, weight_lbs,
            preferred_foot, weak_foot_strength,
            player_phone, player_email, guardian_name, guardian_phone, guardian_email,
            years_playing, based_location, current_school, grade_year,
            postcode, city, county, country, latitude, longitude,
            availability_status, willing_to_relocate, travel_radius,
            showcase_description, playing_style_summary, profile_photo,
            is_published, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
            $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37
          )
        `, [
          player.id,
          player.user_id,
          data.personalInfo?.firstName || '',
          data.personalInfo?.lastName || '',
          data.personalInfo?.dateOfBirth || null,
          data.personalInfo?.nationality || null,
          data.personalInfo?.height?.centimeters || null,
          data.personalInfo?.height?.feet || null,
          data.personalInfo?.height?.inches || null,
          data.personalInfo?.weight?.kilograms || null,
          data.personalInfo?.weight?.pounds || null,
          data.personalInfo?.preferredFoot || null,
          data.personalInfo?.weakFootStrength || null,
          data.contactInfo?.player?.phone || null,
          data.contactInfo?.player?.email || null,
          data.contactInfo?.guardian?.name || null,
          data.contactInfo?.guardian?.phone || null,
          data.contactInfo?.guardian?.email || null,
          data.playingInfo?.yearsPlaying || null,
          data.playingInfo?.basedLocation || null,
          data.academicInfo?.currentSchool || null,
          data.academicInfo?.gradeYear || null,
          data.location?.postcode || null,
          data.location?.city || null,
          data.location?.county || null,
          data.location?.country || null,
          data.location?.coordinates?.latitude || null,
          data.location?.coordinates?.longitude || null,
          data.availability?.status || 'not_looking',
          data.availability?.willingToRelocate || false,
          data.availability?.travelRadius || null,
          data.showcase?.description || null,
          data.playingStyle?.summary || null,
          data.media?.profilePhoto || null,
          player.is_published,
          player.created_at,
          player.updated_at
        ]);
        
        // Insert positions
        if (data.playingInfo?.positions?.length > 0) {
          for (let i = 0; i < data.playingInfo.positions.length; i++) {
            const pos = data.playingInfo.positions[i];
            await client.query(`
              INSERT INTO player_positions (player_id, position, suitability, notes, position_order, is_primary)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              player.id,
              pos.position,
              pos.suitability || null,
              pos.notes || null,
              pos.order || i,
              i === 0
            ]);
          }
        }
        
        // Insert teams
        if (data.playingInfo?.teams?.length > 0) {
          for (const team of data.playingInfo.teams) {
            await client.query(`
              INSERT INTO player_teams (player_id, club_name, league, is_primary)
              VALUES ($1, $2, $3, $4)
            `, [
              player.id,
              team.clubName,
              team.league || null,
              team.isPrimary || false
            ]);
          }
        }
        
        // Insert abilities
        if (data.abilities) {
          await client.query(`
            INSERT INTO player_abilities (
              player_id,
              ball_control, passing, shooting, dribbling, first_touch, crossing, tackling, heading,
              pace, strength, stamina, agility, balance, jumping,
              decision_making, positioning, concentration, leadership, communication,
              sprint_10m, sprint_30m, run_1km, bleep_test
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
              $16, $17, $18, $19, $20, $21, $22, $23, $24
            )
          `, [
            player.id,
            data.abilities?.technical?.ballControl?.rating || null,
            data.abilities?.technical?.passing?.rating || null,
            data.abilities?.technical?.shooting?.rating || null,
            data.abilities?.technical?.dribbling?.rating || null,
            data.abilities?.technical?.firstTouch?.rating || null,
            data.abilities?.technical?.crossing?.rating || null,
            data.abilities?.technical?.tackling?.rating || null,
            data.abilities?.technical?.heading?.rating || null,
            data.abilities?.physical?.pace?.rating || null,
            data.abilities?.physical?.strength?.rating || null,
            data.abilities?.physical?.stamina?.rating || null,
            data.abilities?.physical?.agility?.rating || null,
            data.abilities?.physical?.balance?.rating || null,
            data.abilities?.physical?.jumping?.rating || null,
            data.abilities?.mental?.decisionMaking?.rating || null,
            data.abilities?.mental?.positioning?.rating || null,
            data.abilities?.mental?.concentration?.rating || null,
            data.abilities?.mental?.leadership?.rating || null,
            data.abilities?.mental?.communication?.rating || null,
            data.abilities?.athletic?.sprint10m || null,
            data.abilities?.athletic?.sprint30m || null,
            data.abilities?.athletic?.run1km || null,
            data.abilities?.athletic?.bleepTest || null
          ]);
        }
        
        migrated++;
        console.log(`Migrated player ${player.id}: ${data.personalInfo?.firstName} ${data.personalInfo?.lastName}`);
        
      } catch (err) {
        console.error(`Error migrating player ${player.id}:`, err);
        throw err;
      }
    }
    
    // Add foreign key constraints
    await client.query('ALTER TABLE player_positions ADD CONSTRAINT fk_positions_player FOREIGN KEY (player_id) REFERENCES players_new(id) ON DELETE CASCADE');
    await client.query('ALTER TABLE player_teams ADD CONSTRAINT fk_teams_player FOREIGN KEY (player_id) REFERENCES players_new(id) ON DELETE CASCADE');
    await client.query('ALTER TABLE player_abilities ADD CONSTRAINT fk_abilities_player FOREIGN KEY (player_id) REFERENCES players_new(id) ON DELETE CASCADE');
    
    // Create indexes
    await client.query('CREATE INDEX idx_players_name ON players_new(first_name, last_name)');
    await client.query('CREATE INDEX idx_players_user_id ON players_new(user_id)');
    await client.query('CREATE INDEX idx_players_dob ON players_new(date_of_birth)');
    await client.query('CREATE INDEX idx_players_location ON players_new(city, postcode)');
    await client.query('CREATE INDEX idx_players_coords ON players_new(latitude, longitude)');
    await client.query('CREATE INDEX idx_players_published ON players_new(is_published)');
    await client.query('CREATE INDEX idx_players_availability ON players_new(availability_status, willing_to_relocate)');
    await client.query('CREATE INDEX idx_players_physical ON players_new(height_cm, preferred_foot)');
    
    await client.query('CREATE INDEX idx_positions_player ON player_positions(player_id)');
    await client.query('CREATE INDEX idx_positions_lookup ON player_positions(position, player_id)');
    await client.query('CREATE INDEX idx_teams_player ON player_teams(player_id)');
    await client.query('CREATE INDEX idx_abilities_player ON player_abilities(player_id)');
    
    // Rename tables
    await client.query('ALTER TABLE players RENAME TO players_old');
    await client.query('ALTER TABLE players_new RENAME TO players');
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log(`Migration completed successfully! Migrated ${migrated} players.`);
    return { success: true, message: `Migrated ${migrated} players successfully` };
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

// If run directly
if (require.main === module) {
  checkAndRunMigration()
    .then(result => {
      console.log('Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { checkAndRunMigration };