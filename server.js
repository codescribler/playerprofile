const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database-config');
const { Pool } = require('pg');

// PostgreSQL pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Load dotenv in development only
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv not installed, which is fine in production
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || uuidv4();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Helper function to get player with all related data
async function getFullPlayer(playerId, includePrivate = true) {
  try {
    // Get main player data
    const { rows: playerRows } = await pool.query(
      'SELECT * FROM players WHERE id = $1',
      [playerId]
    );
    
    if (playerRows.length === 0) return null;
    const player = playerRows[0];

    // Get positions
    const { rows: positions } = await pool.query(
      'SELECT * FROM player_positions WHERE player_id = $1 ORDER BY position_order',
      [playerId]
    );

    // Get teams
    const { rows: teams } = await pool.query(
      'SELECT * FROM player_teams WHERE player_id = $1',
      [playerId]
    );

    // Get abilities
    const { rows: abilitiesRows } = await pool.query(
      'SELECT * FROM player_abilities WHERE player_id = $1',
      [playerId]
    );
    const abilities = abilitiesRows[0];

    // Get representative teams
    const { rows: repTeams } = await pool.query(
      'SELECT * FROM player_representative_teams WHERE player_id = $1',
      [playerId]
    );

    // Get trophies
    const { rows: trophies } = await pool.query(
      'SELECT * FROM player_trophies WHERE player_id = $1',
      [playerId]
    );

    // Get strengths
    const { rows: strengthRows } = await pool.query(
      'SELECT strength FROM player_strengths WHERE player_id = $1',
      [playerId]
    );
    const strengths = strengthRows.map(r => r.strength);

    // Get weaknesses
    const { rows: weaknessRows } = await pool.query(
      'SELECT weakness FROM player_weaknesses WHERE player_id = $1',
      [playerId]
    );
    const weaknesses = weaknessRows.map(r => r.weakness);

    // Get preferred locations
    const { rows: locationRows } = await pool.query(
      'SELECT location FROM player_preferred_locations WHERE player_id = $1',
      [playerId]
    );
    const preferredLocations = locationRows.map(r => r.location);

          // Format the response
          const fullPlayer = {
            id: player.id,
            playerId: player.id, // Include playerId for compatibility
            userId: player.user_id,
            personalInfo: {
              firstName: player.first_name,
              lastName: player.last_name,
              dateOfBirth: player.date_of_birth,
              nationality: player.nationality,
              height: {
                centimeters: player.height_cm,
                feet: player.height_feet,
                inches: player.height_inches
              },
              weight: {
                kilograms: player.weight_kg,
                pounds: player.weight_lbs
              },
              preferredFoot: player.preferred_foot,
              weakFootStrength: player.weak_foot_strength
            },
            contactInfo: includePrivate ? {
              player: {
                phone: player.player_phone,
                email: player.player_email
              },
              guardian: {
                name: player.guardian_name,
                phone: player.guardian_phone,
                email: player.guardian_email
              }
            } : undefined,
            playingInfo: {
              positions: positions.map(p => ({
                position: p.position,
                suitability: p.suitability,
                notes: p.notes,
                order: p.position_order
              })),
              yearsPlaying: player.years_playing,
              teams: teams.map(t => ({
                clubName: t.club_name,
                league: t.league,
                isPrimary: t.is_primary
              })),
              basedLocation: player.based_location,
              representativeTeams: {
                district: repTeams.find(t => t.level === 'district') ? {
                  selected: 'Yes',
                  season: repTeams.find(t => t.level === 'district').season
                } : { selected: 'No' },
                county: repTeams.find(t => t.level === 'county') ? {
                  selected: 'Yes',
                  season: repTeams.find(t => t.level === 'county').season
                } : { selected: 'No' }
              },
              trophiesAwards: trophies.map(t => ({
                title: t.title,
                season: t.season
              }))
            },
            academicInfo: {
              currentSchool: player.current_school,
              gradeYear: player.grade_year
            },
            abilities: abilities ? {
              technical: {
                ballControl: { rating: abilities.ball_control },
                passing: { rating: abilities.passing },
                shooting: { rating: abilities.shooting },
                dribbling: { rating: abilities.dribbling },
                firstTouch: { rating: abilities.first_touch },
                crossing: { rating: abilities.crossing },
                tackling: { rating: abilities.tackling },
                heading: { rating: abilities.heading }
              },
              physical: {
                pace: { rating: abilities.pace },
                strength: { rating: abilities.strength },
                stamina: { rating: abilities.stamina },
                agility: { rating: abilities.agility },
                balance: { rating: abilities.balance },
                jumping: { rating: abilities.jumping }
              },
              mental: {
                decisionMaking: { rating: abilities.decision_making },
                positioning: { rating: abilities.positioning },
                concentration: { rating: abilities.concentration },
                leadership: { rating: abilities.leadership },
                communication: { rating: abilities.communication }
              },
              athletic: {
                sprint10m: abilities.sprint_10m,
                sprint30m: abilities.sprint_30m,
                run1km: abilities.run_1km,
                bleepTest: abilities.bleep_test
              }
            } : {},
            showcase: {
              description: player.showcase_description
            },
            playingStyle: {
              summary: player.playing_style_summary,
              strengths: strengths,
              weaknesses: weaknesses
            },
            location: {
              postcode: player.postcode,
              city: player.city,
              county: player.county,
              country: player.country,
              coordinates: player.latitude && player.longitude ? {
                latitude: player.latitude,
                longitude: player.longitude
              } : undefined
            },
            availability: {
              status: player.availability_status || 'not_looking',
              willingToRelocate: player.willing_to_relocate,
              preferredLocations: preferredLocations,
              travelRadius: player.travel_radius
            },
            media: {
              profilePhoto: player.profile_photo
            },
            metadata: {
              published: player.is_published,
              createdDate: player.created_at,
              lastUpdated: player.updated_at
            }
          };

    return fullPlayer;
  } catch (error) {
    throw error;
  }
}

