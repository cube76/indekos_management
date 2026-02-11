const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { db } = require('../database');

async function seedScenarios() {
    console.log('--- Seeding Scenarios (Base Date: 2026-02-05) ---');

    const scenarios = [
        {
            room: '201',
            desc: 'Overdue (Pay OK)',
            building: 'Tower A',
            price: 1500000,
            tenant: 'Alice (Overdue)',
            phone: '081234567890',
            occupied_at: '2025-12-25 10:00:00',
            // Paid 1 month: Dec 25 -> Jan 25.
            // Due: Jan 25. Today: Feb 5. Overdue ~11 days. (Severe > Feb 25).
            payment_start: '2025-12-25 10:00:00',
            payment_end: '2026-01-25 10:00:00' 
        },
        {
            room: '202',
            desc: 'Kick Out (> 1 Month Overdue)',
            building: 'Tower A',
            price: 1500000,
            tenant: 'Bob (KickOut)',
            phone: '081234567891',
            occupied_at: '2025-11-15 10:00:00',
            // Paid 1 month: Nov 15 -> Dec 15.
            // Due: Dec 15. Today: Feb 5.
            // Severe Threshold: Dec 15 + 1 month = Jan 15.
            // Feb 5 > Jan 15. Severe = TRUE.
            payment_start: '2025-11-15 10:00:00',
            payment_end: '2025-12-15 10:00:00'
        },
        {
            room: '203',
            desc: 'Almost Overdue (5 Days)',
            building: 'Tower B',
            price: 1600000,
            tenant: 'Charlie (Soon)',
            phone: '081234567892',
            occupied_at: '2026-01-10 10:00:00',
            // Paid 1 month: Jan 10 -> Feb 10.
            // Due: Feb 10. Today: Feb 5. Diff = 5 days.
            payment_start: '2026-01-10 10:00:00',
            payment_end: '2026-02-10 10:00:00'
        },
        {
            room: '204',
            desc: 'Due Tomorrow',
            building: 'Tower B',
            price: 1600000,
            tenant: 'Dave (Tmrw)',
            phone: '081234567893',
            occupied_at: '2026-01-06 10:00:00',
            // Paid 1 month: Jan 6 -> Feb 6.
            // Due: Feb 6. Today: Feb 5. Diff = 1 day.
            payment_start: '2026-01-06 10:00:00',
            payment_end: '2026-02-06 10:00:00'
        }
    ];

    try {
        for (const s of scenarios) {
            // Cleanup existing
            await db.query('DELETE FROM payments WHERE room_id = (SELECT id FROM rooms WHERE room_number = ?)', [s.room]);
            await db.query('DELETE FROM rooms WHERE room_number = ?', [s.room]);

            // Insert Room
            const [res] = await db.query(`
                INSERT INTO rooms (room_number, building_name, price, status, tenant_name, tenant_id_number, tenant_phone, occupied_at)
                VALUES (?, ?, ?, 'filled', ?, 'ID12345', ?, ?)
            `, [s.room, s.building, s.price, s.tenant, s.phone, s.occupied_at]);
            
            const roomId = res.insertId;

            // Insert Payment
            await db.query(`
                INSERT INTO payments (room_id, amount, period_start, period_end, payment_date, tenant_name)
                VALUES (?, ?, ?, ?, NOW(), ?)
            `, [roomId, s.price, s.payment_start, s.payment_end, s.tenant]);

            console.log(`Created Room ${s.room}: ${s.desc}`);
        }
        console.log('Seeding Complete.');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seedScenarios();
