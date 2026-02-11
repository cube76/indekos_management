const { db, initDB } = require('./database');

async function seed() {
    try {
        console.log('Starting seed for Humah F4...');
        await initDB();

        // 1. Create Building
        console.log('Checking/Creating Building: Humah F4');
        let buildingId;
        const [existing] = await db.query('SELECT id FROM buildings WHERE name = ?', ['Humah F4']);
        
        if (existing.length > 0) {
            console.log('Building exists, using ID:', existing[0].id);
            buildingId = existing[0].id;
            
            // Clear data for this building
            console.log('Clearing existing data (payments & rooms) for this building...');
            // Find room IDs first
            const [rooms] = await db.query('SELECT id FROM rooms WHERE building_id = ?', [buildingId]);
            if (rooms.length > 0) {
                const roomIds = rooms.map(r => r.id);
                // Delete payments for these rooms
                await db.query(`DELETE FROM payments WHERE room_id IN (${roomIds.join(',')})`);
                // Delete rooms
                await db.query('DELETE FROM rooms WHERE building_id = ?', [buildingId]);
            }
        } else {
            const [buildingResult] = await db.query('INSERT INTO buildings (name, address) VALUES (?, ?)', ['Humah F4', 'N/A']);
            buildingId = buildingResult.insertId;
        }

        // Data from New User Request
        // Room 1: 2.7m (Available)
        // Room 2: 2.5m (Available)
        // Others: 1.3m (Tenants)
        // Room 8: 1.3m (Available)
        
        const data = [
            { room: '1', price: 2700000, tenant: null }, // Available
            { room: '2', price: 2500000, tenant: null }, // Available
            { room: '3', price: 1300000, tenant: 'M Ebni Hannibal', payDate: '2026-01-03', expDate: '2026-02-01' },
            { room: '4', price: 1300000, tenant: 'Febrianto', payDate: '2025-12-21', expDate: '2026-01-20' },
            { room: '5', price: 1300000, tenant: 'M Ibnu', payDate: '2026-01-06', expDate: '2026-02-04' },
            { room: '6', price: 1300000, tenant: 'Aditya', payDate: '2026-01-06', expDate: '2026-02-11' },
            { room: '7', price: 1300000, tenant: 'Firaas', payDate: '2026-01-15', expDate: '2026-02-12' },
            { room: '8', price: 1300000, tenant: null }, // Available
        ];

        // 2. Loop through rooms
        for (const d of data) {
            console.log(`Processing Room ${d.room}...`);
            
            const isOccupied = !!d.tenant;
            
            // Calculate Occupied At (approx 1 month before exp)
            let occupiedAt = null;
            if (isOccupied && d.expDate) {
                 const exp = new Date(d.expDate);
                 const start = new Date(exp);
                 start.setMonth(start.getMonth() - 1);
                 occupiedAt = start.toISOString().split('T')[0];
            }

            // Create Room
            const [roomResult] = await db.query(
                'INSERT INTO rooms (room_number, building_id, building_name, price, status, tenant_name, occupied_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [d.room, buildingId, 'Humah F4', d.price, isOccupied ? 'filled' : 'empty', d.tenant, occupiedAt]
            );
            const roomId = roomResult.insertId;

            // Add Payment if occupied
            if (isOccupied && d.payDate && d.expDate) {
                const exp = new Date(d.expDate);
                const start = new Date(exp);
                start.setMonth(start.getMonth() - 1);
                
                const periodStart = start.toISOString().slice(0, 19).replace('T', ' ');
                const periodEnd = exp.toISOString().slice(0, 19).replace('T', ' ');
                
                // Ensure payment date has time component (noon)
                const payDate = new Date(d.payDate);
                payDate.setHours(12,0,0,0);
                const paymentDate = payDate.toISOString().slice(0, 19).replace('T', ' ');

                await db.query(
                    'INSERT INTO payments (room_id, tenant_name, amount, period_start, period_end, payment_date, payment_method, bank_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [roomId, d.tenant, d.price, periodStart, periodEnd, paymentDate, 'cash', null]
                );
            }
        }

        console.log('Seed complete!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

seed();
