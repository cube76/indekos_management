const axios = require('axios');
const assert = require('assert');

const util = require('util');
require('dotenv').config({ path: '../.env' });
const API_URL = process.env.URL_BASE;
const SUPER_ADMIN = { username: 'admin', password: 'equali' };
const NEW_USER = { username: 'testuser', password: 'password123' };

async function verify() {
  try {
    console.log('Starting verification...');

    // 1. Login as Super Admin
    console.log('Logging in as Super Admin...');
    let res = await axios.post(`${API_URL}/auth/login`, SUPER_ADMIN);
    const adminToken = res.data.accessToken;
    assert(adminToken, 'Admin token missing');
    console.log('Super Admin logged in.');

    // 2. Create a new user
    console.log('Creating new user...');
    try {
      await axios.post(`${API_URL}/auth/register`, { ...NEW_USER, role: 'user' }, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('New user created.');
    } catch (e) {
      if (e.response && e.response.status === 409) {
        console.log('User already exists, continuing...');
      } else {
        throw e;
      }
    }

    // 3. Login as new user
    console.log('Logging in as New User...');
    res = await axios.post(`${API_URL}/auth/login`, NEW_USER);
    const userToken = res.data.accessToken;
    assert(userToken, 'User token missing');
    console.log('New user logged in.');

    // 4. Create a room (as Admin)
    console.log('Creating a room (as Admin)...');
    const roomData = { 
      room_number: '101', 
      building_name: 'Block A', 
      price: 1500, 
      status: 'filled', 
      tenant_name: 'John Doe', 
      tenant_id_number: 'A1234567',
      tenant_phone: '1234567890',
      occupied_at: new Date('2024-02-12').toISOString() // Occupied on 12 Feb
    };
    try {
      await axios.post(`${API_URL}/rooms`, roomData, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('Room created.');
    } catch (e) {
       console.log('Error creating room:', e.response ? e.response.data : e.message);
       throw e; // Fail if room creation fails
    }

    // 5. List rooms (as New User)
    console.log('Listing rooms (as New User)...');
    res = await axios.get(`${API_URL}/rooms`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    // Find the room we just created
    const createdRoom = res.data.find(r => r.room_number === '101');
    assert(createdRoom, 'Room 101 should exist');
    console.log('Room found in list.');

    // Verify Sorting (Manual check msg)
    console.log('Rooms are returned (check if sorted by building):', res.data.map(r => `${r.building_name} - ${r.room_number}`));

    // 5b. Get Room Details
    console.log('Fetching Room Details...');
    res = await axios.get(`${API_URL}/rooms/${createdRoom.id}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(res.data.id === createdRoom.id, 'Detailed room ID mismatch');
    assert(res.data.room_number === '101', 'Detailed room number mismatch');
    console.log('Room details verified:', res.data);

    // 6. Check Payment Status (Should be Overdue/Due since occupied Feb 12 and now is 2026!)
    console.log('Checking Payment Status...');
    res = await axios.get(`${API_URL}/payments/${createdRoom.id}/status`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    console.log('Status:', res.data);
    
    // 7. Make a Payment
    console.log('Making a Payment...');
    const paymentData = {
      amount: 1500,
      period_start: '2024-02-12',
      period_end: '2024-03-12'
    };
    await axios.post(`${API_URL}/payments/${createdRoom.id}`, paymentData, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Payment recorded.');

    // 8. Check Payment History
    console.log('Checking Payment History...');
    res = await axios.get(`${API_URL}/payments/${createdRoom.id}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(res.data.length === 1, 'Should have 1 payment');
    console.log('Payment history verified.');

    console.log('Verification SUCCESS!');
  } catch (error) {
    console.error('Verification FAILED:', error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

// Wait for server to be ready
setTimeout(verify, 3000);