// Helper function to save player data
async function savePlayer(playerId, userId, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update main player record
    await client.query(
      `UPDATE players SET 
        first_name = $1, last_name = $2, date_of_birth = $3, nationality = $4,
        height_cm = $5, height_feet = $6, height_inches = $7, 
        weight_kg = $8, weight_lbs = $9,
        preferred_foot = $10, weak_foot_strength = $11,
        player_phone = $12, player_email = $13,
        guardian_name = $14, guardian_phone = $15, guardian_email = $16,
        years_playing = $17, based_location = $18,
        current_school = $19, grade_year = $20,
        postcode = $21, city = $22, county = $23, country = $24,
        latitude = $25, longitude = $26,
        availability_status = $27, willing_to_relocate = $28, travel_radius = $29,
        showcase_description = $30, playing_style_summary = $31,
        profile_photo = $32, updated_at = CURRENT_TIMESTAMP
      WHERE id = $33 AND user_id = $34`,
      [
        data.personalInfo?.firstName,
        data.personalInfo?.lastName,
        data.personalInfo?.dateOfBirth,
        data.personalInfo?.nationality,
        data.personalInfo?.height?.centimeters,
        data.personalInfo?.height?.feet,
        data.personalInfo?.height?.inches,
        data.personalInfo?.weight?.kilograms,
        data.personalInfo?.weight?.pounds,
        data.personalInfo?.preferredFoot,
        data.personalInfo?.weakFootStrength,
        data.contactInfo?.player?.phone,
        data.contactInfo?.player?.email,
        data.contactInfo?.guardian?.name,
        data.contactInfo?.guardian?.phone,
        data.contactInfo?.guardian?.email,
        data.playingInfo?.yearsPlaying,
        data.playingInfo?.basedLocation,
        data.academicInfo?.currentSchool,
        data.academicInfo?.gradeYear,
        data.location?.postcode,
        data.location?.city,
        data.location?.county,
        data.location?.country,
        data.location?.coordinates?.latitude,
        data.location?.coordinates?.longitude,
        data.availability?.status,
        data.availability?.willingToRelocate,
        data.availability?.travelRadius,
        data.showcase?.description,
        data.playingStyle?.summary,
        data.media?.profilePhoto,
        playerId,
        userId
      ]
    );

    // Delete and re-insert related data
    await client.query('DELETE FROM player_positions WHERE player_id = $1', [playerId]);

    // Insert positions
    if (data.playingInfo?.positions?.length > 0) {
      for (let i = 0; i < data.playingInfo.positions.length; i++) {
        const pos = data.playingInfo.positions[i];
        await client.query(
          'INSERT INTO player_positions (player_id, position, suitability, notes, position_order, is_primary) VALUES ($1, $2, $3, $4, $5, $6)',
          [playerId, pos.position, pos.suitability, pos.notes, i, i === 0]
        );
      }
    }

    // Delete and re-insert teams
    await client.query('DELETE FROM player_teams WHERE player_id = $1', [playerId]);

    if (data.playingInfo?.teams?.length > 0) {
      for (const team of data.playingInfo.teams) {
        await client.query(
          'INSERT INTO player_teams (player_id, club_name, league, is_primary) VALUES ($1, $2, $3, $4)',
          [playerId, team.clubName, team.league, team.isPrimary]
        );
      }
    }

    // Update abilities
    if (data.abilities) {
      await client.query(
        `INSERT INTO player_abilities (
          player_id, ball_control, passing, shooting, dribbling, first_touch, crossing, tackling, heading,
          pace, strength, stamina, agility, balance, jumping,
          decision_making, positioning, concentration, leadership, communication,
          sprint_10m, sprint_30m, run_1km, bleep_test
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        ON CONFLICT (player_id) DO UPDATE SET
          ball_control = EXCLUDED.ball_control,
          passing = EXCLUDED.passing,
          shooting = EXCLUDED.shooting,
          dribbling = EXCLUDED.dribbling,
          first_touch = EXCLUDED.first_touch,
          crossing = EXCLUDED.crossing,
          tackling = EXCLUDED.tackling,
          heading = EXCLUDED.heading,
          pace = EXCLUDED.pace,
          strength = EXCLUDED.strength,
          stamina = EXCLUDED.stamina,
          agility = EXCLUDED.agility,
          balance = EXCLUDED.balance,
          jumping = EXCLUDED.jumping,
          decision_making = EXCLUDED.decision_making,
          positioning = EXCLUDED.positioning,
          concentration = EXCLUDED.concentration,
          leadership = EXCLUDED.leadership,
          communication = EXCLUDED.communication,
          sprint_10m = EXCLUDED.sprint_10m,
          sprint_30m = EXCLUDED.sprint_30m,
          run_1km = EXCLUDED.run_1km,
          bleep_test = EXCLUDED.bleep_test`,
        [
          playerId,
          data.abilities.technical?.ballControl?.rating,
          data.abilities.technical?.passing?.rating,
          data.abilities.technical?.shooting?.rating,
          data.abilities.technical?.dribbling?.rating,
          data.abilities.technical?.firstTouch?.rating,
          data.abilities.technical?.crossing?.rating,
          data.abilities.technical?.tackling?.rating,
          data.abilities.technical?.heading?.rating,
          data.abilities.physical?.pace?.rating,
          data.abilities.physical?.strength?.rating,
          data.abilities.physical?.stamina?.rating,
          data.abilities.physical?.agility?.rating,
          data.abilities.physical?.balance?.rating,
          data.abilities.physical?.jumping?.rating,
          data.abilities.mental?.decisionMaking?.rating,
          data.abilities.mental?.positioning?.rating,
          data.abilities.mental?.concentration?.rating,
          data.abilities.mental?.leadership?.rating,
          data.abilities.mental?.communication?.rating,
          data.abilities.athletic?.sprint10m,
          data.abilities.athletic?.sprint30m,
          data.abilities.athletic?.run1km,
          data.abilities.athletic?.bleepTest
        ]
      );
    }

    // Delete and re-insert representative teams
    await client.query('DELETE FROM player_representative_teams WHERE player_id = $1', [playerId]);

    if (data.playingInfo?.representativeTeams?.district?.selected === 'Yes') {
      await client.query(
        'INSERT INTO player_representative_teams (player_id, level, season) VALUES ($1, $2, $3)',
        [playerId, 'district', data.playingInfo.representativeTeams.district.season]
      );
    }

    if (data.playingInfo?.representativeTeams?.county?.selected === 'Yes') {
      await client.query(
        'INSERT INTO player_representative_teams (player_id, level, season) VALUES ($1, $2, $3)',
        [playerId, 'county', data.playingInfo.representativeTeams.county.season]
      );
    }

    // Delete and re-insert trophies
    await client.query('DELETE FROM player_trophies WHERE player_id = $1', [playerId]);

    if (data.playingInfo?.trophiesAwards?.length > 0) {
      for (const trophy of data.playingInfo.trophiesAwards) {
        await client.query(
          'INSERT INTO player_trophies (player_id, title, season) VALUES ($1, $2, $3)',
          [playerId, trophy.title, trophy.season]
        );
      }
    }

    // Delete and re-insert strengths
    await client.query('DELETE FROM player_strengths WHERE player_id = $1', [playerId]);

    if (data.playingStyle?.strengths?.length > 0) {
      for (const strength of data.playingStyle.strengths) {
        await client.query(
          'INSERT INTO player_strengths (player_id, strength) VALUES ($1, $2)',
          [playerId, strength]
        );
      }
    }

    // Delete and re-insert weaknesses
    await client.query('DELETE FROM player_weaknesses WHERE player_id = $1', [playerId]);

    if (data.playingStyle?.weaknesses?.length > 0) {
      for (const weakness of data.playingStyle.weaknesses) {
        await client.query(
          'INSERT INTO player_weaknesses (player_id, weakness) VALUES ($1, $2)',
          [playerId, weakness]
        );
      }
    }

    // Delete and re-insert preferred locations
    await client.query('DELETE FROM player_preferred_locations WHERE player_id = $1', [playerId]);

    if (data.availability?.preferredLocations?.length > 0) {
      for (const location of data.availability.preferredLocations) {
        await client.query(
          'INSERT INTO player_preferred_locations (player_id, location) VALUES ($1, $2)',
          [playerId, location]
        );
      }
    }
    
    await client.query('COMMIT');
    return { id: playerId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token.' });
    }
    req.user = user;
    next();
  });
};

