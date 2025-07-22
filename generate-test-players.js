const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test data generators
const firstNames = {
  male: ['James', 'Oliver', 'Jack', 'Harry', 'George', 'Noah', 'Leo', 'Oscar', 'Arthur', 'Muhammad', 'Henry', 'William', 'Freddie', 'Charlie', 'Theodore', 'Alexander', 'Lucas', 'Benjamin', 'Mason', 'Ethan'],
  female: ['Olivia', 'Amelia', 'Emily', 'Isabella', 'Sophia', 'Grace', 'Lily', 'Ella', 'Mia', 'Charlotte', 'Ava', 'Freya', 'Isla', 'Poppy', 'Jessica', 'Alice', 'Sophie', 'Evie', 'Daisy', 'Rosie']
};

const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White'];

const positions = {
  'GK': { name: 'Goalkeeper', category: 'goalkeeper' },
  'CB': { name: 'Centre Back', category: 'defender' },
  'LB': { name: 'Left Back', category: 'defender' },
  'RB': { name: 'Right Back', category: 'defender' },
  'CDM': { name: 'Central Defensive Midfielder', category: 'midfielder' },
  'CM': { name: 'Central Midfielder', category: 'midfielder' },
  'CAM': { name: 'Central Attacking Midfielder', category: 'midfielder' },
  'LM': { name: 'Left Midfielder', category: 'midfielder' },
  'RM': { name: 'Right Midfielder', category: 'midfielder' },
  'LW': { name: 'Left Winger', category: 'forward' },
  'RW': { name: 'Right Winger', category: 'forward' },
  'ST': { name: 'Striker', category: 'forward' },
  'CF': { name: 'Centre Forward', category: 'forward' }
};

const clubs = [
  { name: 'Manchester United Academy', league: 'Premier League U18' },
  { name: 'Chelsea FC Youth', league: 'Premier League U18' },
  { name: 'Arsenal Academy', league: 'Premier League U18' },
  { name: 'Liverpool FC Youth', league: 'Premier League U18' },
  { name: 'Manchester City Academy', league: 'Premier League U18' },
  { name: 'Leeds United U18', league: 'Championship U18' },
  { name: 'Watford FC Academy', league: 'Championship U18' },
  { name: 'Birmingham City Youth', league: 'Championship U18' },
  { name: 'Local FC U16', league: 'County League' },
  { name: 'District United', league: 'District League' },
  { name: 'School FC', league: 'School League' },
  { name: 'Sunday League FC', league: 'Sunday League' }
];

const locations = [
  { city: 'London', county: 'Greater London', postcode: 'SW1A', lat: 51.5074, lng: -0.1278 },
  { city: 'Manchester', county: 'Greater Manchester', postcode: 'M1', lat: 53.4808, lng: -2.2426 },
  { city: 'Birmingham', county: 'West Midlands', postcode: 'B1', lat: 52.4862, lng: -1.8904 },
  { city: 'Leeds', county: 'West Yorkshire', postcode: 'LS1', lat: 53.8008, lng: -1.5491 },
  { city: 'Liverpool', county: 'Merseyside', postcode: 'L1', lat: 53.4084, lng: -2.9916 },
  { city: 'Newcastle', county: 'Tyne and Wear', postcode: 'NE1', lat: 54.9783, lng: -1.6178 },
  { city: 'Bristol', county: 'Bristol', postcode: 'BS1', lat: 51.4545, lng: -2.5879 },
  { city: 'Sheffield', county: 'South Yorkshire', postcode: 'S1', lat: 53.3811, lng: -1.4701 },
  { city: 'Nottingham', county: 'Nottinghamshire', postcode: 'NG1', lat: 52.9548, lng: -1.1581 },
  { city: 'Leicester', county: 'Leicestershire', postcode: 'LE1', lat: 52.6369, lng: -1.1398 }
];

