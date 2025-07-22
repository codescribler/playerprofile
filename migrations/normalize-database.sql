-- Normalized database schema for player profiles
-- This replaces the JSON blob storage with properly normalized tables

-- 1. Create new players table with all fields as columns
CREATE TABLE players_new (
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
    profile_photo TEXT, -- Base64 data URL
    
    -- Metadata
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create positions table
CREATE TABLE player_positions (
    id SERIAL PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players_new(id) ON DELETE CASCADE,
    position VARCHAR(50) NOT NULL,
    suitability INTEGER CHECK (suitability >= 0 AND suitability <= 100),
    notes TEXT,
    position_order INTEGER,
    is_primary BOOLEAN DEFAULT FALSE
);

-- 3. Create teams table
CREATE TABLE player_teams (
    id SERIAL PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players_new(id) ON DELETE CASCADE,
    club_name VARCHAR(255) NOT NULL,
    league VARCHAR(255),
    is_primary BOOLEAN DEFAULT FALSE,
    start_date DATE,
    end_date DATE
);

-- 4. Create abilities table (denormalized for performance)
CREATE TABLE player_abilities (
    player_id TEXT PRIMARY KEY REFERENCES players_new(id) ON DELETE CASCADE,
    
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
    run_1km DECIMAL(5,2), -- minutes
    bleep_test DECIMAL(3,1)
);

-- 5. Create ability descriptions table (optional text descriptions)
CREATE TABLE player_ability_descriptions (
    id SERIAL PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players_new(id) ON DELETE CASCADE,
    ability_name VARCHAR(50) NOT NULL,
    description TEXT,
    UNIQUE(player_id, ability_name)
);

-- 6. Create representative teams table
CREATE TABLE player_representative_teams (
    id SERIAL PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players_new(id) ON DELETE CASCADE,
    level VARCHAR(50) CHECK (level IN ('district', 'county', 'national')),
    team_name VARCHAR(255),
    season VARCHAR(50)
);

-- 7. Create trophies/awards table
CREATE TABLE player_trophies (
    id SERIAL PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players_new(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    season VARCHAR(50),
    description TEXT
);

-- 8. Create playing style attributes
CREATE TABLE player_strengths (
    id SERIAL PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players_new(id) ON DELETE CASCADE,
    strength TEXT NOT NULL
);

CREATE TABLE player_weaknesses (
    id SERIAL PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players_new(id) ON DELETE CASCADE,
    weakness TEXT NOT NULL
);

-- 9. Create preferred locations for relocation
CREATE TABLE player_preferred_locations (
    id SERIAL PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players_new(id) ON DELETE CASCADE,
    location VARCHAR(255) NOT NULL
);

-- 10. Create indexes for performance
CREATE INDEX idx_players_name ON players_new(first_name, last_name);
CREATE INDEX idx_players_user_id ON players_new(user_id);
CREATE INDEX idx_players_dob ON players_new(date_of_birth);
CREATE INDEX idx_players_location ON players_new(city, postcode);
CREATE INDEX idx_players_coords ON players_new(latitude, longitude);
CREATE INDEX idx_players_published ON players_new(is_published);
CREATE INDEX idx_players_availability ON players_new(availability_status, willing_to_relocate);
CREATE INDEX idx_players_physical ON players_new(height_cm, preferred_foot);

CREATE INDEX idx_positions_player ON player_positions(player_id);
CREATE INDEX idx_positions_lookup ON player_positions(position, player_id);
CREATE INDEX idx_teams_player ON player_teams(player_id);
CREATE INDEX idx_abilities_player ON player_abilities(player_id);
CREATE INDEX idx_abilities_technical ON player_abilities(ball_control, passing, shooting, dribbling);
CREATE INDEX idx_abilities_physical ON player_abilities(pace, strength, stamina, agility);

-- 11. Migration script to copy data from old structure
-- This will be run separately after the schema is created