// One-time script to fix is_published column
const { getDb } = require('./database-config');

async function fixIsPublished() {
  console.log('Starting is_published fix...');
  
  try {
    const db = getDb();
    
    // First, get all players
    const result = await db.query('SELECT id, data FROM players');
    const rows = result.rows;
    
    console.log(`Found ${rows.length} players to check`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const row of rows) {
      try {
        const playerData = JSON.parse(row.data);
        const isPublished = playerData.metadata?.published === true;
        
        // Update the is_published column based on metadata.published
        await db.query(
          'UPDATE players SET is_published = $1 WHERE id = $2',
          [isPublished, row.id]
        );
        
        updatedCount++;
        console.log(`Updated player ${row.id}: is_published = ${isPublished}`);
      } catch (e) {
        console.error(`Error processing player ${row.id}:`, e);
        errorCount++;
      }
    }
    
    console.log('\nMigration complete!');
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Set all players to unpublished by default if is_published is NULL
    await db.query('UPDATE players SET is_published = false WHERE is_published IS NULL');
    console.log('Set remaining players to unpublished by default');
    
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the fix
fixIsPublished();