const schools = [
  'St. Mary\'s High School',
  'King Edward VI Grammar School',
  'Comprehensive Academy',
  'City of London School',
  'Manchester Grammar School',
  'Birmingham Academy',
  'Leeds Grammar School',
  'Liverpool College',
  'Newcastle High School',
  'Bristol Grammar School'
];

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateBirthDate(minAge, maxAge) {
  const today = new Date();
  const birthYear = today.getFullYear() - randomBetween(minAge, maxAge);
  const birthMonth = randomBetween(0, 11);
  const birthDay = randomBetween(1, 28);
  return new Date(birthYear, birthMonth, birthDay).toISOString().split('T')[0];
}

function generateHeight(positionKey) {
  // Position-based height ranges (in cm)
  const heightRanges = {
    'GK': { min: 175, max: 195 },
    'CB': { min: 175, max: 195 },
    'LB': { min: 165, max: 180 },
    'RB': { min: 165, max: 180 },
    'CDM': { min: 170, max: 185 },
    'CM': { min: 165, max: 185 },
    'CAM': { min: 165, max: 180 },
    'LM': { min: 165, max: 180 },
    'RM': { min: 165, max: 180 },
    'LW': { min: 165, max: 180 },
    'RW': { min: 165, max: 180 },
    'ST': { min: 170, max: 190 },
    'CF': { min: 170, max: 190 }
  };
  
  const range = heightRanges[positionKey] || { min: 165, max: 190 };
  return randomBetween(range.min, range.max);
}

function generateWeight(height) {
  // BMI-based weight calculation
  const bmi = randomBetween(19, 24); // Healthy BMI range for athletes
  return Math.round((bmi * (height / 100) * (height / 100)) * 10) / 10;
}

