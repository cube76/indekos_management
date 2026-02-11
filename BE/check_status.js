const { db } = require('./database');
const { calculateNextDueDate } = require('./utils/date');
require('dotenv').config();

console.log('DB_HOST:', process.env.DB_HOST);

async function check() {
    console.log('Checking rooms for notification criteria...');
    const [rooms] = await db.query("SELECT * FROM rooms WHERE status = 'filled'");
    
    for (const room of rooms) {
        const [lastPayment] = await db.query(
          'SELECT period_end FROM payments WHERE room_id = ? ORDER BY period_end DESC LIMIT 1',
          [room.id]
        );

        let nextDueDate;
        const occupied = new Date(room.occupied_at);
        
        if (lastPayment.length > 0) {
           nextDueDate = calculateNextDueDate(occupied, new Date(lastPayment[0].period_end));
        } else {
           nextDueDate = occupied;
        }

        const today = new Date();
        const diffTime = nextDueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        console.log(`Room ${room.room_number}: Due ${nextDueDate.toISOString().split('T')[0]}, DiffDays: ${diffDays}`);
        
        if (diffDays === 7) console.log('  -> MATCH: Due Soon (7 days)');
        if (today > nextDueDate) console.log('  -> MATCH: Overdue');
    }
    process.exit();
}

check();
