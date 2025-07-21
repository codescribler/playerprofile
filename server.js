const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Trigger deployment to use PostgreSQL database - force rebuild 2024-01-21

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static('uploads'));

// Serve homepage as default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Serve app page
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files (but exclude index.html from root)
app.use(express.static('public', { index: false }));

const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos are allowed.'));
    }
  }
});

const db = require('./database-config');

// Helper function to repair corrupted player data
function repairPlayerData(player) {
  // Fix corrupted team data if it's stored as "[object Object]"
  if (player.playingInfo?.currentTeam === '[object Object]') {
    console.log('Repairing corrupted team data for player:', player.personalInfo?.fullName);
    player.playingInfo.currentTeam = {
      clubName: '',
      league: ''
    };
  }
  
  // Migrate old height/weight format to new format
  if (player.personalInfo) {
    // Check if we have old format (direct properties) but not new format
    if (player.personalInfo.heightCm !== undefined && !player.personalInfo.height) {
      console.log('Migrating height data for player:', player.personalInfo?.fullName);
      const heightCm = parseFloat(player.personalInfo.heightCm) || 0;
      player.personalInfo.height = {
        centimeters: heightCm,
        feet: Math.floor(heightCm / 30.48),
        inches: Math.round((heightCm % 30.48) / 2.54)
      };
    }
    
    if (player.personalInfo.weightKg !== undefined && !player.personalInfo.weight) {
      console.log('Migrating weight data for player:', player.personalInfo?.fullName);
      const weightKg = parseFloat(player.personalInfo.weightKg) || 0;
      player.personalInfo.weight = {
        kilograms: weightKg,
        pounds: Math.round(weightKg * 2.20462 * 10) / 10
      };
    }
  }
  
  // Migrate old position format to new format
  if (player.playingInfo) {
    // Check if we have old primaryPosition/secondaryPositions format but not new positions format
    if ((player.playingInfo.primaryPosition || player.playingInfo.secondaryPositions) && !player.playingInfo.positions) {
      console.log('Migrating position data for player:', player.personalInfo?.fullName);
      const newPositions = [];
      
      // Convert primary position
      if (player.playingInfo.primaryPosition) {
        const primary = player.playingInfo.primaryPosition;
        newPositions.push({
          position: typeof primary === 'string' ? primary : primary.position,
          suitability: typeof primary === 'object' ? (primary.suitability || 100) : 100,
          notes: typeof primary === 'object' ? (primary.notes || '') : '',
          order: 1
        });
      }
      
      // Convert secondary positions
      if (player.playingInfo.secondaryPositions && Array.isArray(player.playingInfo.secondaryPositions)) {
        player.playingInfo.secondaryPositions.forEach((secondary, index) => {
          newPositions.push({
            position: typeof secondary === 'string' ? secondary : secondary.position,
            suitability: typeof secondary === 'object' ? (secondary.suitability || 75) : 75,
            notes: typeof secondary === 'object' ? (secondary.notes || '') : '',
            order: index + 2
          });
        });
      }
      
      // Set new positions array and remove old properties
      player.playingInfo.positions = newPositions;
      delete player.playingInfo.primaryPosition;
      delete player.playingInfo.secondaryPositions;
    }
  }
  
  return player;
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

app.post('/api/register', async (req, res) => {
  try {
    console.log('Registration request body:', req.body);
    const { username, password, email, role } = req.body;
    
    console.log('Extracted values:', { username, password: password ? '***' : 'undefined', email, role });
    
    if (!username || !password || !email) {
      console.log('Missing required fields:', { username: !!username, password: !!password, email: !!email });
      return res.status(400).json({ error: 'Username, password, and email are required' });
    }

    const validRoles = ['player', 'coach', 'scout', 'agent', 'admin'];
    const userRole = validRoles.includes(role) ? role : 'player';
    console.log('User role set to:', userRole);

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    console.log('Attempting to insert user with ID:', userId);
    
    db.run(
      'INSERT INTO users (id, username, password, email, role) VALUES (?, ?, ?, ?, ?)',
      [userId, username, hashedPassword, email, userRole],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          if (err.message.includes('duplicate key value') || err.message.includes('violates unique constraint')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Error creating user: ' + err.message });
        }
        
        console.log('User created successfully with ID:', userId);
        res.json({ message: 'User created successfully', userId: userId });
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    db.get(
      'SELECT * FROM users WHERE username = ?',
      [username],
      async (err, user) => {
        if (err) {
          console.error('Database error during login:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        try {
          const validPassword = await bcrypt.compare(password, user.password);
          if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
          }
          
          const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
          );
          
          res.json({ 
            token, 
            user: { 
              id: user.id, 
              username: user.username, 
              email: user.email, 
              role: user.role 
            } 
          });
        } catch (bcryptError) {
          console.error('Password comparison error:', bcryptError);
          return res.status(500).json({ error: 'Authentication error' });
        }
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/players', authenticateToken, (req, res) => {
  const playerId = uuidv4();
  const playerData = req.body;
  playerData.playerId = playerId;
  playerData.metadata = {
    ...playerData.metadata,
    createdDate: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    updatedBy: req.user.username
  };
  
  db.run(
    'INSERT INTO players (id, user_id, data) VALUES (?, ?, ?)',
    [playerId, req.user.id, JSON.stringify(playerData)],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating player profile' });
      }
      res.json({ message: 'Player profile created', playerId });
    }
  );
});

app.get('/api/players', authenticateToken, (req, res) => {
  let query = 'SELECT * FROM players';
  const params = [];
  
  if (req.user.role === 'player') {
    query += ' WHERE user_id = ?';
    params.push(req.user.id);
  } else if (req.query.visibility && req.user.role !== 'admin') {
    query += ' WHERE json_extract(data, "$.metadata.visibility") = ?';
    params.push(req.query.visibility);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching players' });
    }
    
    const players = rows.map(row => {
      let player = JSON.parse(row.data);
      // Include the player ID in the response
      player.id = row.id;
      player.playerId = row.id;
      // Repair any corrupted data
      player = repairPlayerData(player);
      return player;
    });
    res.json(players);
  });
});

