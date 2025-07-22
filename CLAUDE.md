# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL REQUIREMENTS

**NEVER use SQLite in this project. This project uses PostgreSQL exclusively.**
- Do NOT use SQLite syntax like `?` placeholders, `this.lastID`, `INSERT OR IGNORE`, etc.
- Always use PostgreSQL syntax: `$1, $2` placeholders, `RETURNING *`, `ON CONFLICT`, etc.
- All database operations must be PostgreSQL-compatible
- Never import or reference SQLite libraries

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

1. **Database Storage**: Player profiles stored as JSON blobs in `player_data` column for flexibility
2. **Authentication**: JWT tokens stored in localStorage on frontend
3. **Multi-page App**: Separate HTML files for different sections (home, player-form, profile-view, messages)
4. **API Design**: RESTful endpoints with `/api/` prefix

### Database Schema

```sql
-- users table
id, username, email, password_hash, role, created_at

-- players table  
id, user_id, player_data (JSON), is_published, created_at, updated_at

-- messages table
id, player_id, sender_name, sender_email, message, created_at, is_read
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