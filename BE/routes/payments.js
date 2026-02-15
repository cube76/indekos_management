const express = require('express');
const { db } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { calculateNextDueDate } = require('../utils/date');

const router = express.Router();

// Get All Payments (Global History)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const { startDate, endDate, building_id } = req.query;

    let whereClause = '';
    const queryParams = [];

    if (startDate) {
        whereClause += ' AND p.payment_date >= ?';
        queryParams.push(startDate);
    }
    
    if (endDate) {
        // Append time to include the entire end day
        whereClause += ' AND p.payment_date <= ?';
        queryParams.push(`${endDate} 23:59:59`);
    }

    if (building_id) {
        whereClause += ' AND r.building_id = ?';
        queryParams.push(building_id);
    }

    // 1. Count Total Records & Calculate Total Profit (for the filter)
    const countQuery = `
        SELECT COUNT(*) as total, SUM(p.amount) as totalProfit 
        FROM payments p 
        JOIN rooms r ON p.room_id = r.id
        WHERE 1=1 ${whereClause}
    `;
    const [summaryResult] = await db.query(countQuery, queryParams);
    const total = summaryResult[0].total;
    const totalProfit = summaryResult[0].totalProfit || 0;

    // 2. Fetch Paginated Records
    const dataQuery = `
      SELECT p.*, r.room_number, b.name as building_name, b.address as building_address, b.logo_url as building_logo,
      p.payment_method, p.bank_name
      FROM payments p 
      JOIN rooms r ON p.room_id = r.id 
      LEFT JOIN buildings b ON r.building_id = b.id
      WHERE 1=1 ${whereClause}
      ORDER BY p.payment_date DESC
      LIMIT ? OFFSET ?
    `;
    
    // Append limit and offset to params for the second query
    const dataParams = [...queryParams, limit, offset];
    
    const [payments] = await db.query(dataQuery, dataParams);

    res.json({
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalProfit
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Get Payment History for a Room
// Get Payment History for a Room
router.get('/:roomId', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 1. Count Total for Room
    const [countResult] = await db.query('SELECT COUNT(*) as total FROM payments WHERE room_id = ?', [req.params.roomId]);
    const total = countResult[0].total;

    // 2. Fetch Paginated
    const [payments] = await db.query(
      `SELECT p.*, r.room_number, b.name as building_name, b.address as building_address, b.logo_url as building_logo,
       p.payment_method, p.bank_name
       FROM payments p 
       JOIN rooms r ON p.room_id = r.id
       LEFT JOIN buildings b ON r.building_id = b.id
       WHERE room_id = ? 
       ORDER BY payment_date DESC 
       LIMIT ? OFFSET ?`, 
      [req.params.roomId, limit, offset]
    );

    res.json({
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Record a Payment
router.post('/:roomId', authenticateToken, async (req, res) => {
  const { amount, period_start, period_end, payment_date, payment_method, bank_name } = req.body;
  if (!amount || !period_start || !period_end) {
    return res.status(400).send('Amount, period_start, and period_end are required');
  }

  try {
    // Fetch room to get current tenant name
    const [rooms] = await db.query('SELECT tenant_name FROM rooms WHERE id = ?', [req.params.roomId]);
    const tenantName = rooms.length > 0 ? rooms[0].tenant_name : null;

    // Default to NOW if not provided
    const paidAt = payment_date ? new Date(payment_date) : new Date();

    await db.query(
      'INSERT INTO payments (room_id, tenant_name, amount, period_start, period_end, payment_date, payment_method, bank_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.params.roomId, tenantName, amount, new Date(period_start), new Date(period_end), paidAt, payment_method || 'cash', bank_name || null]
    );
    res.status(201).send('Payment recorded');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Get Room Payment Status
router.get('/:roomId/status', authenticateToken, async (req, res) => {
  try {
    const [rooms] = await db.query('SELECT * FROM rooms WHERE id = ?', [req.params.roomId]);
    if (rooms.length === 0) return res.status(404).send('Room not found');
    const room = rooms[0];

    if (room.status === 'empty' || !room.occupied_at) {
      return res.json({ status: 'No active tenant' });
    }

    // Calculate Last Covered Date
    const [lastPayment] = await db.query(
      'SELECT period_end FROM payments WHERE room_id = ? ORDER BY period_end DESC LIMIT 1',
      [req.params.roomId]
    );

    let nextDueDate;
    const occupied = new Date(room.occupied_at);

    if (lastPayment.length > 0) {
      nextDueDate = calculateNextDueDate(new Date(room.occupied_at), new Date(lastPayment[0].period_end));
    } else {
      nextDueDate = occupied;
    }
    
    // The requirement says "occupied on 12 feb, pay again on 12 march".
    // If last payment covered up to X, next due is X.
    
    res.json({
      price: room.price,
      nextDueDate: nextDueDate,
      isOverdue: new Date() > nextDueDate
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
