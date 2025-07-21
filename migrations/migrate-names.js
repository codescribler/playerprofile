// Migration script to convert fullName to firstName and lastName
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'football-profile.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting name migration...');

db.all('SELECT id, player_data FROM players', [], (err, rows) => {
    if (err) {
        console.error('Error reading players:', err);
        return;
    }

    let updated = 0;
    let alreadyMigrated = 0;
    
    rows.forEach(row => {
        try {
            const playerData = JSON.parse(row.player_data);
            
            // Check if already migrated
            if (playerData.personalInfo?.firstName && playerData.personalInfo?.lastName) {
                alreadyMigrated++;
                return;
            }
            
            // Migrate fullName to firstName and lastName
            if (playerData.personalInfo?.fullName) {
                const nameParts = playerData.personalInfo.fullName.trim().split(/\s+/);
                
                if (nameParts.length === 1) {
                    // Only one name - use it as last name
                    playerData.personalInfo.firstName = '';
                    playerData.personalInfo.lastName = nameParts[0];
                } else if (nameParts.length === 2) {
                    // First and last name
                    playerData.personalInfo.firstName = nameParts[0];
                    playerData.personalInfo.lastName = nameParts[1];
                } else {
                    // Multiple names - take first as firstName, last as lastName
                    playerData.personalInfo.firstName = nameParts[0];
                    playerData.personalInfo.lastName = nameParts[nameParts.length - 1];
                }
                
                // Keep fullName for backward compatibility
                // Remove this line if you want to completely remove fullName
                // delete playerData.personalInfo.fullName;
                
                // Update the database
                db.run(
                    'UPDATE players SET player_data = ? WHERE id = ?',
                    [JSON.stringify(playerData), row.id],
                    (err) => {
                        if (err) {
                            console.error(`Error updating player ${row.id}:`, err);
                        } else {
                            console.log(`Updated player ${row.id}: ${playerData.personalInfo.firstName} ${playerData.personalInfo.lastName}`);
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
        console.log(`Updated: ${updated} players`);
        console.log(`Already migrated: ${alreadyMigrated} players`);
        console.log(`Total processed: ${rows.length} players`);
        db.close();
    }, 2000);
});