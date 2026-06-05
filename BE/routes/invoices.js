const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/:roomId', authenticateToken, async (req, res) => {
  const { amount, period_start, period_end } = req.body;
  
  if (!amount || !period_start || !period_end) {
    return res.status(400).send('Amount, period_start, and period_end are required');
  }

  try {
    const [rooms] = await db.query(
      `SELECT r.tenant_name, b.name as building_name 
       FROM rooms r 
       LEFT JOIN buildings b ON r.building_id = b.id 
       WHERE r.id = ?`, 
      [req.params.roomId]
    );

    if (rooms.length === 0) {
      return res.status(404).send('Room not found');
    }

    const tenantName = rooms[0].tenant_name;
    const buildingName = rooms[0].building_name || 'RES';
    
    let buildingCode = 'RES';
    const bNameLower = buildingName.toLowerCase();
    if (bNameLower.includes('humah')) buildingCode = 'F4';
    else if (bNameLower.includes('umae')) buildingCode = 'UB';
    else buildingCode = buildingName.substring(0, 3).toUpperCase();

    // Determine the current month and year for the sequence
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    // Count how many invoices were generated this month for this building
    // We count by joining rooms and buildings
    // 1. Run the query (Notice we added existing_invoice_id)
    const [countResult] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN i.tenant_name = ? THEN 1 ELSE 0 END) as tenant_invoice_count,
        MAX(CASE WHEN i.tenant_name = ? THEN i.invoice_number ELSE NULL END) as existing_invoice_number,
        MAX(CASE WHEN i.tenant_name = ? THEN i.id ELSE NULL END) as existing_invoice_id
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      LEFT JOIN buildings b ON r.building_id = b.id
      WHERE MONTH(i.created_at) = ? AND YEAR(i.created_at) = ? AND b.name = ?
    `, [tenantName, tenantName, tenantName, currentMonth, currentYear, buildingName]); 
    // tenantName is now passed 3 times to match the three '?' in the SELECT

    const total = countResult[0].total;
    const tenantInvoiceCount = Number(countResult[0].tenant_invoice_count || 0);
    const existingInvoiceNumber = countResult[0].existing_invoice_number;
    const existingInvoiceId = countResult[0].existing_invoice_id; // Grabbing the ID

    // 2. The IF / ELSE block
    if (tenantInvoiceCount > 0) {
      // ALREADY EXISTS: Return 200 OK and use the existing database ID
      res.status(200).json({
        id: existingInvoiceId, 
        invoice_number: existingInvoiceNumber,
        amount,
        tenant_name: tenantName,
        period_start,
        period_end,
        created_at: new Date() 
      });

    } else {
      // DOES NOT EXIST: Generate sequence, Insert, and return 201 Created
      const seq = total + 1;
      const seqStr = String(seq).padStart(5, '0');
      const monthStr = String(currentMonth).padStart(2, '0');
      const invoiceNumber = `# ${currentYear}/INV${buildingCode}/${monthStr}/${seqStr}`;

      const [insertResult] = await db.query(
        'INSERT INTO invoices (room_id, tenant_name, amount, invoice_number, period_start, period_end) VALUES (?, ?, ?, ?, ?, ?)',
        [req.params.roomId, tenantName, amount, invoiceNumber, new Date(period_start), new Date(period_end)]
      );

      res.status(201).json({
        id: insertResult.insertId, // Only used here where the insert actually happened
        invoice_number: invoiceNumber,
        amount,
        tenant_name: tenantName,
        period_start,
        period_end,
        created_at: new Date()
      });
    }
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
