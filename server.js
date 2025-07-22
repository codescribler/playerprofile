const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database-config');

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
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM players WHERE id = ?',
      [playerId],
      async (err, player) => {
        if (err) return reject(err);
        if (!player) return resolve(null);

        try {
          // Get positions
          const positions = await new Promise((res, rej) => {
            db.all(
              'SELECT * FROM player_positions WHERE player_id = ? ORDER BY position_order',
              [playerId],
              (err, rows) => err ? rej(err) : res(rows)
            );
          });

          // Get teams
          const teams = await new Promise((res, rej) => {
            db.all(
              'SELECT * FROM player_teams WHERE player_id = ?',
              [playerId],
              (err, rows) => err ? rej(err) : res(rows)
            );
          });

          // Get abilities
          const abilities = await new Promise((res, rej) => {
            db.get(
              'SELECT * FROM player_abilities WHERE player_id = ?',
              [playerId],
              (err, row) => err ? rej(err) : res(row)
            );
          });

          // Get representative teams
          const repTeams = await new Promise((res, rej) => {
            db.all(
              'SELECT * FROM player_representative_teams WHERE player_id = ?',
              [playerId],
              (err, rows) => err ? rej(err) : res(rows)
            );
          });

          // Get trophies
          const trophies = await new Promise((res, rej) => {
            db.all(
              'SELECT * FROM player_trophies WHERE player_id = ?',
              [playerId],
              (err, rows) => err ? rej(err) : res(rows)
            );
          });

          // Get strengths
          const strengths = await new Promise((res, rej) => {
            db.all(
              'SELECT strength FROM player_strengths WHERE player_id = ?',
              [playerId],
              (err, rows) => err ? rej(err) : res(rows.map(r => r.strength))
            );
          });

          // Get weaknesses
          const weaknesses = await new Promise((res, rej) => {
            db.all(
              'SELECT weakness FROM player_weaknesses WHERE player_id = ?',
              [playerId],
              (err, rows) => err ? rej(err) : res(rows.map(r => r.weakness))
            );
          });

          // Get preferred locations
          const preferredLocations = await new Promise((res, rej) => {
            db.all(
              'SELECT location FROM player_preferred_locations WHERE player_id = ?',
              [playerId],
              (err, rows) => err ? rej(err) : res(rows.map(r => r.location))
            );
          });

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

          resolve(fullPlayer);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

// Helper function to save player data
async function savePlayer(playerId, userId, data) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Update main player record
      db.run(
        `UPDATE players SET 
          first_name = ?, last_name = ?, date_of_birth = ?, nationality = ?,
          height_cm = ?, height_feet = ?, height_inches = ?, 
          weight_kg = ?, weight_lbs = ?,
          preferred_foot = ?, weak_foot_strength = ?,
          player_phone = ?, player_email = ?,
          guardian_name = ?, guardian_phone = ?, guardian_email = ?,
          years_playing = ?, based_location = ?,
          current_school = ?, grade_year = ?,
          postcode = ?, city = ?, county = ?, country = ?,
          latitude = ?, longitude = ?,
          availability_status = ?, willing_to_relocate = ?, travel_radius = ?,
          showcase_description = ?, playing_style_summary = ?,
          profile_photo = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
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
        ],
        async function(err) {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }

          try {
            // Delete and re-insert related data
            await new Promise((res, rej) => {
              db.run('DELETE FROM player_positions WHERE player_id = ?', [playerId], (err) => err ? rej(err) : res());
            });

            // Insert positions
            if (data.playingInfo?.positions?.length > 0) {
              for (let i = 0; i < data.playingInfo.positions.length; i++) {
                const pos = data.playingInfo.positions[i];
                await new Promise((res, rej) => {
                  db.run(
                    'INSERT INTO player_positions (player_id, position, suitability, notes, position_order, is_primary) VALUES (?, ?, ?, ?, ?, ?)',
                    [playerId, pos.position, pos.suitability, pos.notes, i, i === 0],
                    (err) => err ? rej(err) : res()
                  );
                });
              }
            }

            // Delete and re-insert teams
            await new Promise((res, rej) => {
              db.run('DELETE FROM player_teams WHERE player_id = ?', [playerId], (err) => err ? rej(err) : res());
            });

            if (data.playingInfo?.teams?.length > 0) {
              for (const team of data.playingInfo.teams) {
                await new Promise((res, rej) => {
                  db.run(
                    'INSERT INTO player_teams (player_id, club_name, league, is_primary) VALUES (?, ?, ?, ?)',
                    [playerId, team.clubName, team.league, team.isPrimary],
                    (err) => err ? rej(err) : res()
                  );
                });
              }
            }

            // Update abilities
            if (data.abilities) {
              await new Promise((res, rej) => {
                db.run(
                  `INSERT INTO player_abilities (
                    player_id, ball_control, passing, shooting, dribbling, first_touch, crossing, tackling, heading,
                    pace, strength, stamina, agility, balance, jumping,
                    decision_making, positioning, concentration, leadership, communication,
                    sprint_10m, sprint_30m, run_1km, bleep_test
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                  ],
                  (err) => err ? rej(err) : res()
                );
              });
            }

            // Delete and re-insert representative teams
            await new Promise((res, rej) => {
              db.run('DELETE FROM player_representative_teams WHERE player_id = ?', [playerId], (err) => err ? rej(err) : res());
            });

            if (data.playingInfo?.representativeTeams?.district?.selected === 'Yes') {
              await new Promise((res, rej) => {
                db.run(
                  'INSERT INTO player_representative_teams (player_id, level, season) VALUES (?, ?, ?)',
                  [playerId, 'district', data.playingInfo.representativeTeams.district.season],
                  (err) => err ? rej(err) : res()
                );
              });
            }

            if (data.playingInfo?.representativeTeams?.county?.selected === 'Yes') {
              await new Promise((res, rej) => {
                db.run(
                  'INSERT INTO player_representative_teams (player_id, level, season) VALUES (?, ?, ?)',
                  [playerId, 'county', data.playingInfo.representativeTeams.county.season],
                  (err) => err ? rej(err) : res()
                );
              });
            }

            // Delete and re-insert trophies
            await new Promise((res, rej) => {
              db.run('DELETE FROM player_trophies WHERE player_id = ?', [playerId], (err) => err ? rej(err) : res());
            });

            if (data.playingInfo?.trophiesAwards?.length > 0) {
              for (const trophy of data.playingInfo.trophiesAwards) {
                await new Promise((res, rej) => {
                  db.run(
                    'INSERT INTO player_trophies (player_id, title, season) VALUES (?, ?, ?)',
                    [playerId, trophy.title, trophy.season],
                    (err) => err ? rej(err) : res()
                  );
                });
              }
            }

            // Delete and re-insert strengths
            await new Promise((res, rej) => {
              db.run('DELETE FROM player_strengths WHERE player_id = ?', [playerId], (err) => err ? rej(err) : res());
            });

            if (data.playingStyle?.strengths?.length > 0) {
              for (const strength of data.playingStyle.strengths) {
                await new Promise((res, rej) => {
                  db.run(
                    'INSERT INTO player_strengths (player_id, strength) VALUES (?, ?)',
                    [playerId, strength],
                    (err) => err ? rej(err) : res()
                  );
                });
              }
            }

            // Delete and re-insert weaknesses
            await new Promise((res, rej) => {
              db.run('DELETE FROM player_weaknesses WHERE player_id = ?', [playerId], (err) => err ? rej(err) : res());
            });

            if (data.playingStyle?.weaknesses?.length > 0) {
              for (const weakness of data.playingStyle.weaknesses) {
                await new Promise((res, rej) => {
                  db.run(
                    'INSERT INTO player_weaknesses (player_id, weakness) VALUES (?, ?)',
                    [playerId, weakness],
                    (err) => err ? rej(err) : res()
                  );
                });
              }
            }

            // Delete and re-insert preferred locations
            await new Promise((res, rej) => {
              db.run('DELETE FROM player_preferred_locations WHERE player_id = ?', [playerId], (err) => err ? rej(err) : res());
            });

            if (data.availability?.preferredLocations?.length > 0) {
              for (const location of data.availability.preferredLocations) {
                await new Promise((res, rej) => {
                  db.run(
                    'INSERT INTO player_preferred_locations (player_id, location) VALUES (?, ?)',
                    [playerId, location],
                    (err) => err ? rej(err) : res()
                  );
                });
              }
            }
            
            db.run('COMMIT');
            resolve({ id: playerId });
          } catch (error) {
            db.run('ROLLBACK');
            reject(error);
          }
        }
      );
    });
  });
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

    db.run(
      'INSERT INTO users (id, username, password, email, role) VALUES (?, ?, ?, ?, ?)',
      [userId, username, hashedPassword, email, role],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Username or email already exists.' });
          }
          return res.status(500).json({ error: 'Failed to register user.' });
        }

        const token = jwt.sign({ id: userId, username, role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: userId, username, role } });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  db.get(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [username, username],
    async (err, user) => {
      if (err || !user) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

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
    }
  );
});

