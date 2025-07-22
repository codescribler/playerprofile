// Simple test to check if generation works
const { generateTestPlayers } = require('./generate-test-players');

async function test() {
  try {
    console.log('Testing generation...');
    const players = await generateTestPlayers(1); // Just 1 player per position
    console.log('Result:', players);
    console.log('Players created:', players.length);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();