// API Routes

// Register new user
app.post('/api/register', async (req, res) => {
  const { username, password, email, role = 'player' } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Username, password, and email are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    const { rows } = await pool.query(
      'INSERT INTO users (id, username, password, email, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, username, hashedPassword, email, role]
    );

    const token = jwt.sign({ id: userId, username, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: userId, username, role } });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') { // PostgreSQL unique violation code
      return res.status(409).json({ error: 'Username or email already exists.' });
    }
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, username]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    
    const user = rows[0];

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Create new player profile
app.post('/api/players', authenticateToken, async (req, res) => {
  const playerId = uuidv4();
  const playerData = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO players (
        id, user_id, first_name, last_name, date_of_birth, 
        nationality, is_published
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        playerId,
        req.user.id,
        playerData.personalInfo?.firstName || '',
        playerData.personalInfo?.lastName || '',
        playerData.personalInfo?.dateOfBirth || null,
        playerData.personalInfo?.nationality || null,
        false
      ]
    );

    await savePlayer(playerId, req.user.id, playerData);
    const fullPlayer = await getFullPlayer(playerId);
    res.json(fullPlayer);
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: 'Failed to create player profile.' });
  }
});

// Get all players (filtered by user role)
app.get('/api/players', authenticateToken, async (req, res) => {
  try {
    let query;
    let params = [];
    
    if (req.user.role === 'player') {
      // Players can only see their own profiles
      query = 'SELECT id, first_name, last_name, is_published FROM players WHERE user_id = $1';
      params = [req.user.id];
    } else if (req.user.role === 'admin') {
      // Admins can see all profiles
      query = 'SELECT id FROM players';
    } else {
      // Coaches, scouts, agents can see published profiles
      query = 'SELECT id FROM players WHERE is_published = true';
    }
    
    const { rows } = await pool.query(query, params);
    
    const players = [];
    for (const row of rows) {
      const player = await getFullPlayer(row.id);
      players.push(player);
    }
    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players.' });
  }
});

