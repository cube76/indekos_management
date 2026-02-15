const { db } = require('./database');

async function checkIndexes() {
  try {
    const [indexes] = await db.query("SHOW INDEX FROM users");
    console.log(`Found ${indexes.length} indexes on 'users' table.`);
    console.log(indexes.map(i => i.Key_name).join(', '));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkIndexes();
