const { db } = require('../database');
const { calculateNextDueDate } = require('../utils/date');

async function run() {
    try {
        console.log("--- Starting Payment Status Verification ---");
        
        // 1. Create Test Room
        const [res] = await db.query("INSERT INTO rooms (room_number, price, status, building_name) VALUES ('TEST-999', 1000, 'empty', 'Test Building')");
        const roomId = res.insertId;
        console.log(`Created Room ID: ${roomId}`);

        // 2. Assign Tenant (Backdated to Jan 30)
        // Today is Feb 5. Move in Jan 30.
        // Due Date: Jan 30.
        // Overdue? Yes (Feb 5 > Jan 30).
        
        const moveInDate = new Date('2026-01-30T10:00:00Z'); 
        
        await db.query("UPDATE rooms SET status='filled', occupied_at=?, tenant_name='Test Tenant' WHERE id=?", [moveInDate, roomId]);
        console.log(`Tenant moved in on: ${moveInDate.toISOString()}`);

        // 3. Verify Overdue Status
        const checkOverdue = async () => {
             const [lastPayment] = await db.query('SELECT period_end FROM payments WHERE room_id = ? ORDER BY period_end DESC LIMIT 1', [roomId]);
             const lastEnd = lastPayment.length ? new Date(lastPayment[0].period_end) : null;
             console.log("Last Payment End in DB:", lastEnd ? lastEnd.toISOString() : "None");
             
             const nextDue = calculateNextDueDate(moveInDate, lastEnd);
             const isOverdue = new Date() > nextDue;
             console.log(`Current Next Due: ${nextDue.toISOString()} | Is Overdue? ${isOverdue}`);
             return isOverdue;
        };

        if (!await checkOverdue()) {
            console.error("FAIL: Room should be overdue initially.");
        }

        // 4. Record Payment (1 Month)
        // Interval: Jan 30 -> Feb 28 (leap? 2026 is not leap. so Feb 28)
        
        console.log("Recording Payment 1 (Jan 30 - Feb 28)...");
        const periodStart = new Date(moveInDate);
        // Manually calculate 1 month ahead logic for the INPUT
        const periodEnd = new Date(moveInDate);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        if (periodEnd.getDate() !== periodStart.getDate()) periodEnd.setDate(0); // Snap to end of Feb
        
        console.log(`Paying for period: ${periodStart.toISOString()} -> ${periodEnd.toISOString()}`);
        
        await db.query("INSERT INTO payments (room_id, amount, period_start, period_end, payment_date) VALUES (?, ?, ?, ?, NOW())", 
            [roomId, 1000, periodStart, periodEnd]);
            
        const stillOverdue = await checkOverdue();
        if (stillOverdue) {
            console.error("FAIL: Room is STILL overdue. Logic failed to advance due date?");
        } else {
            console.log("SUCCESS: Room is now PAID.");
        }

    } catch (err) {
        console.error(err);
    } finally {
        await db.query("DELETE FROM payments WHERE room_id IN (SELECT id FROM rooms WHERE room_number = 'TEST-999')");
        await db.query("DELETE FROM rooms WHERE room_number = 'TEST-999'");
        // await db.end(); // Connection pool handles itself or hangs, that's fine for script checking
        process.exit(0);
    }
}

run();