// Get specific player
app.get('/api/players/:id', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM players WHERE id = $1',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Player not found.' });
    }
    
    const player = rows[0];

    // Check access permissions
    if (req.user.role === 'player' && player.user_id !== req.user.id) {
      if (!player.is_published) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    } else if (req.user.role !== 'admin' && req.user.role !== 'player' && !player.is_published) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const fullPlayer = await getFullPlayer(req.params.id);
    res.json(fullPlayer);
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Failed to fetch player data.' });
  }
});

// Update player profile
app.put('/api/players/:id', authenticateToken, async (req, res) => {
  const playerData = req.body;

  try {
    // Check ownership
    const { rows } = await pool.query(
      'SELECT user_id FROM players WHERE id = $1',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Player not found.' });
    }
    
    const player = rows[0];

    if (player.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await savePlayer(req.params.id, player.user_id, playerData);
    const fullPlayer = await getFullPlayer(req.params.id);
    res.json(fullPlayer);
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ error: 'Failed to update player.' });
  }
});

// Delete player profile
app.delete('/api/players/:id', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT user_id FROM players WHERE id = $1',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Player not found.' });
    }
    
    const player = rows[0];

    if (player.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await pool.query(
      'DELETE FROM players WHERE id = $1',
      [req.params.id]
    );
    
    res.json({ message: 'Player deleted successfully.' });
  } catch (error) {
    console.error('Error deleting player:', error);
    res.status(500).json({ error: 'Failed to delete player.' });
  }
});