// Minimal test for preferred foot
app.get('/api/players/search-minimal', authenticateToken, (req, res) => {
  const { preferredFoot } = req.query;
  
  if (!preferredFoot) {
    return res.json({ error: 'Please provide preferredFoot parameter' });
  }
  
  // Try the simplest possible query - cast data to json first
  const query = "SELECT id, (data::json->'personalInfo'->>'preferredFoot') as foot FROM players WHERE (data::json->'personalInfo'->>'preferredFoot') = $1 LIMIT 2";
  
  db.all(query, [preferredFoot], (err, rows) => {
    if (err) {
      return res.status(500).json({ 
        error: err.message,
        query: query,
        param: preferredFoot
      });
    }
    
    res.json({
      success: true,
      count: rows.length,
      results: rows
    });
  });
});

// Test search endpoint with minimal query
app.get('/api/players/search-test', authenticateToken, (req, res) => {
  if (!['scout', 'coach', 'agent', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const { preferredFoot } = req.query;
  
  // Test different query approaches
  let testQueries = [
    {
      name: "Basic select",
      query: "SELECT id, data FROM players LIMIT 2",
      params: []
    },
    {
      name: "Simple JSON extract",
      query: "SELECT id, data::json->'personalInfo' as pinfo FROM players LIMIT 2",
      params: []
    },
    {
      name: "Check data structure",
      query: "SELECT id, data::json->'personalInfo'->>'preferredFoot' as foot, substring(data from 1 for 200) as data_preview FROM players LIMIT 2",
      params: []
    }
  ];
  
  if (preferredFoot) {
    testQueries.push({
      name: "All preferredFoot values",
      query: "SELECT DISTINCT data::json->'personalInfo'->>'preferredFoot' as foot_value FROM players WHERE data::json->'personalInfo'->>'preferredFoot' IS NOT NULL",
      params: []
    });
    testQueries.push({
      name: "Preferred foot with JSONB",
      query: "SELECT id, data FROM players WHERE data::jsonb->'personalInfo'->>'preferredFoot' = $1 LIMIT 2",
      params: [preferredFoot]
    });
    testQueries.push({
      name: "Preferred foot with text search",
      query: "SELECT id, data FROM players WHERE data::text LIKE $1 LIMIT 2",
      params: [`%"preferredFoot":"${preferredFoot}"%`]
    });
  }
  
  // Execute queries sequentially for better debugging
  const executeQueries = async () => {
    const results = { totalQueries: testQueries.length };
    
    for (const test of testQueries) {
      try {
        await new Promise((resolve, reject) => {
          db.all(test.query, test.params, (err, rows) => {
            if (err) {
              results[test.name] = { error: err.message, code: err.code };
            } else {
              results[test.name] = { success: true, count: rows.length };
              // For data structure check, include the actual data
              if (test.name === "Check data structure" && rows.length > 0) {
                results[test.name].data = rows.map(r => ({ 
                  id: r.id, 
                  foot: r.foot, 
                  preview: r.data_preview 
                }));
              }
              // For all foot values check
              if (test.name === "All preferredFoot values" && rows.length > 0) {
                results[test.name].values = rows.map(r => r.foot_value);
              }
            }
            resolve();
          });
        });
      } catch (e) {
        results[test.name] = { error: 'Query failed: ' + e.message };
      }
    }
    
    return results;
  };
  
  executeQueries().then(results => {
    res.json(results);
  }).catch(err => {
    res.status(500).json({ error: 'Test execution failed', details: err.message });
  });
});

// Comprehensive data structure check
app.get('/api/debug/data-structure', authenticateToken, (req, res) => {
  db.all("SELECT id, data FROM players LIMIT 2", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const structures = rows.map(row => {
      try {
        const player = JSON.parse(row.data);
        return {
          id: row.id,
          personalInfo: {
            dateOfBirth: player.personalInfo?.dateOfBirth,
            preferredFoot: player.personalInfo?.preferredFoot
          },
          playingInfo: {
            positions: player.playingInfo?.positions,
            positionsStructure: Array.isArray(player.playingInfo?.positions) ? 
              player.playingInfo.positions.slice(0, 2) : 'not array',
            // Show raw position data for debugging
            rawPositions: JSON.stringify(player.playingInfo?.positions).substring(0, 100)
          }
        };
      } catch (e) {
        return { id: row.id, error: 'JSON parse failed' };
      }
    });
    
    res.json(structures);
  });
});

// Simple endpoint to check preferredFoot values
app.get('/api/debug/foot-values', authenticateToken, (req, res) => {
  // Just get the first few players and show their preferredFoot values
  db.all("SELECT id, data FROM players LIMIT 5", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const footValues = rows.map(row => {
      try {
        const player = JSON.parse(row.data);
        return {
          id: row.id,
          preferredFoot: player.personalInfo?.preferredFoot,
          hasPersonalInfo: !!player.personalInfo,
          personalInfoKeys: player.personalInfo ? Object.keys(player.personalInfo) : []
        };
      } catch (e) {
        return { id: row.id, error: 'JSON parse failed' };
      }
    });
    
    res.json(footValues);
  });
});

