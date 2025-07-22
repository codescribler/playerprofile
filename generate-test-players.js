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

function generateAbilities(position) {
  const baseRating = randomBetween(5, 8);
  const variance = 2;
  
  const abilities = {
    technical: {},
    physical: {},
    mental: {},
    athletic: {}
  };
  
  // Generate ratings based on position
  const positionStrengths = {
    'GK': ['positioning', 'communication', 'concentration'],
    'CB': ['heading', 'tackling', 'strength', 'positioning'],
    'LB': ['pace', 'crossing', 'stamina', 'tackling'],
    'RB': ['pace', 'crossing', 'stamina', 'tackling'],
    'CDM': ['tackling', 'positioning', 'strength', 'passing'],
    'CM': ['passing', 'stamina', 'decision_making', 'ball_control'],
    'CAM': ['passing', 'first_touch', 'ball_control', 'decision_making'],
    'LM': ['pace', 'crossing', 'dribbling', 'stamina'],
    'RM': ['pace', 'crossing', 'dribbling', 'stamina'],
    'LW': ['pace', 'dribbling', 'agility', 'shooting'],
    'RW': ['pace', 'dribbling', 'agility', 'shooting'],
    'ST': ['shooting', 'heading', 'strength', 'positioning'],
    'CF': ['shooting', 'first_touch', 'positioning', 'ball_control']
  };
  
  const strengths = positionStrengths[position] || [];
  
  // Technical abilities
  const technicalSkills = ['ball_control', 'passing', 'shooting', 'dribbling', 'first_touch', 'crossing', 'tackling', 'heading'];
  technicalSkills.forEach(skill => {
    abilities.technical[skill] = strengths.includes(skill) 
      ? randomBetween(baseRating, baseRating + variance)
      : randomBetween(baseRating - variance, baseRating);
  });
  
  // Physical abilities
  const physicalSkills = ['pace', 'strength', 'stamina', 'agility', 'balance', 'jumping'];
  physicalSkills.forEach(skill => {
    abilities.physical[skill] = strengths.includes(skill)
      ? randomBetween(baseRating, baseRating + variance)
      : randomBetween(baseRating - variance, baseRating);
  });
  
  // Mental abilities
  const mentalSkills = ['decision_making', 'positioning', 'concentration', 'leadership', 'communication'];
  mentalSkills.forEach(skill => {
    abilities.mental[skill] = strengths.includes(skill)
      ? randomBetween(baseRating, baseRating + variance)
      : randomBetween(baseRating - variance, baseRating);
  });
  
  // Athletic measurements
  abilities.athletic = {
    sprint_10m: (1.7 + Math.random() * 0.3).toFixed(2),
    sprint_30m: (4.0 + Math.random() * 0.5).toFixed(2),
    run_1km: (180 + randomBetween(0, 60)).toFixed(0),
    bleep_test: (10 + Math.random() * 4).toFixed(1)
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

async function generateTestPlayers(count = 20) {
  try {
    console.log(`Starting generation of ${count} test players...`);
    
    // First add the test data field if it doesn't exist
    const { addTestDataField } = require('./add-test-data-field');
    await addTestDataField();
    
    // Create a test user account for all test players
    const testUser = await createTestUser('testplayers', 'testplayers@example.com', 'player');
    console.log(`Using test user account: ${testUser.username}`);
    
    const createdPlayers = [];
    
    for (let i = 1; i <= count; i++) {
      try {
        const player = await createTestPlayer(testUser, i);
        createdPlayers.push(player);
      } catch (err) {
        console.error(`Failed to create player ${i}:`, err);
      }
    }
    
    console.log(`\nSuccessfully created ${createdPlayers.length} test players!`);
    console.log('\nTest Account Credentials:');
    console.log('Username: testplayers');
    console.log('Password: Test123!');
    console.log('\nCreated players:');
    createdPlayers.forEach(p => console.log(`- ${p.name} (${p.position})`));
    
    return createdPlayers;
    
  } catch (err) {
    console.error('Failed to generate test players:', err);
    throw err;
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