// Publish/withdraw player profile
app.post('/api/players/:id/publish', authenticateToken, async (req, res) => {
  const { published } = req.body;

  try {
    const result = await pool.query(
      'UPDATE players SET is_published = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND (user_id = $3 OR $4 = $5) RETURNING *',
      [published, req.params.id, req.user.id, req.user.role, 'admin']
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'Access denied or player not found.' });
    }

    res.json({ 
      message: published ? 'Profile published successfully.' : 'Profile withdrawn successfully.',
      published: published
    });
  } catch (error) {
    console.error('Error updating publish status:', error);
    res.status(500).json({ error: 'Failed to update publish status.' });
  }
});

// Upload profile photo
app.post('/api/players/:id/media/upload', authenticateToken, async (req, res) => {
  const { imageData } = req.body;

  if (!imageData) {
    return res.status(400).json({ error: 'No image data provided.' });
  }

  try {
    const result = await pool.query(
      'UPDATE players SET profile_photo = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND (user_id = $3 OR $4 = $5) RETURNING *',
      [imageData, req.params.id, req.user.id, req.user.role, 'admin']
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'Access denied or player not found.' });
    }

    res.json({ message: 'Image uploaded successfully.' });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image.' });
  }
});

// Advanced search endpoint
app.post('/api/players/search/advanced', authenticateToken, async (req, res) => {
  const criteria = req.body;
  let query = 'SELECT DISTINCT p.* FROM players p';
  let joins = [];
  let conditions = ['p.is_published = true'];
  let params = [];
  let paramCount = 0;

  // Join positions table if searching by position
  if (criteria.playing?.positions?.length > 0) {
    joins.push('LEFT JOIN player_positions pp ON p.id = pp.player_id');
    const positionConditions = criteria.playing.positions.map(() => {
      paramCount++;
      return `pp.position = $${paramCount}`;
    }).join(' OR ');
    conditions.push(`(${positionConditions})`);
    params.push(...criteria.playing.positions);
  }

  // Join abilities table if searching by skills
  if (criteria.skills?.technical || criteria.skills?.physical || criteria.skills?.mental) {
    joins.push('LEFT JOIN player_abilities pa ON p.id = pa.player_id');
  }

  // Basic filters
  if (criteria.basic?.name) {
    paramCount += 2;
    conditions.push(`(LOWER(p.first_name) LIKE LOWER($${paramCount - 1}) OR LOWER(p.last_name) LIKE LOWER($${paramCount}))`);
    params.push(`%${criteria.basic.name}%`, `%${criteria.basic.name}%`);
  }

  if (criteria.basic?.ageMin || criteria.basic?.ageMax) {
    const currentYear = new Date().getFullYear();
    if (criteria.basic.ageMin) {
      paramCount++;
      conditions.push(`EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= $${paramCount}`);
      params.push(criteria.basic.ageMin);
    }
    if (criteria.basic.ageMax) {
      paramCount++;
      conditions.push(`EXTRACT(YEAR FROM AGE(p.date_of_birth)) <= $${paramCount}`);
      params.push(criteria.basic.ageMax);
    }
  }

  if (criteria.basic?.nationality) {
    paramCount++;
    conditions.push(`p.nationality = $${paramCount}`);
    params.push(criteria.basic.nationality);
  }

  // Physical filters
  if (criteria.physical?.heightMin) {
    paramCount++;
    conditions.push(`p.height_cm >= $${paramCount}`);
    params.push(criteria.physical.heightMin);
  }

  if (criteria.physical?.heightMax) {
    paramCount++;
    conditions.push(`p.height_cm <= $${paramCount}`);
    params.push(criteria.physical.heightMax);
  }

  if (criteria.physical?.preferredFoot) {
    paramCount++;
    conditions.push(`LOWER(p.preferred_foot) = LOWER($${paramCount})`);
    params.push(criteria.physical.preferredFoot);
  }

  // Skills filters
  if (criteria.skills?.technical) {
    Object.entries(criteria.skills.technical).forEach(([skill, min]) => {
      if (min > 0) {
        paramCount++;
        conditions.push(`pa.${skill.replace(/([A-Z])/g, '_$1').toLowerCase()} >= $${paramCount}`);
        params.push(min);
      }
    });
  }

  if (criteria.skills?.physical) {
    Object.entries(criteria.skills.physical).forEach(([skill, min]) => {
      if (min > 0) {
        paramCount++;
        conditions.push(`pa.${skill} >= $${paramCount}`);
        params.push(min);
      }
    });
  }

  // Build final query
  if (joins.length > 0) {
    query += ' ' + joins.join(' ');
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY p.updated_at DESC LIMIT 100';

  try {
    const { rows } = await pool.query(query, params);

    const players = [];
    for (const row of rows) {
      const player = await getFullPlayer(row.id, false);
      players.push(player);
    }

    res.json(players);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed.' });
  }
});

// Public endpoints (no auth required)

// Get published player profile
app.get('/api/public/players/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM players WHERE id = $1 AND is_published = true',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Player not found.' });
    }

    const fullPlayer = await getFullPlayer(req.params.id, false);
    res.json(fullPlayer);
  } catch (error) {
    console.error('Error fetching public player:', error);
    res.status(500).json({ error: 'Failed to fetch player data.' });
  }
});