// Debug endpoint to check database structure
app.get('/api/debug/check-db', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  // Check what columns exist in players table
  db.all("SELECT column_name FROM information_schema.columns WHERE table_name = 'players'", [], (err, cols) => {
    if (err) {
      return res.json({ 
        error: 'Failed to check columns',
        details: err.message,
        suggestion: 'Try simple query instead'
      });
    }
    
    // Try a simple query
    db.all("SELECT id, data FROM players LIMIT 1", [], (err2, rows) => {
      res.json({
        columns: cols,
        sampleQuery: err2 ? { error: err2.message } : { success: true, rowCount: rows.length }
      });
    });
  });
});

// Enhanced search endpoint with location, filters, etc.
// MUST be defined before /api/players/:id to avoid route conflicts
app.get('/api/players/search', authenticateToken, (req, res) => {
  // Check if user has permission to search
  const allowedRoles = ['scout', 'coach', 'agent', 'admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const {
    q, // text search
    latitude, longitude, radius, // location search
    ageMin, ageMax, // age range
    positions, // comma-separated positions
    preferredFoot,
    availability, // comma-separated availability statuses
    willingToRelocate,
    experienceLevel,
    limit = 50
  } = req.query;

  // Start with the simplest possible query
  let query = 'SELECT * FROM players WHERE 1=1';
  const params = [];
  
  // Text search (first name, last name, or full name) - cast to JSON
  if (q) {
    query += ` AND ((data::json->'personalInfo'->>'firstName') ILIKE ? OR (data::json->'personalInfo'->>'lastName') ILIKE ? OR (data::json->'personalInfo'->>'fullName') ILIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  
  // Age range filter for PostgreSQL - cast to JSON
  if (ageMin || ageMax) {
    const currentYear = new Date().getFullYear();
    if (ageMin) {
      // For minimum age, birth year must be <= (current year - min age)
      const maxBirthYear = currentYear - ageMin;
      query += ` AND (data::json->'personalInfo'->>'dateOfBirth') <= ?`;
      params.push(`${maxBirthYear}-12-31`);
    }
    if (ageMax) {
      // For maximum age, birth year must be >= (current year - max age - 1)
      const minBirthYear = currentYear - ageMax - 1;
      query += ` AND (data::json->'personalInfo'->>'dateOfBirth') >= ?`;
      params.push(`${minBirthYear}-01-01`);
    }
  }
  
  // Positions filter for PostgreSQL - use text search since positions is an array
  if (positions) {
    const positionList = positions.split(',');
    const positionConditions = positionList.map(() => 
      `data::text LIKE ?`
    ).join(' OR ');
    query += ` AND (${positionConditions})`;
    positionList.forEach(pos => params.push(`%"position":"${pos}"%`));
  }
  
  // Preferred foot filter for PostgreSQL - cast to JSON
  if (preferredFoot) {
    query += ` AND (data::json->'personalInfo'->>'preferredFoot') = ?`;
    params.push(preferredFoot);
  }
  
  // Availability filter for PostgreSQL - cast to JSON
  if (availability) {
    const availabilityList = availability.split(',');
    const availabilityConditions = availabilityList.map(() => 
      `(data::json->'availability'->>'status') = ?`
    ).join(' OR ');
    query += ` AND (${availabilityConditions})`;
    availabilityList.forEach(status => params.push(status));
  }
  
  // Willing to relocate filter for PostgreSQL - cast to JSON
  if (willingToRelocate === 'true') {
    query += ` AND (data::json->'availability'->>'willingToRelocate') = 'true'`;
  }
  
  // Experience level filter - cast to JSON
  if (experienceLevel) {
    query += ` AND (data::json->'experience'->>'level') = ?`;
    params.push(experienceLevel);
  }
  
  // Add limit - PostgreSQL needs the LIMIT as part of the query, not as parameter
  const limitNum = parseInt(limit) || 50;
  query += ` LIMIT ${limitNum}`;
  
  // Log the query for debugging
  console.log('Executing search query:', query);
  console.log('With params:', params);
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Search error:', err);
      console.error('Failed query was:', query);
      console.error('Failed params were:', params);
      return res.status(500).json({ 
        error: 'Database search error: ' + err.message,
        detail: err.detail || err.code
      });
    }
    
    let players = rows.map(row => {
      let player = JSON.parse(row.data);
      // Include the player ID in the response
      player.id = row.id;
      player.playerId = row.id;
      
      // Location data would come from player.location in the JSON if available
      
      // Repair any corrupted data
      player = repairPlayerData(player);
      
      // Remove large media data from search results to prevent quota errors
      if (player.media && player.media.profilePhoto) {
        // Keep a flag that photo exists but remove the actual data
        player.media = { hasProfilePhoto: true };
      }
      
      return player;
    });
    
    // Calculate distances if location search
    if (latitude && longitude && radius > 0) {
      const searchLat = parseFloat(latitude);
      const searchLng = parseFloat(longitude);
      const maxDistance = parseFloat(radius);
      
      players = players.map(player => {
        if (player.location?.coordinates?.latitude && player.location?.coordinates?.longitude) {
          const distance = calculateDistance(
            searchLat, searchLng,
            player.location.coordinates.latitude,
            player.location.coordinates.longitude
          );
          player.distance = distance;
          return player;
        }
        return player;
      }).filter(player => !player.distance || player.distance <= maxDistance);
      
      // Sort by distance
      players.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }
    
    res.json(players);
  });
});

// Quick search endpoint for search wizard
app.get('/api/players/search/quick', authenticateToken, (req, res) => {
  // Check if user has permission to search
  const allowedRoles = ['scout', 'coach', 'agent', 'admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { q } = req.query;
  
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  // Quick search across multiple fields
  let query = `
    SELECT * FROM players 
    WHERE is_published = 1 
    AND (
      (data::json->'personalInfo'->>'firstName') ILIKE ? 
      OR (data::json->'personalInfo'->>'lastName') ILIKE ? 
      OR (data::json->'personalInfo'->>'fullName') ILIKE ?
      OR (data::json->'location'->>'city') ILIKE ?
      OR data::text ILIKE ?
    ) 
    LIMIT 20
  `;
  
  const searchTerm = `%${q}%`;
  const params = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Quick search error:', err);
      return res.status(500).json({ error: 'Search failed' });
    }

    const players = rows.map(row => {
      const player = JSON.parse(row.data);
      player.id = row.id;
      return player;
    });

    res.json(players);
  });
});

// Advanced search endpoint for search wizard
app.post('/api/players/search/advanced', authenticateToken, (req, res) => {
  // Check if user has permission to search
  const allowedRoles = ['scout', 'coach', 'agent', 'admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { criteria } = req.body;
  
  if (!criteria) {
    return res.status(400).json({ error: 'Search criteria required' });
  }

  let query = 'SELECT * FROM players WHERE is_published = 1';
  const params = [];

  // Basic Information filters
  if (criteria.basic) {
    // Name search
    if (criteria.basic.name) {
      query += ` AND ((data::json->'personalInfo'->>'firstName') ILIKE ? OR (data::json->'personalInfo'->>'lastName') ILIKE ? OR (data::json->'personalInfo'->>'fullName') ILIKE ?)`;
      const nameTerm = `%${criteria.basic.name}%`;
      params.push(nameTerm, nameTerm, nameTerm);
    }

    // Age range
    if (criteria.basic.ageMin || criteria.basic.ageMax) {
      const currentYear = new Date().getFullYear();
      if (criteria.basic.ageMin) {
        const maxBirthYear = currentYear - criteria.basic.ageMin;
        query += ` AND (data::json->'personalInfo'->>'dateOfBirth') <= ?`;
        params.push(`${maxBirthYear}-12-31`);
      }
      if (criteria.basic.ageMax) {
        const minBirthYear = currentYear - criteria.basic.ageMax - 1;
        query += ` AND (data::json->'personalInfo'->>'dateOfBirth') >= ?`;
        params.push(`${minBirthYear}-01-01`);
      }
    }

    // Nationality
    if (criteria.basic.nationality) {
      query += ` AND (data::json->'personalInfo'->>'nationality') = ?`;
      params.push(criteria.basic.nationality);
    }

    // Availability statuses
    if (criteria.basic.availability?.statuses?.length > 0) {
      const statusConditions = criteria.basic.availability.statuses.map(() => 
        `(data::json->'availability'->>'status') = ?`
      ).join(' OR ');
      query += ` AND (${statusConditions})`;
      criteria.basic.availability.statuses.forEach(status => params.push(status));
    }

    // Willing to relocate
    if (criteria.basic.availability?.willingToRelocate) {
      query += ` AND (data::json->'availability'->>'willingToRelocate') = 'true'`;
    }
  }

  // Physical Profile filters
  if (criteria.physical) {
    // Height range (always in cm)
    if (criteria.physical.heightMin) {
      query += ` AND CAST((data::json->'physicalAttributes'->>'heightCm') AS INTEGER) >= ?`;
      params.push(criteria.physical.heightMin);
    }
    if (criteria.physical.heightMax) {
      query += ` AND CAST((data::json->'physicalAttributes'->>'heightCm') AS INTEGER) <= ?`;
      params.push(criteria.physical.heightMax);
    }

    // Preferred foot
    if (criteria.physical.preferredFoot) {
      query += ` AND (data::json->'personalInfo'->>'preferredFoot') = ?`;
      params.push(criteria.physical.preferredFoot);
    }

    // Athletic performance
    if (criteria.physical.sprint10mMax) {
      query += ` AND CAST((data::json->'athleticPerformance'->>'sprint10m') AS FLOAT) <= ?`;
      params.push(criteria.physical.sprint10mMax);
    }
    if (criteria.physical.sprint30mMax) {
      query += ` AND CAST((data::json->'athleticPerformance'->>'sprint30m') AS FLOAT) <= ?`;
      params.push(criteria.physical.sprint30mMax);
    }
  }

  // Playing Profile filters
  if (criteria.playing) {
    // Positions
    if (criteria.playing.positions?.length > 0) {
      const positionConditions = criteria.playing.positions.map(() => 
        `data::text LIKE ?`
      ).join(' OR ');
      query += ` AND (${positionConditions})`;
      criteria.playing.positions.forEach(pos => params.push(`%"position":"${pos}"%`));
    }

    // Years playing minimum
    if (criteria.playing.yearsPlayingMin) {
      query += ` AND CAST((data::json->'playingInfo'->>'yearsPlaying') AS INTEGER) >= ?`;
      params.push(criteria.playing.yearsPlayingMin);
    }

    // League
    if (criteria.playing.league) {
      query += ` AND (data::json->'playingInfo'->'currentTeam'->>'league') ILIKE ?`;
      params.push(`%${criteria.playing.league}%`);
    }
  }

  // Skills filters
  if (criteria.skills) {
    // Technical skills
    if (criteria.skills.technical) {
      Object.entries(criteria.skills.technical).forEach(([skill, minValue]) => {
        const skillPath = skill.replace(/_/g, '');
        query += ` AND CAST((data::json->'technicalAbilities'->>'${skillPath}') AS INTEGER) >= ?`;
        params.push(minValue);
      });
    }

    // Physical attributes
    if (criteria.skills.physical) {
      Object.entries(criteria.skills.physical).forEach(([skill, minValue]) => {
        query += ` AND CAST((data::json->'physicalAbilities'->>'${skill}') AS INTEGER) >= ?`;
        params.push(minValue);
      });
    }

    // Mental attributes
    if (criteria.skills.mental) {
      Object.entries(criteria.skills.mental).forEach(([skill, minValue]) => {
        const skillPath = skill.replace(/_/g, '');
        query += ` AND CAST((data::json->'mentalAbilities'->>'${skillPath}') AS INTEGER) >= ?`;
        params.push(minValue);
      });
    }
  }

  // Location-based search
  if (criteria.basic?.postcode && criteria.basic?.radius) {
    // This would require geocoding - for now, just note it
    console.log('Location search requested but not implemented:', criteria.basic.postcode, criteria.basic.radius);
  }

  // Add limit
  query += ' LIMIT 100';

  console.log('Advanced search query:', query);
  console.log('Parameters:', params);

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Advanced search error:', err);
      return res.status(500).json({ error: 'Search failed', details: err.message });
    }

    const players = rows.map(row => {
      const player = JSON.parse(row.data);
      player.id = row.id;
      return player;
    });

    res.json(players);
  });
});

// Save search endpoint
app.post('/api/search/save', authenticateToken, (req, res) => {
  const { name, criteria } = req.body;
  
  if (!name || !criteria) {
    return res.status(400).json({ error: 'Name and criteria are required' });
  }

  const query = `
    INSERT INTO saved_searches (user_id, name, criteria, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `;

  db.run(query, [req.user.id, name, JSON.stringify(criteria)], function(err) {
    if (err) {
      console.error('Save search error:', err);
      return res.status(500).json({ error: 'Failed to save search' });
    }

    res.json({ 
      message: 'Search saved successfully', 
      searchId: this.lastID 
    });
  });
});

// Get saved searches endpoint
app.get('/api/search/saved', authenticateToken, (req, res) => {
  const query = `
    SELECT id, name, criteria, created_at
    FROM saved_searches
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  db.all(query, [req.user.id], (err, rows) => {
    if (err) {
      console.error('Get saved searches error:', err);
      return res.status(500).json({ error: 'Failed to retrieve saved searches' });
    }

    const searches = rows.map(row => ({
      id: row.id,
      name: row.name,
      criteria: JSON.parse(row.criteria),
      created_at: row.created_at
    }));

    res.json(searches);
  });
});

// Get specific saved search
app.get('/api/search/saved/:id', authenticateToken, (req, res) => {
  const query = `
    SELECT id, name, criteria, created_at
    FROM saved_searches
    WHERE id = ? AND user_id = ?
  `;

  db.get(query, [req.params.id, req.user.id], (err, row) => {
    if (err) {
      console.error('Get saved search error:', err);
      return res.status(500).json({ error: 'Failed to retrieve saved search' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    res.json({
      id: row.id,
      name: row.name,
      criteria: JSON.parse(row.criteria),
      created_at: row.created_at
    });
  });
});

app.get('/api/players/:id', authenticateToken, (req, res) => {
  db.get(
    'SELECT * FROM players WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching player' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Player not found' });
      }
      
      let player = JSON.parse(row.data);
      // Include the player ID in the response
      player.id = row.id;
      player.playerId = row.id;
      // Repair any corrupted data
      player = repairPlayerData(player);
      
      if (req.user.role === 'player' && row.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      res.json(player);
    }
  );
});

app.put('/api/players/:id', authenticateToken, (req, res) => {
  const incomingData = req.body;
  
  // First, get the existing player data to preserve certain fields
  db.get(
    'SELECT data FROM players WHERE id = ? AND (user_id = ? OR ? = \'admin\')',
    [req.params.id, req.user.id, req.user.role],
    (err, row) => {
      if (err) {
        console.error('Database error fetching player:', err);
        return res.status(500).json({ error: 'Error fetching player' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Player not found or access denied' });
      }
      
      const existingData = JSON.parse(row.data);
      
      // Deep merge function to preserve existing data
      const deepMerge = (target, source) => {
        const result = { ...target };
        for (const key in source) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key].constructor === Object) {
            result[key] = deepMerge(target[key] || {}, source[key]);
          } else if (source[key] !== undefined) {
            result[key] = source[key];
          }
        }
        return result;
      };
      
      // Merge the incoming data with existing data
      const playerData = deepMerge(existingData, incomingData);
      
      // Update metadata
      playerData.metadata = {
        ...existingData.metadata,  // Start with existing metadata
        ...playerData.metadata,    // Apply any new metadata from request
        lastUpdated: new Date().toISOString(),
        updatedBy: req.user.username,
        // Explicitly preserve published status if it exists
        published: playerData.metadata?.published !== undefined ? 
          playerData.metadata.published : 
          existingData.metadata?.published
      };
      
      // Fix corrupted team data if it's stored as "[object Object]"
      if (playerData.playingInfo?.currentTeam === '[object Object]') {
        console.log('Fixing corrupted team data for player:', req.params.id);
        playerData.playingInfo.currentTeam = {
          clubName: '',
          league: ''
        };
      }
      
      // Also check if currentTeam is a string that looks like an object but isn't "[object Object]"
      if (typeof playerData.playingInfo?.currentTeam === 'string' && 
          playerData.playingInfo.currentTeam !== '[object Object]' &&
          playerData.playingInfo.currentTeam !== '') {
        // If it's a valid team name string, convert to object format
        playerData.playingInfo.currentTeam = {
          clubName: playerData.playingInfo.currentTeam,
          league: playerData.playingInfo.league || ''
        };
      }
      
      console.log('Updating player:', req.params.id);
      console.log('Player data size:', JSON.stringify(playerData).length);
      console.log('Has profile photo:', !!playerData.media?.profilePhoto);
      console.log('Preserving published status:', playerData.metadata?.published);
      if (playerData.media?.profilePhoto) {
        console.log('Photo URL length:', playerData.media.profilePhoto.length);
        console.log('Photo URL starts with data:', playerData.media.profilePhoto.startsWith('data:'));
      }
      
      db.run(
        'UPDATE players SET data = ? WHERE id = ? AND (user_id = ? OR ? = \'admin\')',
        [JSON.stringify(playerData), req.params.id, req.user.id, req.user.role],
        function(err) {
          if (err) {
            console.error('Database error updating player:', err);
            return res.status(500).json({ error: 'Error updating player: ' + err.message });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Player not found or access denied' });
          }
          console.log('Player updated successfully');
          res.json({ message: 'Player profile updated' });
        }
      );
    }
  );
});

app.delete('/api/players/:id', authenticateToken, (req, res) => {
  db.run(
    'DELETE FROM players WHERE id = ? AND (user_id = ? OR ? = \'admin\')',
    [req.params.id, req.user.id, req.user.role],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error deleting player' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Player not found or access denied' });
      }
      res.json({ message: 'Player profile deleted' });
    }
  );
});

