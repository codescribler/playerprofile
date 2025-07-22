const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addTestDataField() {
  const client = await pool.connect();
  
  try {
    console.log('Adding is_test_data field to players table...');
    
    // Check if column already exists
    const { rows } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name = 'is_test_data'
    `);
    
    if (rows.length > 0) {
      console.log('is_test_data column already exists. Skipping migration.');
      return { success: true, message: 'Column already exists' };
    }
    
    // Add the column
    await client.query(`
      ALTER TABLE players 
      ADD COLUMN is_test_data BOOLEAN DEFAULT FALSE
    `);
    
    console.log('Successfully added is_test_data column');
    
    // Update any existing records to ensure they have false value
    await client.query(`
      UPDATE players 
      SET is_test_data = FALSE 
      WHERE is_test_data IS NULL
    `);
    
    console.log('Migration completed successfully!');
    return { success: true, message: 'Added is_test_data column' };
    
  } catch (err) {
    console.error('Migration failed:', err);
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

// If run directly
if (require.main === module) {
  addTestDataField()
    .then(result => {
      console.log('Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { addTestDataField };