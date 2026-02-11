const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { db } = require('../database');
const { calculateNextDueDate } = require('../utils/date');

async function debugRoom1() {
    try {
        console.log('--- Debugging Room 1 ---');
        // 1. Fetch Room
        const [rooms] = await db.query("SELECT * FROM rooms WHERE id = 1");
        if (rooms.length === 0) {
            console.log('Room 1 not found');
            return;
        }
        const room = rooms[0];
        console.log('Room:', {
            id: room.id,
            occupied_at: room.occupied_at,
            status: room.status
        });

        // 2. Fetch Payments
        const [payments] = await db.query("SELECT * FROM payments WHERE room_id = 1 ORDER BY period_end DESC");
        console.log(`Found ${payments.length} payments.`);
        if (payments.length > 0) {
            console.log('Latest Payment:', payments[0]);
        }

        // 3. Calculate Logic
        const lastEnd = payments.length > 0 ? new Date(payments[0].period_end) : null;
        const occupied = new Date(room.occupied_at);
        
        console.log('Calculating Next Due Date...');
        console.log('Occupied At:', occupied.toISOString());
        console.log('Last Payment End:', lastEnd ? lastEnd.toISOString() : 'None');
        
        const nextDue = calculateNextDueDate(occupied, lastEnd);
        console.log('calculated Next Due:', nextDue.toISOString());
        
        const now = new Date();
        const isOverdue = now > nextDue;
        console.log('Is Overdue?', isOverdue, '(Now:', now.toISOString(), ')');
        
        // 4. Check Frontend Logic "7 days"
        const diffTime = nextDue - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        console.log('Days until due:', diffDays);
        if (diffDays <= 7) console.log('Button would SHOW (Due within 7 days or overdue)');
        else console.log('Button would HIDE');

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

debugRoom1();