// Publish/Withdraw profile
app.post('/api/players/:id/publish', authenticateToken, (req, res) => {
  const { published } = req.body;
  console.log('Publish request:', req.params.id, 'Published:', published, 'User:', req.user.username);
  
  db.get(
    'SELECT * FROM players WHERE id = ? AND (user_id = ? OR ? = \'admin\')',
    [req.params.id, req.user.id, req.user.role],
    (err, row) => {
      if (err) {
        console.error('Database error in publish:', err);
        return res.status(500).json({ error: 'Error fetching player' });
      }
      if (!row) {
        console.log('Player not found or access denied:', req.params.id);
        return res.status(404).json({ error: 'Player not found or access denied' });
      }
      
      let playerData = JSON.parse(row.data);
      // Repair any corrupted data
      playerData = repairPlayerData(playerData);
      playerData.metadata = {
        ...playerData.metadata,
        published: published,
        publishedAt: published ? new Date().toISOString() : null,
        lastUpdated: new Date().toISOString(),
        updatedBy: req.user.username
      };
      
      db.run(
        'UPDATE players SET data = ? WHERE id = ?',
        [JSON.stringify(playerData), req.params.id],
        function(err) {
          if (err) {
            console.error('Database error in update:', err);
            return res.status(500).json({ error: 'Error updating player' });
          }
          console.log('Player publish status updated successfully:', req.params.id, 'Published:', published);
          res.json({ 
            message: published ? 'Player profile published' : 'Player profile withdrawn',
            published: published
          });
        }
      );
    }
  );
});

