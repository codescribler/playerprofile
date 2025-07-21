// Migration to add search-related fields and location data
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'football-profile.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting search fields migration...');

// Create player_locations table
db.run(`
    CREATE TABLE IF NOT EXISTS player_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        postcode VARCHAR(10),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        city VARCHAR(100),
        county VARCHAR(100),
        country VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        UNIQUE(player_id)
    )
`, (err) => {
    if (err) {
        console.error('Error creating player_locations table:', err);
    } else {
        console.log('✓ Created player_locations table');
        
        // Create indexes
        db.run('CREATE INDEX IF NOT EXISTS idx_location_coords ON player_locations(latitude, longitude)', (err) => {
            if (err) console.error('Error creating coordinates index:', err);
            else console.log('✓ Created coordinates index');
        });
        
        db.run('CREATE INDEX IF NOT EXISTS idx_location_postcode ON player_locations(postcode)', (err) => {
            if (err) console.error('Error creating postcode index:', err);
            else console.log('✓ Created postcode index');
        });
    }
});

// Update existing player data to include new fields
db.all('SELECT id, player_data FROM players', [], (err, rows) => {
    if (err) {
        console.error('Error reading players:', err);
        return;
    }

    let updated = 0;
    
    rows.forEach(row => {
        try {
            const playerData = JSON.parse(row.player_data);
            let needsUpdate = false;
            
            // Add location field if missing
            if (!playerData.location) {
                playerData.location = {
                    postcode: '',
                    city: '',
                    county: '',
                    country: 'England',
                    coordinates: {
                        latitude: null,
                        longitude: null
                    }
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
                    achievements: {
                        caps: 0,
                        goals: 0,
                        assists: 0,
                        cleanSheets: 0
                    }
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
                // Update the database
                db.run(
                    'UPDATE players SET player_data = ? WHERE id = ?',
                    [JSON.stringify(playerData), row.id],
                    (err) => {
                        if (err) {
                            console.error(`Error updating player ${row.id}:`, err);
                        } else {
                            updated++;
                        }
                    }
                );
            }
        } catch (e) {
            console.error(`Error processing player ${row.id}:`, e);
        }
    });
    
    setTimeout(() => {
        console.log(`\nMigration complete!`);
        console.log(`Updated: ${updated} players with new search fields`);
        console.log(`Total processed: ${rows.length} players`);
        db.close();
    }, 2000);
});