function generateAbilities(position, playerType = 'average') {
  // Define player types with different skill distributions
  const playerTypes = {
    'elite': { base: 7, variance: 2, athleticBonus: 0.8 },
    'promising': { base: 6, variance: 2, athleticBonus: 0.5 },
    'average': { base: 5, variance: 2, athleticBonus: 0 },
    'developing': { base: 4, variance: 2, athleticBonus: -0.3 },
    'raw': { base: 3, variance: 3, athleticBonus: -0.5 }
  };
  
  const typeConfig = playerTypes[playerType] || playerTypes.average;
  const baseRating = typeConfig.base;
  const variance = typeConfig.variance;
  
  const abilities = {
    technical: {},
    physical: {},
    mental: {},
    athletic: {}
  };
  
  // Position-specific strengths and weaknesses
  const positionProfiles = {
    'GK': {
      strengths: ['positioning', 'communication', 'concentration', 'jumping'],
      weaknesses: ['shooting', 'dribbling', 'pace'],
      athleticProfile: { sprint: 'slow', endurance: 'average' }
    },
    'CB': {
      strengths: ['heading', 'tackling', 'strength', 'positioning', 'jumping'],
      weaknesses: ['pace', 'dribbling', 'crossing'],
      athleticProfile: { sprint: 'slow', endurance: 'average' }
    },
    'LB': {
      strengths: ['pace', 'crossing', 'stamina', 'tackling'],
      weaknesses: ['heading', 'strength'],
      athleticProfile: { sprint: 'fast', endurance: 'high' }
    },
    'RB': {
      strengths: ['pace', 'crossing', 'stamina', 'tackling'],
      weaknesses: ['heading', 'strength'],
      athleticProfile: { sprint: 'fast', endurance: 'high' }
    },
    'CDM': {
      strengths: ['tackling', 'positioning', 'strength', 'passing', 'concentration'],
      weaknesses: ['pace', 'shooting', 'dribbling'],
      athleticProfile: { sprint: 'average', endurance: 'high' }
    },
    'CM': {
      strengths: ['passing', 'stamina', 'decision_making', 'ball_control'],
      weaknesses: ['heading', 'tackling'],
      athleticProfile: { sprint: 'average', endurance: 'very_high' }
    },
    'CAM': {
      strengths: ['passing', 'first_touch', 'ball_control', 'decision_making', 'dribbling'],
      weaknesses: ['tackling', 'strength', 'heading'],
      athleticProfile: { sprint: 'average', endurance: 'average' }
    },
    'LM': {
      strengths: ['pace', 'crossing', 'dribbling', 'stamina'],
      weaknesses: ['heading', 'tackling', 'strength'],
      athleticProfile: { sprint: 'fast', endurance: 'high' }
    },
    'RM': {
      strengths: ['pace', 'crossing', 'dribbling', 'stamina'],
      weaknesses: ['heading', 'tackling', 'strength'],
      athleticProfile: { sprint: 'fast', endurance: 'high' }
    },
    'LW': {
      strengths: ['pace', 'dribbling', 'agility', 'shooting', 'first_touch'],
      weaknesses: ['tackling', 'strength', 'heading'],
      athleticProfile: { sprint: 'very_fast', endurance: 'average' }
    },
    'RW': {
      strengths: ['pace', 'dribbling', 'agility', 'shooting', 'first_touch'],
      weaknesses: ['tackling', 'strength', 'heading'],
      athleticProfile: { sprint: 'very_fast', endurance: 'average' }
    },
    'ST': {
      strengths: ['shooting', 'heading', 'strength', 'positioning', 'first_touch'],
      weaknesses: ['tackling', 'passing'],
      athleticProfile: { sprint: 'fast', endurance: 'average' }
    },
    'CF': {
      strengths: ['shooting', 'first_touch', 'positioning', 'ball_control', 'strength'],
      weaknesses: ['tackling', 'crossing'],
      athleticProfile: { sprint: 'average', endurance: 'average' }
    }
  };
  
  const profile = positionProfiles[position] || positionProfiles['CM'];
  
  // Technical abilities
  const technicalSkills = ['ball_control', 'passing', 'shooting', 'dribbling', 'first_touch', 'crossing', 'tackling', 'heading'];
  technicalSkills.forEach(skill => {
    let rating;
    if (profile.strengths.includes(skill)) {
      rating = randomBetween(baseRating + 1, Math.min(10, baseRating + variance + 1));
    } else if (profile.weaknesses.includes(skill)) {
      rating = randomBetween(Math.max(1, baseRating - variance), baseRating - 1);
    } else {
      rating = randomBetween(Math.max(1, baseRating - 1), Math.min(10, baseRating + 1));
    }
    abilities.technical[skill] = rating;
  });
  
  // Physical abilities
  const physicalSkills = ['pace', 'strength', 'stamina', 'agility', 'balance', 'jumping'];
  physicalSkills.forEach(skill => {
    let rating;
    if (profile.strengths.includes(skill)) {
      rating = randomBetween(baseRating + 1, Math.min(10, baseRating + variance + 1));
    } else if (profile.weaknesses.includes(skill)) {
      rating = randomBetween(Math.max(1, baseRating - variance), baseRating - 1);
    } else {
      rating = randomBetween(Math.max(1, baseRating - 1), Math.min(10, baseRating + 1));
    }
    abilities.physical[skill] = rating;
  });
  
  // Mental abilities
  const mentalSkills = ['decision_making', 'positioning', 'concentration', 'leadership', 'communication'];
  mentalSkills.forEach(skill => {
    let rating;
    if (profile.strengths.includes(skill)) {
      rating = randomBetween(baseRating + 1, Math.min(10, baseRating + variance + 1));
    } else if (profile.weaknesses.includes(skill)) {
      rating = randomBetween(Math.max(1, baseRating - variance), baseRating - 1);
    } else {
      rating = randomBetween(Math.max(1, baseRating - 1), Math.min(10, baseRating + 1));
    }
    abilities.mental[skill] = rating;
  });
  
  // Athletic measurements based on position and player type
  const athleticProfiles = {
    very_fast: { sprint10: 1.5, sprint30: 3.8 },
    fast: { sprint10: 1.6, sprint30: 4.0 },
    average: { sprint10: 1.7, sprint30: 4.2 },
    slow: { sprint10: 1.8, sprint30: 4.4 },
    very_high: { run1km: 160, bleepTest: 13 },
    high: { run1km: 180, bleepTest: 12 },
    average: { run1km: 200, bleepTest: 10 }
  };
  
  const sprintProfile = athleticProfiles[profile.athleticProfile.sprint] || athleticProfiles.average;
  const enduranceProfile = athleticProfiles[profile.athleticProfile.endurance] || athleticProfiles.average;
  
  abilities.athletic = {
    sprint_10m: (sprintProfile.sprint10 + (Math.random() * 0.2 - 0.1) - typeConfig.athleticBonus * 0.1).toFixed(2),
    sprint_30m: (sprintProfile.sprint30 + (Math.random() * 0.4 - 0.2) - typeConfig.athleticBonus * 0.2).toFixed(2),
    run_1km: Math.round(enduranceProfile.run1km + randomBetween(-20, 20) - typeConfig.athleticBonus * 10),
    bleep_test: (enduranceProfile.bleepTest + (Math.random() * 2 - 1) + typeConfig.athleticBonus).toFixed(1)
  };
  
  return abilities;
}