// Get public profile (no auth required)
app.get('/api/public/players/:id', (req, res) => {
  console.log('Public profile request for ID:', req.params.id);
  db.get(
    'SELECT * FROM players WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Error fetching player' });
      }
      if (!row) {
        console.log('Player not found:', req.params.id);
        return res.status(404).json({ error: 'Player not found' });
      }
      
      let player = JSON.parse(row.data);
      // Repair any corrupted data
      player = repairPlayerData(player);
      console.log('Player found:', player.personalInfo?.fullName, 'Published:', player.metadata?.published);
      
      // Check if profile is published
      if (!player.metadata?.published) {
        console.log('Profile not published for:', player.personalInfo?.fullName);
        return res.status(404).json({ error: 'Profile not published' });
      }
      
      // Remove sensitive information
      const publicPlayer = {
        ...player,
        contactInfo: undefined,
        academicInfo: {
          gradeYear: player.academicInfo?.gradeYear
          // Remove currentSchool
        }
      };
      
      console.log('Returning public profile for:', publicPlayer.personalInfo?.fullName);
      res.json(publicPlayer);
    }
  );
});

// Send message to player (no auth required for public)
app.post('/api/public/players/:id/message', (req, res) => {
  const { senderName, senderEmail, senderPhone, message } = req.body;
  
  if (!senderName || !senderEmail || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }
  
  // First check if the player profile is published
  db.get(
    'SELECT * FROM players WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching player' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Player not found' });
      }
      
      let player = JSON.parse(row.data);
      // Repair any corrupted data
      player = repairPlayerData(player);
      if (!player.metadata?.published) {
        return res.status(404).json({ error: 'Profile not published' });
      }
      
      // Insert message
      db.run(
        'INSERT INTO messages (player_id, sender_name, sender_email, sender_phone, message) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, senderName, senderEmail, senderPhone || null, message],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error sending message' });
          }
          res.json({ message: 'Message sent successfully', messageId: this.lastID });
        }
      );
    }
  );
});

