const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { calculateNextDueDate, addMonths } = require('../utils/date');

const router = express.Router();

// Get all rooms (sorted by building name, then room number)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get rooms with their latest payment date and building info
    const query = `
      SELECT r.*, b.name as building_name, b.logo_url as building_logo, MAX(p.period_end) as latest_payment_end
      FROM rooms r
      LEFT JOIN buildings b ON r.building_id = b.id
      LEFT JOIN payments p ON r.id = p.room_id
      GROUP BY r.id
      ORDER BY b.name ASC, r.room_number ASC
    `;
    const [rooms] = await db.query(query);

    // Calculate overdue status
    const now = new Date();
    const roomsWithStatus = rooms.map(room => {
      let isOverdue = false;
      let nextDueDate = null;

      if (room.status === 'filled' && room.occupied_at) {
        if (!room.latest_payment_end) {
            nextDueDate = new Date(room.occupied_at);
        } else {
            nextDueDate = calculateNextDueDate(new Date(room.occupied_at), new Date(room.latest_payment_end));
        }
        isOverdue = now > nextDueDate;
      }

      return {
        ...room,
        nextDueDate,
        isOverdue
      };
    });

    res.json(roomsWithStatus);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Get room detail info
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT r.*, b.name as building_name, b.address as building_address, b.logo_url as building_logo 
      FROM rooms r 
      LEFT JOIN buildings b ON r.building_id = b.id 
      WHERE r.id = ?
    `;
    const [rooms] = await db.query(query, [req.params.id]);
    if (rooms.length === 0) return res.status(404).send('Room not found');
    
    // Calculate status (Same logic as list)
    const room = rooms[0];
    const [lastPayment] = await db.query(
      'SELECT period_end FROM payments WHERE room_id = ? ORDER BY period_end DESC LIMIT 1',
      [req.params.id]
    );

    let isOverdue = false;
    let nextDueDate = null;
    let latest_payment_end = lastPayment.length > 0 ? lastPayment[0].period_end : null;

    if (room.status === 'filled' && room.occupied_at) {
        const lastPaid = latest_payment_end ? new Date(latest_payment_end) : null;
        
        if (!lastPaid) {
            nextDueDate = new Date(room.occupied_at);
        } else {
            nextDueDate = calculateNextDueDate(new Date(room.occupied_at), lastPaid);
        }
        
        isOverdue = new Date() > nextDueDate;
    }

    res.json({
        ...room,
        nextDueDate,
        isOverdue
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Create/Update Room (Optional helper for testing/seeding, or for Admin)
// The user requirement didn't explicitly ask for an API to add rooms, but "have login... create new login user... access list of room". 
// Usually you need a way to populate rooms. I'll add a simple create route for Super Admin.
const { requireRole } = require('../middleware/auth');

// Move Out (Clear Tenant)
router.post('/:id/moveout', authenticateToken, async (req, res) => {
  try {
    // Check if room exists
    const [rooms] = await db.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (rooms.length === 0) return res.status(404).send('Room not found');

    // Update room status
    await db.query(`
      UPDATE rooms 
      SET status = 'empty', 
          tenant_name = NULL, 
          tenant_id_number = NULL, 
          tenant_phone = NULL, 
          occupied_at = NULL 
      WHERE id = ?
    `, [req.params.id]);

    res.send('Tenant moved out successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Assign Tenant (Add Tenant to Empty Room)
router.post('/:id/tenant', authenticateToken, async (req, res) => {
  const { tenant_name, tenant_id_number, tenant_phone, occupied_at } = req.body;
  
  if (!tenant_name || !tenant_name.trim() || 
      !tenant_id_number || !tenant_id_number.trim() || 
      !tenant_phone || !tenant_phone.trim() || 
      !occupied_at) {
    return res.status(400).send('All tenant details are required and cannot be empty');
  }

  try {
    // Check if room exists and is empty
    const [rooms] = await db.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (rooms.length === 0) return res.status(404).send('Room not found');
    if (rooms[0].status === 'filled') return res.status(400).send('Room is already filled');

    const formattedDate = new Date(occupied_at);

    await db.query(`
      UPDATE rooms 
      SET status = 'filled', 
      tenant_name = ?, 
      tenant_id_number = ?, 
      tenant_phone = ?, 
      occupied_at = ? 
      WHERE id = ?
      `, [tenant_name, tenant_id_number, tenant_phone, formattedDate, req.params.id]);

      // [NEW] Automatically record first month's payment
      const periodStart = new Date(occupied_at);
      const periodEnd = addMonths(periodStart, 1);
      
      await db.query(`
      INSERT INTO payments (room_id, amount, period_start, period_end, payment_date, tenant_name)
      VALUES (?, ?, ?, ?, NOW(), ?)
      `, [req.params.id, rooms[0].price, periodStart, periodEnd, tenant_name]);

      res.send('Tenant assigned successfully');
      } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
      }
      });

      // Create a Room (Super Admin only)
      router.post('/', authenticateToken, requireRole('superadmin'), async (req, res) => {
      const { room_number, building_id, price, status, tenant_name, tenant_id_number, occupied_at } = req.body;
      if (!room_number || !building_id) return res.status(400).send('Room number and building required');

      try {
      const statusVal = status || 'empty';
      const priceVal = price || 0;

      let tName = tenant_name;
      let tId = tenant_id_number;
      let occAt = occupied_at;

      if (statusVal === 'empty') {
      tName = null;
      tId = null;
      occAt = null;
      } else if (occAt) {
      occAt = new Date(occAt);
      }

    // building_name is legacy, we fetch it from DB for consistency if needed, or just insert.
    // We will redundancy-fill building_name for now to avoid breaking other legacy queries immediately
    // although our migration should handle it. Ideally code should switch to building_id solely.
    // Let's look up the building name for the legacy column.
    const [b] = await db.query('SELECT name FROM buildings WHERE id = ?', [building_id]);
    const bName = b.length ? b[0].name : 'Unknown';

    await db.query(
      'INSERT INTO rooms (room_number, building_id, building_name, price, status, tenant_name, tenant_id_number, tenant_phone, occupied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [room_number, building_id, bName, priceVal, statusVal, tName, tId, req.body.tenant_phone, occAt]
    );
    res.status(201).send('Room created');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).send('Room number already exists');
    }
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Update Room (Super Admin)
router.put('/:id', authenticateToken, requireRole('superadmin'), async (req, res) => {
    const { room_number, building_id, price } = req.body;
    
    try {
        const [existing] = await db.query('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
        if (existing.length === 0) return res.status(404).send('Room not found');

        // Look up building name if building_id changes
        let bName = existing[0].building_name;
        if (building_id) {
            const [b] = await db.query('SELECT name FROM buildings WHERE id = ?', [building_id]);
            if (b.length) bName = b[0].name;
        }

        await db.query(`
            UPDATE rooms 
            SET room_number = ?, 
                building_id = ?, 
                building_name = ?,
                price = ?
            WHERE id = ?
        `, [
            room_number || existing[0].room_number, 
            building_id || existing[0].building_id,
            bName,
            price || existing[0].price,
            req.params.id
        ]);

        res.send('Room updated successfully');
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).send('Room number already exists');
        }
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Delete Room (Super Admin)
router.delete('/:id', authenticateToken, requireRole('superadmin'), async (req, res) => {
    try {
        // Check for payments? Usually safe to delete room but payments might be orphaned or we cascade delete.
        // For safety, let's warn if payments exist or just delete them (CASCADE is not set on payments table in create script usually).
        // The payments table schema in database.js has FOREIGN KEY (room_id). Usually deletion fails if restrict.
        // For now, let's try delete.
        
        await db.query('DELETE FROM payments WHERE room_id = ?', [req.params.id]); // Clear history first
        await db.query('DELETE FROM rooms WHERE id = ?', [req.params.id]);
        
        res.send('Room deleted successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
