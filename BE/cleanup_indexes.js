const { db } = require('./database');

async function cleanup() {
  try {
    const [indexes] = await db.query("SHOW INDEX FROM users");
    console.log(`Found ${indexes.length} indexes.`);
    
    // Filter indexes to drop: any index starting with 'username_' followed by a number
    const toDrop = indexes
      .map(i => i.Key_name)
      .filter(name => /^username_\d+$/.test(name));

    // Dedup names (SHOW INDEX returns a row per column in index)
    const uniqueToDrop = [...new Set(toDrop)];
    
    console.log(`Dropping ${uniqueToDrop.length} duplicate indexes...`);

    for (const indexName of uniqueToDrop) {
      console.log(`Dropping index: ${indexName}`);
      await db.query(`ALTER TABLE users DROP INDEX ${indexName}`);
    }

    console.log('Cleanup complete.');
    process.exit(0);
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }
}

cleanup();