// Get messages for a player (authenticated)
app.get('/api/players/:id/messages', authenticateToken, (req, res) => {
  // Check if user owns this player or is admin
  db.get(
    'SELECT * FROM players WHERE id = ? AND (user_id = ? OR ? = \'admin\')',
    [req.params.id, req.user.id, req.user.role],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching player' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Player not found or access denied' });
      }
      
      db.all(
        'SELECT * FROM messages WHERE player_id = ? ORDER BY created_at DESC',
        [req.params.id],
        (err, rows) => {
          if (err) {
            return res.status(500).json({ error: 'Error fetching messages' });
          }
          res.json(rows);
        }
      );
    }
  );
});

// Mark message as read
app.post('/api/messages/:id/read', authenticateToken, (req, res) => {
  db.run(
    'UPDATE messages SET is_read = TRUE WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating message' });
      }
      res.json({ message: 'Message marked as read' });
    }
  );
});

// Get unread message counts for all players (authenticated)
app.get('/api/players/unread-counts', authenticateToken, (req, res) => {
  db.all(
    `SELECT p.id as player_id, COUNT(m.id) as unread_count 
     FROM players p 
     LEFT JOIN messages m ON p.id = m.player_id AND m.is_read = FALSE 
     WHERE p.user_id = ? OR ? = \'admin\'
     GROUP BY p.id`,
    [req.user.id, req.user.role],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching unread counts' });
      }
      
      // Convert to object for easier lookup
      const counts = {};
      rows.forEach(row => {
        counts[row.player_id] = row.unread_count;
      });
      
      res.json(counts);
    }
  );
});

