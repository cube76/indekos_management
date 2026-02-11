const bcrypt = require('bcryptjs');

async function test() {
    const password = 'Password123';
    const hash = await bcrypt.hash(password, 10);
    console.log('Password:', password);
    console.log('Hash:', hash);

    const check1 = await bcrypt.compare('Password123', hash);
    console.log(`Compare 'Password123': ${check1}`); // Should be true

    const check2 = await bcrypt.compare('password123', hash);
    console.log(`Compare 'password123': ${check2}`); // Should be false
}

test();