// Send message to player
app.post('/api/public/players/:id/message', async (req, res) => {
  const { senderName, senderEmail, senderPhone, message } = req.body;

  if (!senderName || !senderEmail || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id FROM players WHERE id = $1 AND is_published = true',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Player not found.' });
    }

    await pool.query(
      'INSERT INTO messages (player_id, sender_name, sender_email, sender_phone, message) VALUES ($1, $2, $3, $4, $5)',
      [req.params.id, senderName, senderEmail, senderPhone, message]
    );
    
    res.json({ message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// Get messages for a player
app.get('/api/players/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { rows: playerRows } = await pool.query(
      'SELECT user_id FROM players WHERE id = $1',
      [req.params.id]
    );
    
    if (playerRows.length === 0) {
      return res.status(404).json({ error: 'Player not found.' });
    }
    
    const player = playerRows[0];

    if (player.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { rows: messages } = await pool.query(
      'SELECT * FROM messages WHERE player_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// Get unread message counts for all player's profiles
app.get('/api/players/unread-counts', authenticateToken, async (req, res) => {
  try {
    let query;
    let params;
    
    if (req.user.role === 'player') {
      // Get unread counts for all profiles owned by this user
      query = `
        SELECT p.id as player_id, COUNT(m.id) as unread_count
        FROM players p
        LEFT JOIN messages m ON p.id = m.player_id AND m.is_read = false
        WHERE p.user_id = $1
        GROUP BY p.id
      `;
      params = [req.user.id];
    } else if (req.user.role === 'admin') {
      // Admins can see all unread counts
      query = `
        SELECT p.id as player_id, COUNT(m.id) as unread_count
        FROM players p
        LEFT JOIN messages m ON p.id = m.player_id AND m.is_read = false
        GROUP BY p.id
      `;
      params = [];
    } else {
      // Other roles don't get message counts
      return res.json({});
    }
    
    const { rows } = await pool.query(query, params);
    
    // Convert to object with playerId as key
    const unreadCounts = {};
    rows.forEach(row => {
      if (row.unread_count > 0) {
        unreadCounts[row.player_id] = parseInt(row.unread_count);
      }
    });
    
    res.json(unreadCounts);
  } catch (error) {
    console.error('Error fetching unread counts:', error);
    res.status(500).json({ error: 'Failed to fetch unread counts.' });
  }
});

// Mark message as read
app.post('/api/messages/:id/read', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE messages SET is_read = true 
       WHERE id = $1 AND player_id IN (SELECT id FROM players WHERE user_id = $2)
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'Access denied or message not found.' });
    }

    res.json({ message: 'Message marked as read.' });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to update message.' });
  }
});