app.post('/api/players/:id/media/upload', authenticateToken, (req, res) => {
  console.log('Upload request received for player:', req.params.id);
  console.log('Request headers:', req.headers);
  console.log('Content-Type:', req.headers['content-type']);
  
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size too large. Max 10MB allowed.' });
        }
      }
      return res.status(400).json({ error: err.message });
    }
    
    console.log('File received:', req.file ? req.file.filename : 'No file');
    
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
  
  try {
    // Read the file and convert to base64 for persistent storage
    const filePath = path.join(__dirname, 'uploads', req.file.filename);
    const fileBuffer = fs.readFileSync(filePath);
    
    // Check file size - limit to 2MB (2MB = ~2.7MB in base64)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (fileBuffer.length > maxSize) {
      fs.unlinkSync(filePath); // Clean up temp file
      return res.status(400).json({ error: 'Image too large. Please use an image smaller than 2MB.' });
    }
    
    const base64Image = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`;
    
    console.log('File converted to base64, size:', base64Image.length);
    console.log('Original file size:', fileBuffer.length);
    
    // Clean up the temporary file
    fs.unlinkSync(filePath);
    console.log('Temporary file deleted:', filePath);
    
    res.json({ url: base64Image, filename: req.file.filename });
  } catch (error) {
    console.error('Error processing uploaded file:', error);
    res.status(500).json({ error: 'Error processing uploaded file' });
  }
  });
});

// Utility function to calculate distance between two coordinates (in miles)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Admin migration endpoints
app.post('/api/admin/migrations/:type', authenticateToken, async (req, res) => {
  // Check admin access
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { type } = req.params;
  let log = '';

  try {
    if (type === 'names') {
      // Run name migration
      log += 'Starting name migration...\n';
      
      const players = await new Promise((resolve, reject) => {
        db.all(`SELECT id, data FROM players`, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      let updated = 0;
      let alreadyMigrated = 0;

      for (const row of players) {
        try {
          const playerData = JSON.parse(row.data);
          
          // Check if already migrated
          if (playerData.personalInfo?.firstName && playerData.personalInfo?.lastName) {
            alreadyMigrated++;
            continue;
          }
          
          // Migrate fullName to firstName and lastName
          if (playerData.personalInfo?.fullName) {
            const nameParts = playerData.personalInfo.fullName.trim().split(/\s+/);
            
            if (nameParts.length === 1) {
              playerData.personalInfo.firstName = '';
              playerData.personalInfo.lastName = nameParts[0];
            } else {
              playerData.personalInfo.firstName = nameParts[0];
              playerData.personalInfo.lastName = nameParts[nameParts.length - 1];
            }
            
            // Update the database
            await new Promise((resolve, reject) => {
              db.run(
                `UPDATE players SET data = ? WHERE id = ?`,
                [JSON.stringify(playerData), row.id],
                (err) => {
                  if (err) reject(err);
                  else {
                    updated++;
                    resolve();
                  }
                }
              );
            });
          }
        } catch (e) {
          log += `Error processing player ${row.id}: ${e.message}\n`;
        }
      }

      log += `\nMigration complete!\n`;
      log += `Updated: ${updated} players\n`;
      log += `Already migrated: ${alreadyMigrated} players\n`;
      log += `Total processed: ${players.length} players`;

    } else if (type === 'search') {
      // Run search fields migration
      log += 'Starting search fields migration...\n';
      
      // Create player_locations table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS player_locations (
          id SERIAL PRIMARY KEY,
          player_id VARCHAR(255) NOT NULL,
          postcode VARCHAR(10),
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          city VARCHAR(100),
          county VARCHAR(100),
          country VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
          UNIQUE(player_id)
        )
      `;
      
      await new Promise((resolve, reject) => {
        db.run(createTableSQL, (err) => {
          if (err) reject(err);
          else {
            log += '✓ Created player_locations table\n';
            resolve();
          }
        });
      });

      // Create indexes
      await new Promise((resolve, reject) => {
        db.run('CREATE INDEX IF NOT EXISTS idx_location_coords ON player_locations(latitude, longitude)', (err) => {
          if (err) reject(err);
          else {
            log += '✓ Created coordinates index\n';
            resolve();
          }
        });
      });

      // Update player data
      const players = await new Promise((resolve, reject) => {
        db.all(`SELECT id, data FROM players`, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      let updated = 0;

      for (const row of players) {
        try {
          const playerData = JSON.parse(row.data);
          let needsUpdate = false;
          
          // Add location field if missing
          if (!playerData.location) {
            playerData.location = {
              postcode: '',
              city: '',
              county: '',
              country: 'England',
              coordinates: { latitude: null, longitude: null }
            };
            needsUpdate = true;
          }
          
          // Add availability field if missing
          if (!playerData.availability) {
            playerData.availability = {
              status: 'not_looking',
              availableFrom: null,
              willingToRelocate: false,
              preferredLocations: [],
              travelRadius: 25
            };
            needsUpdate = true;
          }
          
          // Add experience field if missing
          if (!playerData.experience) {
            playerData.experience = {
              level: 'amateur',
              yearsPlaying: 0,
              highestLevel: '',
              achievements: { caps: 0, goals: 0, assists: 0, cleanSheets: 0 }
            };
            needsUpdate = true;
          }
          
          // Add searchProfile field if missing
          if (!playerData.searchProfile) {
            playerData.searchProfile = {
              keywords: [],
              languages: ['English'],
              availability: 'not_specified',
              minimumSalary: null,
              contractType: []
            };
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            await new Promise((resolve, reject) => {
              db.run(
                `UPDATE players SET data = ? WHERE id = ?`,
                [JSON.stringify(playerData), row.id],
                (err) => {
                  if (err) reject(err);
                  else {
                    updated++;
                    resolve();
                  }
                }
              );
            });
          }
        } catch (e) {
          log += `Error processing player ${row.id}: ${e.message}\n`;
        }
      }

      log += `\nMigration complete!\n`;
      log += `Updated: ${updated} players with new search fields\n`;
      log += `Total processed: ${players.length} players`;

    } else {
      return res.status(400).json({ error: 'Unknown migration type' });
    }

    res.json({ success: true, log });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: error.message, log });
  }
});

