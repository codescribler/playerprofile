const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

const db = require('./database');

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
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed')) {
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
    
    const players = rows.map(row => JSON.parse(row.data));
    res.json(players);
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
      
      const player = JSON.parse(row.data);
      
      if (req.user.role === 'player' && row.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      res.json(player);
    }
  );
});

app.put('/api/players/:id', authenticateToken, (req, res) => {
  const playerData = req.body;
  playerData.metadata = {
    ...playerData.metadata,
    lastUpdated: new Date().toISOString(),
    updatedBy: req.user.username
  };
  
  console.log('Updating player:', req.params.id);
  console.log('Player data size:', JSON.stringify(playerData).length);
  console.log('Has profile photo:', !!playerData.media?.profilePhoto);
  if (playerData.media?.profilePhoto) {
    console.log('Photo URL length:', playerData.media.profilePhoto.length);
    console.log('Photo URL starts with data:', playerData.media.profilePhoto.startsWith('data:'));
  }
  
  db.run(
    'UPDATE players SET data = ? WHERE id = ? AND (user_id = ? OR ? = "admin")',
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
});

app.delete('/api/players/:id', authenticateToken, (req, res) => {
  db.run(
    'DELETE FROM players WHERE id = ? AND (user_id = ? OR ? = "admin")',
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
    'SELECT * FROM players WHERE id = ? AND (user_id = ? OR ? = "admin")',
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
      
      const playerData = JSON.parse(row.data);
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
      
      const player = JSON.parse(row.data);
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
      
      const player = JSON.parse(row.data);
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
    'SELECT * FROM players WHERE id = ? AND (user_id = ? OR ? = "admin")',
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
    'UPDATE messages SET read = TRUE WHERE id = ?',
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
     LEFT JOIN messages m ON p.id = m.player_id AND m.read = FALSE 
     WHERE p.user_id = ? OR ? = "admin"
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

app.get('/api/players/search', authenticateToken, (req, res) => {
  const { q, position, nationality } = req.query;
  let query = 'SELECT * FROM players WHERE 1=1';
  const params = [];
  
  if (req.user.role === 'player') {
    query += ' AND user_id = ?';
    params.push(req.user.id);
  }
  
  if (q) {
    query += ' AND json_extract(data, "$.personalInfo.fullName") LIKE ?';
    params.push(`%${q}%`);
  }
  
  if (position) {
    query += ' AND json_extract(data, "$.playingInfo.primaryPosition") = ?';
    params.push(position);
  }
  
  if (nationality) {
    query += ' AND json_extract(data, "$.personalInfo.nationality") = ?';
    params.push(nationality);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error searching players' });
    }
    
    const players = rows.map(row => JSON.parse(row.data));
    res.json(players);
  });
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