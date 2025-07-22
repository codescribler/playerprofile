const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateData() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration from JSON to normalized tables...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Get all existing players
    const { rows: players } = await client.query('SELECT * FROM players');
    console.log(`Found ${players.length} players to migrate`);
    
    for (const player of players) {
      try {
        const data = JSON.parse(player.data);
        console.log(`Migrating player ${player.id}: ${data.personalInfo?.firstName} ${data.personalInfo?.lastName}`);
        
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
            $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38
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
              i === 0 // First position is primary
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
        
        // Insert representative teams
        if (data.playingInfo?.representativeTeams?.district?.selected === 'Yes') {
          await client.query(`
            INSERT INTO player_representative_teams (player_id, level, season)
            VALUES ($1, $2, $3)
          `, [player.id, 'district', data.playingInfo.representativeTeams.district.season || null]);
        }
        if (data.playingInfo?.representativeTeams?.county?.selected === 'Yes') {
          await client.query(`
            INSERT INTO player_representative_teams (player_id, level, season)
            VALUES ($1, $2, $3)
          `, [player.id, 'county', data.playingInfo.representativeTeams.county.season || null]);
        }
        
        // Insert trophies
        if (data.playingInfo?.trophiesAwards?.length > 0) {
          for (const trophy of data.playingInfo.trophiesAwards) {
            await client.query(`
              INSERT INTO player_trophies (player_id, title, season)
              VALUES ($1, $2, $3)
            `, [player.id, trophy.title, trophy.season || null]);
          }
        }
        
        // Insert strengths and weaknesses
        if (data.playingStyle?.strengths?.length > 0) {
          for (const strength of data.playingStyle.strengths) {
            await client.query(`
              INSERT INTO player_strengths (player_id, strength)
              VALUES ($1, $2)
            `, [player.id, strength]);
          }
        }
        if (data.playingStyle?.weaknesses?.length > 0) {
          for (const weakness of data.playingStyle.weaknesses) {
            await client.query(`
              INSERT INTO player_weaknesses (player_id, weakness)
              VALUES ($1, $2)
            `, [player.id, weakness]);
          }
        }
        
        // Insert preferred locations
        if (data.availability?.preferredLocations?.length > 0) {
          for (const location of data.availability.preferredLocations) {
            await client.query(`
              INSERT INTO player_preferred_locations (player_id, location)
              VALUES ($1, $2)
            `, [player.id, location]);
          }
        }
        
      } catch (err) {
        console.error(`Error migrating player ${player.id}:`, err);
        throw err;
      }
    }
    
    // Update player_locations table if it exists
    await client.query(`
      INSERT INTO player_locations (player_id, latitude, longitude, city)
      SELECT id, latitude, longitude, city 
      FROM players_new 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ON CONFLICT (player_id) DO UPDATE 
      SET latitude = EXCLUDED.latitude, 
          longitude = EXCLUDED.longitude, 
          city = EXCLUDED.city
    `).catch(() => {});
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('Migration completed successfully!');
    
    // Rename tables
    console.log('Renaming tables...');
    await client.query('ALTER TABLE players RENAME TO players_old');
    await client.query('ALTER TABLE players_new RENAME TO players');
    
    console.log('Migration complete! Old data preserved in players_old table.');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run migration
migrateData()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });