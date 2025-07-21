// Migration script to convert fullName to firstName and lastName
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

console.log('Starting name migration...');

pool.query('SELECT id, data FROM players', [], async (err, result) => {
    if (err) {
        console.error('Error reading players:', err);
        pool.end();
        return;
    }

    const rows = result.rows;
    let updated = 0;
    let alreadyMigrated = 0;
    
    for (const row of rows) {
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
                await pool.query(
                    'UPDATE players SET data = $1 WHERE id = $2',
                    [JSON.stringify(playerData), row.id]
                );
                
                console.log(`Updated player ${row.id}: ${playerData.personalInfo.firstName} ${playerData.personalInfo.lastName}`);
                updated++;
            }
        } catch (e) {
            console.error(`Error processing player ${row.id}:`, e);
        }
    }
    
    console.log(`\nMigration complete!`);
    console.log(`Updated: ${updated} players`);
    console.log(`Already migrated: ${alreadyMigrated} players`);
    console.log(`Total processed: ${rows.length} players`);
    
    pool.end();
});