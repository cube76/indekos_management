const webpush = require('web-push');
require('dotenv').config({ path: '../.env' });

console.log('Testing VAPID Keys...');

try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_EMAIL;

    console.log(`Public Key: ${publicKey ? 'Present' : 'Missing'}`);
    console.log(`Private Key: ${privateKey ? 'Present' : 'Missing'}`);
    console.log(`Email: ${email}`);

    webpush.setVapidDetails(email, publicKey, privateKey);
    console.log('VAPID Details Set Successfully.');

} catch (error) {
    console.error('VAPID Setup Error:', error.message);
}
