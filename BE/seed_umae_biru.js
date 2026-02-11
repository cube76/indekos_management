const { db, initDB } = require('./database');

async function seed() {
    try {
        console.log('Starting seed for Umae Biru...');
        await initDB();

        // 1. Create Building
        console.log('Checking/Creating Building: Umae Biru');
        let buildingId;
        const [existing] = await db.query('SELECT id FROM buildings WHERE name = ?', ['Umae Biru']);
        
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
            const [buildingResult] = await db.query('INSERT INTO buildings (name, address) VALUES (?, ?)', ['Umae Biru', 'N/A']);
            buildingId = buildingResult.insertId;
        }

        // Data from User
        // Note: Dates are DD/MM/YYYY. Need to convert to YYYY-MM-DD.
        // Status 'FEB PAID' implies paid up to Feb expiration date.
        // 'payment_date' is "Pembayaran Terakhir".
        // 'period_end' is "Habis Masa Sewa".
        // 'period_start' is 'period_end' - 1 month (approx).
        
        const data = [
            { room: '1', tenant: 'Hasan', payDate: '2026-01-16', expDate: '2026-02-10', price: 1400000 },
            { room: '2', tenant: 'Prayogo', payDate: '2026-01-30', expDate: '2026-02-25', price: 1500000 },
            { room: '3', tenant: 'Wan Daniel', payDate: '2026-01-06', expDate: '2026-02-05', price: 1500000 }, // Assumed Feb expiry based on Status FEB PAID
            { room: '4', tenant: 'Revanza Mozita', payDate: '2026-01-24', expDate: '2026-02-18', price: 1500000 },
            { room: '5', tenant: 'Zaki Zedia', payDate: '2026-01-21', expDate: '2026-02-18', price: 1500000 },
            { room: '6', tenant: 'M Rachmadino', payDate: '2026-01-16', expDate: '2026-02-14', price: 1500000 },
            { room: '7', tenant: 'Rahmat Fadli', payDate: '2026-01-28', expDate: '2026-02-28', price: 1500000 },
            { room: '8', tenant: 'Dwita Ayu', payDate: '2026-01-28', expDate: '2026-02-24', price: 1400000 },
            { room: '9', tenant: 'Herza', payDate: '2026-01-05', expDate: '2026-02-04', price: 1400000 },
            { room: '10', tenant: 'Tomi Tribuana', payDate: '2026-01-26', expDate: '2026-02-23', price: 1500000 },
            { room: '11', tenant: 'Destian Tony', payDate: '2026-01-26', expDate: '2026-02-23', price: 1500000 },
            { room: '12', tenant: 'Aprilian', payDate: '2026-01-01', expDate: '2026-01-31', price: 1500000 }, // Status JAN PAID
            { room: '13', tenant: 'Puji Kristianto', payDate: '2026-01-10', expDate: '2026-02-09', price: 1500000 },
            { room: '14', tenant: 'Nafis Sulthan', payDate: '2026-01-28', expDate: '2026-02-24', price: 1500000 },
            { room: '15', tenant: 'Selly', payDate: '2026-01-30', expDate: '2026-02-25', price: 1500000 },
            { room: '16', tenant: 'Ilma', payDate: '2026-01-01', expDate: '2026-01-31', price: 1500000 }, // Status JAN PAID
            { room: '17', tenant: 'Reihan', payDate: '2026-01-08', expDate: '2026-02-08', price: 1500000 },
            { room: '18', tenant: 'Junian', payDate: '2025-12-07', expDate: '2026-01-04', price: 1500000 }, // Status FEB PAID but dates are old? Using raw dates provided.
            { room: '19', tenant: 'Ghalizan', payDate: '2026-01-14', expDate: '2026-02-13', price: 1500000 }, // Status JAN PAID (typo in status? dates cover Feb)
            { room: '20', tenant: 'Faiz', payDate: '2026-01-01', expDate: '2026-01-31', price: 1500000 } // Status JAN PAID 
        ];

        // 2. Loop through rooms
        for (const d of data) {
            console.log(`Processing Room ${d.room}...`);
            
            const isOccupied = !!d.tenant;
            
            // Calculate Period Start (approx 1 month before exp)
            // Or use PayDate as approximate start? 
            // Usually ExpDate - 1 Month is safer.
            let occupiedAt = null;
            if (isOccupied) {
                 const exp = new Date(d.expDate);
                 const start = new Date(exp);
                 start.setMonth(start.getMonth() - 1);
                 occupiedAt = start.toISOString().split('T')[0];
            }

            // Create Room
            const [roomResult] = await db.query(
                'INSERT INTO rooms (room_number, building_id, building_name, price, status, tenant_name, occupied_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [d.room, buildingId, 'Umae Biru', d.price, isOccupied ? 'filled' : 'empty', d.tenant, occupiedAt]
            );
            const roomId = roomResult.insertId;

            // Add Payment if occupied
            if (isOccupied && d.payDate && d.expDate) {
                const exp = new Date(d.expDate);
                const start = new Date(exp);
                start.setMonth(start.getMonth() - 1);
                
                const periodStart = start.toISOString().slice(0, 19).replace('T', ' ');
                const periodEnd = exp.toISOString().slice(0, 19).replace('T', ' ');
                
                // Ensure payment date has time component (noon) to avoid timezone/date drift issues if interpreted as UTC midnight
                const payDate = new Date(d.payDate);
                payDate.setHours(12,0,0,0);
                const paymentDate = payDate.toISOString().slice(0, 19).replace('T', ' ');

                await db.query(
                    'INSERT INTO payments (room_id, tenant_name, amount, period_start, period_end, payment_date, payment_method, bank_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [roomId, d.tenant, d.price, periodStart, periodEnd, paymentDate, 'cash', null]
                );
            }
        }

        console.log('Seed complete for Umae Biru!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

seed();