// Create new player profile
app.post('/api/players', authenticateToken, async (req, res) => {
  const playerId = uuidv4();
  const playerData = req.body;

  db.run(
    `INSERT INTO players (
      id, user_id, first_name, last_name, date_of_birth, 
      nationality, is_published
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      playerId,
      req.user.id,
      playerData.personalInfo?.firstName || '',
      playerData.personalInfo?.lastName || '',
      playerData.personalInfo?.dateOfBirth || null,
      playerData.personalInfo?.nationality || null,
      false
    ],
    async function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create player profile.' });
      }

      try {
        await savePlayer(playerId, req.user.id, playerData);
        const fullPlayer = await getFullPlayer(playerId);
        res.json(fullPlayer);
      } catch (error) {
        res.status(500).json({ error: 'Failed to save player data.' });
      }
    }
  );
});

// Get all players (filtered by user role)
app.get('/api/players', authenticateToken, (req, res) => {
  if (req.user.role === 'player') {
    // Players can only see their own profiles
    db.all(
      'SELECT id, first_name, last_name, is_published FROM players WHERE user_id = ?',
      [req.user.id],
      async (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch players.' });
        }
        
        const players = [];
        for (const row of rows) {
          const player = await getFullPlayer(row.id);
          players.push(player);
        }
        res.json(players);
      }
    );
  } else if (req.user.role === 'admin') {
    // Admins can see all profiles
    db.all(
      'SELECT id FROM players',
      [],
      async (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch players.' });
        }
        
        const players = [];
        for (const row of rows) {
          const player = await getFullPlayer(row.id);
          players.push(player);
        }
        res.json(players);
      }
    );
  } else {
    // Coaches, scouts, agents can see published profiles
    db.all(
      'SELECT id FROM players WHERE is_published = true',
      [],
      async (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch players.' });
        }
        
        const players = [];
        for (const row of rows) {
          const player = await getFullPlayer(row.id);
          players.push(player);
        }
        res.json(players);
      }
    );
  }
});

// Get specific player
app.get('/api/players/:id', authenticateToken, async (req, res) => {
  db.get(
    'SELECT * FROM players WHERE id = ?',
    [req.params.id],
    async (err, player) => {
      if (err || !player) {
        return res.status(404).json({ error: 'Player not found.' });
      }

      // Check access permissions
      if (req.user.role === 'player' && player.user_id !== req.user.id) {
        if (!player.is_published) {
          return res.status(403).json({ error: 'Access denied.' });
        }
      } else if (req.user.role !== 'admin' && req.user.role !== 'player' && !player.is_published) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      try {
        const fullPlayer = await getFullPlayer(req.params.id);
        res.json(fullPlayer);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch player data.' });
      }
    }
  );
});

// Update player profile
app.put('/api/players/:id', authenticateToken, async (req, res) => {
  const playerData = req.body;

  // Check ownership
  db.get(
    'SELECT user_id FROM players WHERE id = ?',
    [req.params.id],
    async (err, player) => {
      if (err || !player) {
        return res.status(404).json({ error: 'Player not found.' });
      }

      if (player.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied.' });
      }

      try {
        await savePlayer(req.params.id, player.user_id, playerData);
        const fullPlayer = await getFullPlayer(req.params.id);
        res.json(fullPlayer);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update player.' });
      }
    }
  );
});

// Delete player profile
app.delete('/api/players/:id', authenticateToken, (req, res) => {
  db.get(
    'SELECT user_id FROM players WHERE id = ?',
    [req.params.id],
    (err, player) => {
      if (err || !player) {
        return res.status(404).json({ error: 'Player not found.' });
      }

      if (player.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied.' });
      }

      db.run(
        'DELETE FROM players WHERE id = ?',
        [req.params.id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to delete player.' });
          }
          res.json({ message: 'Player deleted successfully.' });
        }
      );
    }
  );
});

// Publish/withdraw player profile
app.post('/api/players/:id/publish', authenticateToken, (req, res) => {
  const { published } = req.body;

  db.run(
    'UPDATE players SET is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (user_id = ? OR ? = ?)',
    [published, req.params.id, req.user.id, req.user.role, 'admin'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update publish status.' });
      }

      if (this.changes === 0) {
        return res.status(403).json({ error: 'Access denied or player not found.' });
      }

      res.json({ 
        message: published ? 'Profile published successfully.' : 'Profile withdrawn successfully.',
        published: published
      });
    }
  );
});

// Upload profile photo
app.post('/api/players/:id/media/upload', authenticateToken, (req, res) => {
  const { imageData } = req.body;

  if (!imageData) {
    return res.status(400).json({ error: 'No image data provided.' });
  }

  db.run(
    'UPDATE players SET profile_photo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (user_id = ? OR ? = ?)',
    [imageData, req.params.id, req.user.id, req.user.role, 'admin'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to upload image.' });
      }

      if (this.changes === 0) {
        return res.status(403).json({ error: 'Access denied or player not found.' });
      }

      res.json({ message: 'Image uploaded successfully.' });
    }
  );
});

// Advanced search endpoint
app.post('/api/players/search/advanced', authenticateToken, async (req, res) => {
  const criteria = req.body;
  let query = 'SELECT DISTINCT p.* FROM players p';
  let joins = [];
  let conditions = ['p.is_published = true'];
  let params = [];

  // Join positions table if searching by position
  if (criteria.playing?.positions?.length > 0) {
    joins.push('LEFT JOIN player_positions pp ON p.id = pp.player_id');
    const positionConditions = criteria.playing.positions.map(() => 'pp.position = ?').join(' OR ');
    conditions.push(`(${positionConditions})`);
    params.push(...criteria.playing.positions);
  }

  // Join abilities table if searching by skills
  if (criteria.skills?.technical || criteria.skills?.physical || criteria.skills?.mental) {
    joins.push('LEFT JOIN player_abilities pa ON p.id = pa.player_id');
  }

  // Basic filters
  if (criteria.basic?.name) {
    conditions.push(`(LOWER(p.first_name) LIKE LOWER(?) OR LOWER(p.last_name) LIKE LOWER(?))`);
    params.push(`%${criteria.basic.name}%`, `%${criteria.basic.name}%`);
  }

  if (criteria.basic?.ageMin || criteria.basic?.ageMax) {
    const currentYear = new Date().getFullYear();
    if (criteria.basic.ageMin) {
      conditions.push(`EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= ?`);
      params.push(criteria.basic.ageMin);
    }
    if (criteria.basic.ageMax) {
      conditions.push(`EXTRACT(YEAR FROM AGE(p.date_of_birth)) <= ?`);
      params.push(criteria.basic.ageMax);
    }
  }

  if (criteria.basic?.nationality) {
    conditions.push('p.nationality = ?');
    params.push(criteria.basic.nationality);
  }

  // Physical filters
  if (criteria.physical?.heightMin) {
    conditions.push('p.height_cm >= ?');
    params.push(criteria.physical.heightMin);
  }

  if (criteria.physical?.heightMax) {
    conditions.push('p.height_cm <= ?');
    params.push(criteria.physical.heightMax);
  }

  if (criteria.physical?.preferredFoot) {
    conditions.push('LOWER(p.preferred_foot) = LOWER(?)');
    params.push(criteria.physical.preferredFoot);
  }

  // Skills filters
  if (criteria.skills?.technical) {
    Object.entries(criteria.skills.technical).forEach(([skill, min]) => {
      if (min > 0) {
        conditions.push(`pa.${skill.replace(/([A-Z])/g, '_$1').toLowerCase()} >= ?`);
        params.push(min);
      }
    });
  }

  if (criteria.skills?.physical) {
    Object.entries(criteria.skills.physical).forEach(([skill, min]) => {
      if (min > 0) {
        conditions.push(`pa.${skill} >= ?`);
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

  db.all(query, params, async (err, rows) => {
    if (err) {
      console.error('Search error:', err);
      return res.status(500).json({ error: 'Search failed.' });
    }

    const players = [];
    for (const row of rows) {
      const player = await getFullPlayer(row.id, false);
      players.push(player);
    }

    res.json(players);
  });
});

// Public endpoints (no auth required)

// Get published player profile
app.get('/api/public/players/:id', async (req, res) => {
  db.get(
    'SELECT * FROM players WHERE id = ? AND is_published = true',
    [req.params.id],
    async (err, player) => {
      if (err || !player) {
        return res.status(404).json({ error: 'Player not found.' });
      }

      try {
        const fullPlayer = await getFullPlayer(req.params.id, false);
        res.json(fullPlayer);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch player data.' });
      }
    }
  );
});

// Send message to player
app.post('/api/public/players/:id/message', async (req, res) => {
  const { senderName, senderEmail, senderPhone, message } = req.body;

  if (!senderName || !senderEmail || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  db.get(
    'SELECT id FROM players WHERE id = ? AND is_published = true',
    [req.params.id],
    (err, player) => {
      if (err || !player) {
        return res.status(404).json({ error: 'Player not found.' });
      }

      db.run(
        'INSERT INTO messages (player_id, sender_name, sender_email, sender_phone, message) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, senderName, senderEmail, senderPhone, message],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to send message.' });
          }
          res.json({ message: 'Message sent successfully.' });
        }
      );
    }
  );
});

// Get messages for a player
app.get('/api/players/:id/messages', authenticateToken, (req, res) => {
  db.get(
    'SELECT user_id FROM players WHERE id = ?',
    [req.params.id],
    (err, player) => {
      if (err || !player) {
        return res.status(404).json({ error: 'Player not found.' });
      }

      if (player.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied.' });
      }

      db.all(
        'SELECT * FROM messages WHERE player_id = ? ORDER BY created_at DESC',
        [req.params.id],
        (err, messages) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to fetch messages.' });
          }
          res.json(messages);
        }
      );
    }
  );
});

// Mark message as read
app.post('/api/messages/:id/read', authenticateToken, (req, res) => {
  db.run(
    `UPDATE messages SET is_read = true 
     WHERE id = ? AND player_id IN (SELECT id FROM players WHERE user_id = ?)`,
    [req.params.id, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update message.' });
      }

      if (this.changes === 0) {
        return res.status(403).json({ error: 'Access denied or message not found.' });
      }

      res.json({ message: 'Message marked as read.' });
    }
  );
});

// Player lists endpoints
app.get('/api/player-lists', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
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
    const { rows } = await db.query(
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
    const { rows: lists } = await db.query(
      'SELECT * FROM player_lists WHERE id = $1 AND user_id = $2',
      [listId, req.user.id]
    );
    
    if (lists.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }
    
    // Add players to list
    const insertPromises = playerIds.map(playerId => 
      db.query(
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