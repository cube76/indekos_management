const { checkOverdueAndNotify } = require('./cron/reminders');
const { db } = require('../database');
const reminders = require('../cron/reminders');
const axios = require('axios');
require('dotenv').config({ path: '../.env' });

// MOCK WhatsApp Service to capture output
const whatsappService = require('./services/whatsapp');
const originalSend = whatsappService.sendWhatsAppMessage;
let messageSent = false;

whatsappService.sendWhatsAppMessage = async (phone, message) => {
    console.log(`[MOCK WA] To: ${phone}, Msg: ${message}`);
    messageSent = true;
    return true;
};

async function runCronVerification() {
    console.log('--- Starting Cron Verification ---');
    try {
        const API_URL = 'http://localhost:3693';
        
        // 1. Login
        const login = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'equali' });
        const token = login.data.accessToken;
        const headers = { Authorization: `Bearer ${token}` };

        // 2. Ensure we have an overdue room (Reuse room 999 from previous test or create new)
        let roomId;
        const allRooms = await axios.get(`${API_URL}/rooms`, { headers });
        const room = allRooms.data.find(r => r.room_number === '999');
        
        if (room) {
            roomId = room.id;
            // Ensure it's overdue: Move out and Move in with old date
            await axios.post(`${API_URL}/rooms/${roomId}/moveout`, {}, { headers });
            
            const twoMonthsAgo = new Date();
            twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
            
            await axios.post(`${API_URL}/rooms/${roomId}/tenant`, {
                tenant_name: 'Cron Test User',
                tenant_id_number: 'C999',
                tenant_phone: '555-CRON',
                occupied_at: twoMonthsAgo.toISOString().split('T')[0]
            }, { headers });
            
            console.log('[SETUP] Room 999 set to overdue state.');
        } else {
             console.log('[SETUP] Room 999 not found, forcing creation...');
             // Create if missing logic here... but verify_scenarios should have created it.
             // Skipped for brevity, assuming verify_scenarios ran.
        }

        // 3. Trigger Cron Logic Manually
        console.log('[ACTION] Triggering checkOverdueAndNotify...');
        await checkOverdueAndNotify();

        // 4. Verify
        if (messageSent) {
            console.log('[PASS] WhatsApp message was triggered for overdue room.');
        } else {
            console.error('[FAIL] No WhatsApp message triggered. Check logic.');
        }

    } catch (e) {
        console.error('Verification Failed:', e.message);
        if(e.response) console.error(e.response.data);
    } finally {
        // Restore
        whatsappService.sendWhatsAppMessage = originalSend;
        process.exit(0);
    }
}

runCronVerification();