// Request admin access (for first user only)
app.post('/api/request-admin', authenticateToken, (req, res) => {
  // Check if this is the only user or has the lowest user ID
  db.get('SELECT COUNT(*) as count, MIN(id) as firstUserId FROM users', [], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log('User check:', { 
      totalUsers: result.count, 
      firstUserId: result.firstUserId, 
      requestingUserId: req.user.id 
    });
    
    // If only one user exists, or if this is the user with the lowest ID, grant admin
    if (result.count === 1 || req.user.id === result.firstUserId) {
      db.run(
        'UPDATE users SET role = ? WHERE id = ?',
        ['admin', req.user.id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to update role' });
          }
          
          res.json({ 
            success: true, 
            message: 'Admin access granted',
            role: 'admin'
          });
        }
      );
    } else {
      res.status(403).json({ 
        error: 'Admin access can only be granted to the first user',
        debug: {
          yourId: req.user.id,
          firstUserId: result.firstUserId,
          totalUsers: result.count
        }
      });
    }
  });
});

// Check migration status
app.get('/api/admin/migrations/status', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Check if migrations have been run by looking for evidence
  const status = {
    names: false,
    search: false
  };

  // Check for firstName/lastName fields
  db.get(`SELECT data FROM players LIMIT 1`, [], (err, row) => {
    if (row) {
      try {
        const data = JSON.parse(row.data);
        if (data.personalInfo?.firstName || data.personalInfo?.lastName) {
          status.names = true;
        }
        if (data.location || data.availability || data.experience) {
          status.search = true;
        }
      } catch (e) {}
    }

    // Check for player_locations table
    const tableCheckSQL = "SELECT to_regclass('public.player_locations') AS exists";
    
    db.get(tableCheckSQL, [], (err, row) => {
      if (row && row.exists) {
        status.search = true;
      }
      res.json(status);
    });
  });
});

// Development endpoints - REMOVE BEFORE PRODUCTION
app.get('/api/dev/users', (req, res) => {
  // No authentication required - development only
  db.all(
    'SELECT id, username, email, role, created_at FROM users ORDER BY id',
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(users);
    }
  );
});

app.delete('/api/dev/users/:id', (req, res) => {
  // No authentication required - development only
  const userId = req.params.id; // Handle both string and numeric IDs
  
  // First delete associated players data
  db.run('DELETE FROM players WHERE user_id = ?', [userId], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete player data' });
    }
    
    // Then delete the user
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete user' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ message: 'User deleted successfully' });
    });
  });
});

app.post('/api/dev/users/:id/make-admin', (req, res) => {
  // No authentication required - development only
  const userId = req.params.id; // Handle both string and numeric IDs
  
  console.log('Making admin - User ID:', userId); // Debug log
  
  db.run(
    'UPDATE users SET role = ? WHERE id = ?',
    ['admin', userId],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to update user role' });
      }
      
      console.log('Changes made:', this.changes); // Debug log
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ message: 'User is now an admin' });
    }
  );
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Max 10MB allowed.' });
    }
  }
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});