function generatePlayingStyle(position) {
  const styles = {
    'GK': ['Sweeper Keeper', 'Traditional', 'Ball-Playing Goalkeeper'],
    'CB': ['Ball-Playing Defender', 'Physical Defender', 'Sweeper'],
    'LB': ['Attacking Full-Back', 'Defensive Full-Back', 'Wing-Back'],
    'RB': ['Attacking Full-Back', 'Defensive Full-Back', 'Wing-Back'],
    'CDM': ['Destroyer', 'Deep-Lying Playmaker', 'Box-to-Box'],
    'CM': ['Box-to-Box', 'Playmaker', 'Ball Winner'],
    'CAM': ['Creative Playmaker', 'Shadow Striker', 'Wide Playmaker'],
    'LM': ['Traditional Winger', 'Inside Forward', 'Wide Midfielder'],
    'RM': ['Traditional Winger', 'Inside Forward', 'Wide Midfielder'],
    'LW': ['Inside Forward', 'Inverted Winger', 'Traditional Winger'],
    'RW': ['Inside Forward', 'Inverted Winger', 'Traditional Winger'],
    'ST': ['Target Man', 'Poacher', 'False Nine'],
    'CF': ['Complete Forward', 'Deep-Lying Forward', 'Pressing Forward']
  };
  
  const summaries = {
    'GK': 'Confident goalkeeper with excellent shot-stopping ability and good distribution.',
    'CB': 'Strong defender who reads the game well and is comfortable on the ball.',
    'LB': 'Pacey full-back who loves to get forward and support attacks.',
    'RB': 'Energetic full-back with good defensive awareness and crossing ability.',
    'CDM': 'Disciplined midfielder who shields the defense and starts attacks.',
    'CM': 'Versatile midfielder with good passing range and work rate.',
    'CAM': 'Creative player with excellent vision and technical ability.',
    'LM': 'Quick winger who can beat defenders and deliver quality crosses.',
    'RM': 'Skillful wide player with pace and good decision making.',
    'LW': 'Direct winger who loves to take on defenders and create chances.',
    'RW': 'Tricky winger with excellent dribbling skills and eye for goal.',
    'ST': 'Clinical finisher with good movement in the box.',
    'CF': 'Complete forward who can score and create for teammates.'
  };
  
  return {
    style: randomFrom(styles[position] || ['Versatile Player']),
    summary: summaries[position] || 'Talented player with good all-round abilities.'
  };
}

async function createTestUser(username, email, role = 'player') {
  const password = 'Test123!';
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (id, username, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, username, email, hashedPassword, role]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      const { rows } = await pool.query(
        'SELECT * FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );
      return rows[0];
    }
    throw err;
  }
}

