const cron = require('node-cron');
const { db } = require('../database');
const whatsappService = require('../services/whatsapp'); // Kept for reference or dual-use
const webpush = require('web-push');
const { calculateNextDueDate } = require('../utils/date');
require('dotenv').config();

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const checkOverdueAndNotify = async (isManual = false) => {
    console.log(`Running payment reminder job (Manual: ${isManual})...`);
    try {
      // 1. Get all filled rooms
      const [rooms] = await db.query("SELECT * FROM rooms WHERE status = 'filled'");
      
      const overdueRooms = [];
      const dueSoonRooms = [];

      for (const room of rooms) {
        // 2. Determine Next Due Date
        const [lastPayment] = await db.query(
          'SELECT period_end FROM payments WHERE room_id = ? ORDER BY period_end DESC LIMIT 1',
          [room.id]
        );

        let nextDueDate;
        const occupied = new Date(room.occupied_at);
        
        if (lastPayment.length > 0) {
           nextDueDate = calculateNextDueDate(occupied, new Date(lastPayment[0].period_end));
        } else {
           nextDueDate = occupied;
        }

        const today = new Date();
        const todayMidnight = new Date(today);
        todayMidnight.setHours(0, 0, 0, 0);

        const nextDueDateMidnight = new Date(nextDueDate);
        nextDueDateMidnight.setHours(0, 0, 0, 0);

        const diffTime = nextDueDateMidnight - todayMidnight;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        // 3. Check Status
        if (today > nextDueDate) {
          overdueRooms.push({
            room: room.room_number,
            tenant: room.tenant_name
          });
        } else {
            // Logic:
            // - Manual trigger: Notify for anything due within 7 days (diffDays <= 7 AND > 0)
            // - Cron trigger: Notify ONLY exactly 7 days before (diffDays === 7)
            const shouldNotifyDueSoon = isManual 
                ? (diffDays <= 7 && diffDays > 0)
                : (diffDays === 7);

            if (shouldNotifyDueSoon) {
                // Notify
                dueSoonRooms.push({
                    room: room.room_number,
                    tenant: room.tenant_name
                });
            }
        }
      }

    // 4. Send Notification (VAPID)
      if (overdueRooms.length > 0 || dueSoonRooms.length > 0) {
        let bodyText = '';
        if (dueSoonRooms.length > 0) bodyText += `${dueSoonRooms.length} rooms due soon. `;
        if (overdueRooms.length > 0) bodyText += `${overdueRooms.length} rooms OVERDUE!`;

        const messagePayload = JSON.stringify({
            title: 'Indekos Manager',
            body: bodyText,
            icon: '/logo.svg'
        });

        // Get all subscriptions
        const [subscriptions] = await db.query('SELECT * FROM push_subscriptions');
        
        subscriptions.forEach(sub => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.keys_p256dh,
                    auth: sub.keys_auth
                }
            };

            webpush.sendNotification(pushSubscription, messagePayload)
                .catch(err => {
                    console.error('Error sending notification to', sub.id, err);
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        // Subscription has expired or is no longer valid
                        db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                        console.log('Deleted invalid subscription:', sub.id);
                    }
                });
        });
        console.log(`Sent notification: ${bodyText}`);

      } else {
        console.log('No overdue or due soon rooms found.');
      }

    } catch (error) {
      console.error('Error in reminder job:', error);
    }
};

function startReminders() {
  // Run every day at 09:00 AM
  cron.schedule('0 9 * * *', checkOverdueAndNotify, {
    scheduled: true,
    timezone: "Asia/Jakarta"
  });
  console.log('Payment reminder cron job scheduled.');
}

module.exports = { startReminders, checkOverdueAndNotify };
