const axios = require('axios');
const { db, initDB } = require('../database');
require('dotenv').config({ path: '../.env' });

const API_URL = 'http://localhost:3693'; // Port from .env or default

async function runScenarios() {
  try {
    console.log('--- Starting Scenario Verification ---');

    // 1. Authenticate (Super Admin)
    let token;
    try {
        const login = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'equali' }); // Default creds
        token = login.data.accessToken;
        console.log('[PASS] Login successful');
    } catch(e) {
        console.error('[FAIL] Login failed. Ensure server is running (node main.js).', e.message);
        process.exit(1);
    }
    
    const headers = { Authorization: `Bearer ${token}` };

    // Helper to create a room if needed (checking room 999)
    let roomId = 999;
    try {
        await axios.post(`${API_URL}/rooms`, {
            room_number: '999',
            building_name: 'TestScenario',
            price: 500,
            status: 'empty'
        }, { headers });
    } catch(e) {} // Ignore if exists
    
    // Get ID of room 999
    const allRooms = await axios.get(`${API_URL}/rooms`, { headers });
    const room = allRooms.data.find(r => r.room_number === '999');
    if (!room) throw new Error('Test room 999 not found');
    roomId = room.id;

    // --- Scenario 1: Empty Room ---
    console.log('\n--- Scenario 1: Empty Room ---');
    // Force empty state
    await axios.post(`${API_URL}/rooms/${roomId}/moveout`, {}, { headers });
    
    // CLEANUP: Delete payments for this room to ensure clean state
    // Since we don't have a DELETE /payments route, I'll use the direct DB connection for this test script helper
    await db.query('DELETE FROM payments WHERE room_id = ?', [roomId]);
    console.log('[INFO] Cleared payments for room 999');
    
    const s1 = await axios.get(`${API_URL}/rooms/${roomId}`, { headers });
    if (s1.data.status === 'empty') {
        console.log('[PASS] Room is empty. Frontend should show "Assign Tenant" form.');
    } else {
        console.error('[FAIL] Room is not empty:', s1.data.status);
    }

    // --- Scenario 2: Filled but Overdue ---
    console.log('\n--- Scenario 2: Filled & Overdue ---');
    // Assign tenant with occupied_at 2 months ago
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    await axios.post(`${API_URL}/rooms/${roomId}/tenant`, {
        tenant_name: 'Scenario User',
        tenant_id_number: 'S12345',
        tenant_phone: '555-0101',
        occupied_at: twoMonthsAgo.toISOString().split('T')[0] // YYYY-MM-DD
    }, { headers });

    // Ensure no recent payments (clear payments for this room logic - backend doesn't have clear route but we can insert new room or just assume clean state if possible. 
    // To be safe we should check status logic).
    // Actually we can just check the status returned by API.
    
    const s2 = await axios.get(`${API_URL}/rooms/${roomId}`, { headers });
    console.log(`Debug: Next Due: ${new Date(s2.data.nextDueDate).toLocaleDateString()}, Overdue: ${s2.data.isOverdue}`);
    
    // Logic: occupied 2 months ago. Next due was 1 month after that (1 month ago). So it should be overdue.
    if (s2.data.status === 'filled' && s2.data.isOverdue) {
        console.log('[PASS] Room is Filled and Overdue. Frontend should show "Record Payment" and "Move Out".');
    } else {
        console.error('[FAIL] Room status mismatch:', s2.data);
    }

    // --- Scenario 3: Filled and Not Overdue ---
    console.log('\n--- Scenario 3: Filled & Not Overdue ---');
    // Pay for the overdue period + current
    // We need to record a payment that covers until next month.
    const monthFromNow = new Date();
    monthFromNow.setMonth(monthFromNow.getMonth() + 2); // Future date
    
    await axios.post(`${API_URL}/payments/${roomId}`, {
        amount: 500,
        period_start: new Date().toISOString(),
        period_end: monthFromNow.toISOString()
    }, { headers });

    const s3 = await axios.get(`${API_URL}/rooms/${roomId}`, { headers });
    console.log(`Debug: Next Due: ${new Date(s3.data.nextDueDate).toLocaleDateString()}, Overdue: ${s3.data.isOverdue}`);

    if (s3.data.status === 'filled' && !s3.data.isOverdue) {
        console.log('[PASS] Room is Filled and Paid. Frontend should show "Move Out" (Payment hidden unless next month).');
    } else {
        console.error(`[FAIL] Room should not be overdue. Overdue: ${s3.data.isOverdue}`);
    }

    // --- Scenario 4: Verify Fixed Billing Cycle ---
    console.log('\n--- Scenario 4: Fixed Billing Cycle ---');
    
    // Cleanup first
    await axios.post(`${API_URL}/rooms/${roomId}/moveout`, {}, { headers });
    await db.query('DELETE FROM payments WHERE room_id = ?', [roomId]);

    // Tenant moved in on the 15th (simulated)
    // We force occupied_at to a specific day e.g. 2024-01-15
    const fixedMoveIn = new Date();
    fixedMoveIn.setDate(15);
    fixedMoveIn.setMonth(fixedMoveIn.getMonth() - 2); // 2 months ago, 15th
    
    await axios.post(`${API_URL}/rooms/${roomId}/tenant`, {
        tenant_name: 'Cycle User',
        tenant_id_number: 'C999',
        tenant_phone: '555-9999',
        occupied_at: fixedMoveIn.toISOString().split('T')[0]
    }, { headers });

    // Record a payment that ends on the 20th (Drifted date)
    const driftedEnd = new Date(fixedMoveIn);
    driftedEnd.setMonth(driftedEnd.getMonth() + 1);
    driftedEnd.setDate(20); // Ends on 20th, distinct from 15th

    await axios.post(`${API_URL}/payments/${roomId}`, {
        amount: 500,
        period_start: fixedMoveIn.toISOString(),
        period_end: driftedEnd.toISOString()
    }, { headers });

    const s4 = await axios.get(`${API_URL}/rooms/${roomId}`, { headers });
    const nextDue = new Date(s4.data.nextDueDate);
    
    console.log(`Debug: Occupied: 15th. Paid Until: 20th. Next Due: ${nextDue.getDate()}th`);
    
    if (nextDue.getDate() === 15) {
        console.log('[PASS] Next Due Date snapped back to the 15th (Occupied Day).');
    } else {
        console.error(`[FAIL] Next Due Date drifted! Got ${nextDue.getDate()}th, expected 15th.`);
    }

    console.log('\n--- Verification Complete ---');

  } catch (error) {
    console.error('Verification Error:', error.response ? error.response.data : error.message);
  }
}

runScenarios();