async function createTestPlayer(user, index) {
  const playerId = uuidv4();
  const gender = index % 3 === 0 ? 'female' : 'male'; // 1/3 female players
  const firstName = randomFrom(firstNames[gender]);
  const lastName = randomFrom(lastNames);
  const mainPosition = randomFrom(Object.keys(positions));
  const age = randomBetween(14, 21);
  const location = randomFrom(locations);
  const height = generateHeight(mainPosition);
  const weight = generateWeight(height);
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create player record
    await client.query(
      `INSERT INTO players (
        id, user_id, first_name, last_name, date_of_birth, nationality,
        height_cm, height_feet, height_inches, weight_kg, weight_lbs,
        preferred_foot, weak_foot_strength,
        player_phone, player_email, guardian_name, guardian_phone, guardian_email,
        years_playing, based_location, current_school, grade_year,
        postcode, city, county, country, latitude, longitude,
        availability_status, willing_to_relocate, travel_radius,
        showcase_description, playing_style_summary, 
        is_published, is_test_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36
      )`,
      [
        playerId,
        user.id,
        firstName,
        lastName,
        generateBirthDate(age, age),
        'English',
        height,
        Math.floor(height / 30.48), // feet
        Math.round((height / 2.54) % 12), // inches
        weight,
        Math.round(weight * 2.205), // pounds
        randomFrom(['Left', 'Right', 'Both']),
        randomBetween(30, 80),
        `+44 7${randomBetween(100000000, 999999999)}`,
        `${firstName.toLowerCase()}.${lastName.toLowerCase()}@testmail.com`,
        `${randomFrom(['John', 'Jane', 'David', 'Sarah'])} ${lastName}`,
        `+44 7${randomBetween(100000000, 999999999)}`,
        `parent.${lastName.toLowerCase()}@testmail.com`,
        randomBetween(3, 10),
        location.city,
        randomFrom(schools),
        `Year ${age - 5}`,
        location.postcode + randomBetween(1, 9),
        location.city,
        location.county,
        'England',
        location.lat + (Math.random() - 0.5) * 0.1,
        location.lng + (Math.random() - 0.5) * 0.1,
        randomFrom(['actively_looking', 'open_to_offers', 'not_looking']),
        Math.random() > 0.5,
        randomBetween(10, 50),
        `${firstName} is a talented ${positions[mainPosition].name.toLowerCase()} with great potential. ` +
        `Currently playing for ${randomFrom(clubs).name}, ${firstName} has shown excellent development over the past season.`,
        generatePlayingStyle(mainPosition).summary,
        true, // Published
        true  // Test data
      ]
    );
    
    // Add positions
    const secondaryPositions = Object.keys(positions)
      .filter(p => p !== mainPosition && positions[p].category === positions[mainPosition].category)
      .slice(0, randomBetween(1, 2));
    
    await client.query(
      'INSERT INTO player_positions (player_id, position, suitability, is_primary, position_order) VALUES ($1, $2, $3, $4, $5)',
      [playerId, mainPosition, randomBetween(80, 95), true, 0]
    );
    
    for (let i = 0; i < secondaryPositions.length; i++) {
      await client.query(
        'INSERT INTO player_positions (player_id, position, suitability, is_primary, position_order) VALUES ($1, $2, $3, $4, $5)',
        [playerId, secondaryPositions[i], randomBetween(60, 80), false, i + 1]
      );
    }
    
    // Add teams
    const numTeams = randomBetween(1, 3);
    const selectedClubs = [];
    for (let i = 0; i < numTeams; i++) {
      let club;
      do {
        club = randomFrom(clubs);
      } while (selectedClubs.includes(club.name));
      selectedClubs.push(club.name);
      
      await client.query(
        'INSERT INTO player_teams (player_id, club_name, league, is_primary) VALUES ($1, $2, $3, $4)',
        [playerId, club.name, club.league, i === 0]
      );
    }
    
    // Add abilities
    const abilities = generateAbilities(mainPosition);
    await client.query(
      `INSERT INTO player_abilities (
        player_id,
        ball_control, passing, shooting, dribbling, first_touch, crossing, tackling, heading,
        pace, strength, stamina, agility, balance, jumping,
        decision_making, positioning, concentration, leadership, communication,
        sprint_10m, sprint_30m, run_1km, bleep_test
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        playerId,
        abilities.technical.ball_control,
        abilities.technical.passing,
        abilities.technical.shooting,
        abilities.technical.dribbling,
        abilities.technical.first_touch,
        abilities.technical.crossing,
        abilities.technical.tackling,
        abilities.technical.heading,
        abilities.physical.pace,
        abilities.physical.strength,
        abilities.physical.stamina,
        abilities.physical.agility,
        abilities.physical.balance,
        abilities.physical.jumping,
        abilities.mental.decision_making,
        abilities.mental.positioning,
        abilities.mental.concentration,
        abilities.mental.leadership,
        abilities.mental.communication,
        abilities.athletic.sprint_10m,
        abilities.athletic.sprint_30m,
        abilities.athletic.run_1km,
        abilities.athletic.bleep_test
      ]
    );
    
    // Add some achievements for some players
    if (Math.random() > 0.5) {
      const achievements = [
        { level: 'district', season: '2023/24' },
        { level: 'county', season: '2022/23' }
      ];
      
      const achievement = randomFrom(achievements);
      await client.query(
        'INSERT INTO player_representative_teams (player_id, level, season) VALUES ($1, $2, $3)',
        [playerId, achievement.level, achievement.season]
      );
    }
    
    // Add trophies for some players
    if (Math.random() > 0.6) {
      const trophies = [
        { title: 'League Champions', season: '2023/24' },
        { title: 'Cup Winners', season: '2022/23' },
        { title: 'Player of the Tournament', season: '2023/24' },
        { title: 'Top Scorer', season: '2022/23' }
      ];
      
      const trophy = randomFrom(trophies);
      await client.query(
        'INSERT INTO player_trophies (player_id, title, season) VALUES ($1, $2, $3)',
        [playerId, trophy.title, trophy.season]
      );
    }
    
    await client.query('COMMIT');
    
    console.log(`Created test player: ${firstName} ${lastName} (${mainPosition})`);
    return { id: playerId, name: `${firstName} ${lastName}`, position: mainPosition };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function generateTestPlayers(playersPerPosition = 20) {
  console.log('=== generateTestPlayers called with:', playersPerPosition);
  const createdPlayers = [];
  
  try {
    console.log(`Starting generation of ${playersPerPosition} test players per position...`);
    
    // First add the test data field if it doesn't exist
    const { addTestDataField } = require('./add-test-data-field');
    const fieldResult = await addTestDataField();
    console.log('Test data field result:', fieldResult);
    
    // Create a test user account for all test players
    console.log('Creating test user account...');
    const testUser = await createTestUser('testplayers', 'testplayers@example.com', 'player');
    console.log(`Using test user account: ${testUser.username} (ID: ${testUser.id})`);
    
    const positionKeys = Object.keys(positions);
    const totalPlayers = positionKeys.length * playersPerPosition;
    
    console.log(`Positions available: ${positionKeys.join(', ')}`);
    console.log(`Creating ${playersPerPosition} players for each of ${positionKeys.length} positions (${totalPlayers} total)...`);
    
    if (positionKeys.length === 0) {
      console.error('No positions defined!');
      return createdPlayers;
    }
    
    let playerIndex = 1;
    for (const position of positionKeys) {
      console.log(`\nCreating ${playersPerPosition} ${position} players...`);
      
      for (let i = 0; i < playersPerPosition; i++) {
        try {
          // Override the position selection in createTestPlayer
          const player = await createTestPlayerForPosition(testUser, playerIndex, position);
          if (player) {
            createdPlayers.push(player);
            console.log(`Created ${position} player ${i + 1}: ${player.first_name} ${player.last_name}`);
          }
          playerIndex++;
        } catch (err) {
          console.error(`Failed to create ${position} player ${i + 1}:`, err.message);
        }
      }
    }
    
    console.log(`\n\nSuccessfully created ${createdPlayers.length} test players!`);
    console.log('\nTest Account Credentials:');
    console.log('Username: testplayers');
    console.log('Password: Test123!');
    
    // Summary by position
    console.log('\nPlayers created by position:');
    const positionCounts = {};
    createdPlayers.forEach(p => {
      positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
    });
    Object.entries(positionCounts).forEach(([pos, count]) => {
      console.log(`- ${pos}: ${count} players`);
    });
    
    return createdPlayers;
    
  } catch (err) {
    console.error('Failed to generate test players:', err);
    console.error('Error stack:', err.stack);
    // Return empty array instead of throwing
    return createdPlayers;
  }
}

async function createTestPlayerForPosition(user, index, position) {
  const playerId = uuidv4();
  const gender = index % 3 === 0 ? 'female' : 'male'; // 1/3 female players
  const firstName = randomFrom(firstNames[gender]);
  const lastName = randomFrom(lastNames);
  
  // Vary age and player types for realistic distribution
  let age, playerType;
  const typeRoll = Math.random();
  
  if (typeRoll < 0.1) {
    // 10% elite young players
    age = randomBetween(16, 19);
    playerType = 'elite';
  } else if (typeRoll < 0.3) {
    // 20% promising players
    age = randomBetween(15, 18);
    playerType = 'promising';
  } else if (typeRoll < 0.6) {
    // 30% average players
    age = randomBetween(14, 21);
    playerType = 'average';
  } else if (typeRoll < 0.85) {
    // 25% developing players
    age = randomBetween(14, 17);
    playerType = 'developing';
  } else {
    // 15% raw talent
    age = randomBetween(14, 16);
    playerType = 'raw';
  }
  
  const location = randomFrom(locations);
  const height = generateHeight(position);
  const weight = generateWeight(height);
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create player record
    await client.query(
      `INSERT INTO players (
        id, user_id, first_name, last_name, date_of_birth, nationality,
        height_cm, height_feet, height_inches, weight_kg, weight_lbs,
        preferred_foot, weak_foot_strength,
        player_phone, player_email, guardian_name, guardian_phone, guardian_email,
        years_playing, based_location, current_school, grade_year,
        postcode, city, county, country, latitude, longitude,
        availability_status, willing_to_relocate, travel_radius,
        showcase_description, playing_style_summary, 
        is_published, is_test_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36
      )`,
      [
        playerId,
        user.id,
        firstName,
        lastName,
        generateBirthDate(age, age),
        'English',
        height,
        Math.floor(height / 30.48), // feet
        Math.round((height / 2.54) % 12), // inches
        weight,
        Math.round(weight * 2.205), // pounds
        randomFrom(['Left', 'Right', 'Both']),
        randomBetween(30, 80),
        `+44 7${randomBetween(100000000, 999999999)}`,
        `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@testmail.com`,
        `${randomFrom(['John', 'Jane', 'David', 'Sarah'])} ${lastName}`,
        `+44 7${randomBetween(100000000, 999999999)}`,
        `parent.${lastName.toLowerCase()}${index}@testmail.com`,
        randomBetween(3, 10),
        location.city,
        randomFrom(schools),
        `Year ${age - 5}`,
        location.postcode + randomBetween(1, 9),
        location.city,
        location.county,
        'England',
        location.lat + (Math.random() - 0.5) * 0.1,
        location.lng + (Math.random() - 0.5) * 0.1,
        // Vary availability based on player type
        playerType === 'elite' ? randomFrom(['open_to_offers', 'not_looking']) :
        playerType === 'raw' ? 'actively_looking' :
        randomFrom(['actively_looking', 'open_to_offers', 'not_looking']),
        // Elite players less willing to relocate
        playerType === 'elite' ? Math.random() > 0.8 : Math.random() > 0.5,
        // Travel radius varies by type
        playerType === 'elite' ? randomBetween(30, 100) :
        playerType === 'raw' ? randomBetween(5, 25) :
        randomBetween(10, 50),
        `${firstName} is ${playerType === 'elite' ? 'an exceptional' : 
          playerType === 'promising' ? 'a promising' :
          playerType === 'developing' ? 'a developing' :
          playerType === 'raw' ? 'a raw but talented' :
          'a solid'} ${positions[position].name.toLowerCase()} ` +
        `${playerType === 'elite' ? 'who stands out at the highest youth levels' :
          playerType === 'promising' ? 'showing great potential for the future' :
          playerType === 'developing' ? 'working hard to improve their game' :
          playerType === 'raw' ? 'with natural ability that needs refinement' :
          'with consistent performances'}. ` +
        `Currently playing for ${randomFrom(clubs).name}, ${firstName} ${
          playerType === 'elite' ? 'has been attracting attention from top academies' :
          playerType === 'promising' ? 'has shown excellent development' :
          'continues to work on their game'}.`,
        generatePlayingStyle(position).summary,
        true, // Published
        true  // Test data
      ]
    );
    
    // Add primary position
    await client.query(
      'INSERT INTO player_positions (player_id, position, suitability, is_primary, position_order) VALUES ($1, $2, $3, $4, $5)',
      [playerId, position, randomBetween(80, 95), true, 0]
    );
    
    // Add 1-2 secondary positions from same category
    const secondaryPositions = Object.keys(positions)
      .filter(p => p !== position && positions[p].category === positions[position].category)
      .slice(0, randomBetween(1, 2));
    
    for (let i = 0; i < secondaryPositions.length; i++) {
      await client.query(
        'INSERT INTO player_positions (player_id, position, suitability, is_primary, position_order) VALUES ($1, $2, $3, $4, $5)',
        [playerId, secondaryPositions[i], randomBetween(60, 80), false, i + 1]
      );
    }
    
    // Add teams
    const numTeams = randomBetween(1, 3);
    const selectedClubs = [];
    for (let i = 0; i < numTeams; i++) {
      let club;
      do {
        club = randomFrom(clubs);
      } while (selectedClubs.includes(club.name));
      selectedClubs.push(club.name);
      
      await client.query(
        'INSERT INTO player_teams (player_id, club_name, league, is_primary) VALUES ($1, $2, $3, $4)',
        [playerId, club.name, club.league, i === 0]
      );
    }
    
    // Add abilities based on player type
    const abilities = generateAbilities(position, playerType);
    await client.query(
      `INSERT INTO player_abilities (
        player_id,
        ball_control, passing, shooting, dribbling, first_touch, crossing, tackling, heading,
        pace, strength, stamina, agility, balance, jumping,
        decision_making, positioning, concentration, leadership, communication,
        sprint_10m, sprint_30m, run_1km, bleep_test
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        playerId,
        abilities.technical.ball_control,
        abilities.technical.passing,
        abilities.technical.shooting,
        abilities.technical.dribbling,
        abilities.technical.first_touch,
        abilities.technical.crossing,
        abilities.technical.tackling,
        abilities.technical.heading,
        abilities.physical.pace,
        abilities.physical.strength,
        abilities.physical.stamina,
        abilities.physical.agility,
        abilities.physical.balance,
        abilities.physical.jumping,
        abilities.mental.decision_making,
        abilities.mental.positioning,
        abilities.mental.concentration,
        abilities.mental.leadership,
        abilities.mental.communication,
        abilities.athletic.sprint_10m,
        abilities.athletic.sprint_30m,
        abilities.athletic.run_1km,
        abilities.athletic.bleep_test
      ]
    );
    
    // Add some achievements for some players
    if (Math.random() > 0.5) {
      const achievements = [
        { level: 'district', season: '2023/24' },
        { level: 'county', season: '2022/23' }
      ];
      
      const achievement = randomFrom(achievements);
      await client.query(
        'INSERT INTO player_representative_teams (player_id, level, season) VALUES ($1, $2, $3)',
        [playerId, achievement.level, achievement.season]
      );
    }
    
    // Add trophies for some players
    if (Math.random() > 0.6) {
      const trophies = [
        { title: 'League Champions', season: '2023/24' },
        { title: 'Cup Winners', season: '2022/23' },
        { title: 'Player of the Tournament', season: '2023/24' },
        { title: 'Top Scorer', season: '2022/23' }
      ];
      
      const trophy = randomFrom(trophies);
      await client.query(
        'INSERT INTO player_trophies (player_id, title, season) VALUES ($1, $2, $3)',
        [playerId, trophy.title, trophy.season]
      );
    }
    
    await client.query('COMMIT');
    
    console.log(`Created test ${position} player: ${firstName} ${lastName}`);
    return { id: playerId, name: `${firstName} ${lastName}`, position: position };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// If run directly
if (require.main === module) {
  const count = parseInt(process.argv[2]) || 20;
  generateTestPlayers(count)
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { generateTestPlayers };