// Player lists endpoints
app.get('/api/player-lists', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM player_lists WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching player lists:', err);
    res.status(500).json({ error: 'Failed to fetch player lists' });
  }
});

app.post('/api/player-lists', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'List name is required' });
  }
  
  try {
    const { rows } = await pool.query(
      'INSERT INTO player_lists (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, name, description]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error creating player list:', err);
    res.status(500).json({ error: 'Failed to create player list' });
  }
});

app.post('/api/player-lists/:listId/players', authenticateToken, async (req, res) => {
  const { listId } = req.params;
  const { playerIds, notes } = req.body;
  
  if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({ error: 'Player IDs are required' });
  }
  
  try {
    // Verify list ownership
    const { rows: lists } = await pool.query(
      'SELECT * FROM player_lists WHERE id = $1 AND user_id = $2',
      [listId, req.user.id]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }
    
    // Add players to list
    const insertPromises = playerIds.map(playerId => 
      pool.query(
        'INSERT INTO player_list_members (list_id, player_id, notes) VALUES ($1, $2, $3) ON CONFLICT (list_id, player_id) DO UPDATE SET notes = $3',
        [listId, playerId, notes]
      )
    );
    
    await Promise.all(insertPromises);
    
    res.json({ message: 'Players added to list successfully' });
  } catch (err) {
    console.error('Error adding players to list:', err);
    res.status(500).json({ error: 'Failed to add players to list' });
  }
});

// Check database schema endpoint
app.get('/api/admin/check-schema', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  
  try {
    // Check if we have the old JSON column
    const { rows: oldSchema } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      ORDER BY ordinal_position
    `);
    
    // Check for new tables
    const { rows: tables } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('player_positions', 'player_teams', 'player_abilities')
    `);
    
    // Get sample player data - check which columns exist
    let samplePlayers = [];
    try {
      // Try normalized schema first
      const { rows } = await pool.query(
        'SELECT id, first_name, last_name, preferred_foot, is_published FROM players LIMIT 5'
      );
      samplePlayers = rows;
    } catch (e) {
      // Fall back to JSON schema
      try {
        const { rows } = await pool.query(
          'SELECT id, user_id, is_published FROM players LIMIT 5'
        );
        samplePlayers = rows;
      } catch (e2) {
        console.error('Could not fetch sample players:', e2);
      }
    }
    
    res.json({
      playersTableColumns: oldSchema,
      relatedTables: tables.map(t => t.table_name),
      samplePlayers: samplePlayers,
      hasDataColumn: oldSchema.some(col => col.column_name === 'data'),
      hasFirstNameColumn: oldSchema.some(col => col.column_name === 'first_name')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Temporary migration endpoint - REMOVE AFTER MIGRATION
app.post('/api/admin/migrate', authenticateToken, async (req, res) => {
  // Only allow admins to run migration
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  
  const { checkAndRunMigration } = require('./run-migration');
  
  try {
    const result = await checkAndRunMigration();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve HTML files
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});