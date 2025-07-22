# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CRITICAL DATABASE REQUIREMENT 🚨

**THIS PROJECT USES POSTGRESQL EXCLUSIVELY - NO SQLITE!**

### ABSOLUTELY FORBIDDEN SQLite patterns:
- ❌ NEVER use `?` placeholders - USE `$1, $2, $3` instead
- ❌ NEVER use `db.get()`, `db.all()`, `db.run()` - USE `pool.query()` instead
- ❌ NEVER use `this.lastID` - USE `RETURNING *` instead
- ❌ NEVER use `INSERT OR IGNORE` - USE `ON CONFLICT` instead
- ❌ NEVER use callback-style queries - USE async/await with pool.query()
- ❌ NEVER import or reference sqlite3 module

### ALWAYS use PostgreSQL patterns:
- ✅ Parameter placeholders: `$1, $2, $3...`
- ✅ Query method: `await pool.query(sql, params)`
- ✅ Result handling: `const { rows } = await pool.query(...)`
- ✅ Insert returning: `INSERT INTO ... VALUES (...) RETURNING *`
- ✅ Upsert: `INSERT ... ON CONFLICT ... DO UPDATE SET ...`
- ✅ Connection: Use `pg` module with `DATABASE_URL`

### Before ANY database code changes:
1. CHECK that you're using `$1, $2` style placeholders
2. CHECK that you're using `pool.query()` not `db.get/all/run()`
3. CHECK that you're handling results as `{ rows }`
4. If you see ANY SQLite patterns, STOP and convert to PostgreSQL

## Project Overview

This is a Football Player Profile Management System that allows players to create comprehensive profiles and connect with coaches, scouts, and agents. The system supports profile publishing, messaging, and role-based access control.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server with auto-reload
npm run dev

# Run production server
npm start
```

## Architecture Overview

### Tech Stack
- **Backend**: Node.js with Express.js, JWT authentication
- **Database**: PostgreSQL ONLY (requires DATABASE_URL environment variable)
- **Frontend**: Vanilla JavaScript with multi-page architecture (no build process)
- **File Storage**: Images stored as base64 in database

### Key Architectural Patterns

1. **Database Storage**: Player profiles stored in NORMALIZED RELATIONAL TABLES (NO JSON!)
2. **Authentication**: JWT tokens stored in localStorage on frontend
3. **Multi-page App**: Separate HTML files for different sections (home, player-form, profile-view, messages)
4. **API Design**: RESTful endpoints with `/api/` prefix

### Database Schema (NORMALIZED - NO JSON BLOBS)

```sql
-- users table
id TEXT PRIMARY KEY, username VARCHAR(255), email VARCHAR(255), 
password_hash TEXT, role VARCHAR(20), created_at TIMESTAMP

-- players table (NORMALIZED - NO JSON!)
id TEXT PRIMARY KEY, user_id TEXT, first_name VARCHAR(100), 
last_name VARCHAR(100), date_of_birth DATE, nationality VARCHAR(100),
height_cm DECIMAL(5,1), weight_kg DECIMAL(5,2), preferred_foot VARCHAR(10),
is_published BOOLEAN, created_at TIMESTAMP, updated_at TIMESTAMP
-- Plus many more normalized columns...

-- player_positions table
id SERIAL PRIMARY KEY, player_id TEXT, position VARCHAR(50),
suitability INTEGER, is_primary BOOLEAN

-- player_teams table  
id SERIAL PRIMARY KEY, player_id TEXT, club_name VARCHAR(255),
league VARCHAR(255), is_primary BOOLEAN

-- player_abilities table
player_id TEXT PRIMARY KEY, ball_control INTEGER, passing INTEGER,
shooting INTEGER, pace INTEGER, strength INTEGER
-- Plus many more ability columns...

-- messages table
id SERIAL PRIMARY KEY, player_id TEXT, sender_name VARCHAR(255),
sender_email VARCHAR(255), message TEXT, created_at TIMESTAMP, is_read BOOLEAN
```

## API Endpoints

### Authentication
- `POST /api/register` - Create new user account
- `POST /api/login` - Login and receive JWT token

### Player Management (Requires Authentication)
- `POST /api/players` - Create player profile
- `GET /api/players` - List players (filtered by role)
- `GET /api/players/:id` - Get specific player
- `PUT /api/players/:id` - Update player profile
- `DELETE /api/players/:id` - Delete player
- `POST /api/players/:id/publish` - Publish/withdraw profile
- `POST /api/players/:id/media/upload` - Upload profile photo

### Public Access (No Authentication)
- `GET /api/public/players/:id` - View published profile
- `POST /api/public/players/:id/message` - Send message to player

### Messaging (Requires Authentication)
- `GET /api/players/:id/messages` - Get player's messages
- `POST /api/messages/:id/read` - Mark message as read

## Frontend Navigation

- `/` → Landing page (home.html)
- `/app` → Main application (index.html)
- `/player-form.html?id=:playerId` → Edit player form
- `/player-form.html` → New player form
- `/profile-view.html?id=:playerId` → View player profile
- `/messages.html?playerId=:playerId` → View messages

## Working with Player Data

Player data is stored as a JSON object with the following main sections:
- `personalInfo`: Name, DOB, nationality, etc.
- `contactInfo`: Player and guardian contact details
- `playingInfo`: Positions, teams, experience
- `academicInfo`: School and academic details
- `physicalAttributes`: Height, weight, fitness levels
- `technicalAbilities`: Skills rated 1-10
- `playingStyle`: Characteristics and playing preferences
- `media`: Profile photo as base64 string

## Important Considerations

1. **File Uploads**: Images are converted to base64 and stored in the database. Max size is 1MB.
2. **Role-Based Access**: 
   - Players can only see/edit their own profiles
   - Coaches/Scouts/Agents can view all published profiles
   - Admins have full access
3. **Public Profiles**: When published, sensitive contact info is hidden from public view
4. **Database Config**: Uses PostgreSQL exclusively (DATABASE_URL must be set)
5. **Authentication**: All API requests except public endpoints require `Authorization: Bearer <token>` header

## Environment Variables

- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string (for production)
- `JWT_SECRET` - Secret for JWT signing (defaults to generated UUID)
- `NODE_ENV` - Environment (development/production)