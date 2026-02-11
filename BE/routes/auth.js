const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Username and password required');

  try {
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = users[0];

    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Verify Token Endpoint
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Create User (Super Admin only)
router.post('/register', authenticateToken, requireRole('superadmin'), async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).send('Username and password required');

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'user'; // Default to 'user'

    await db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 
      [username, hashedPassword, userRole]);
    
    res.status(201).send('User created successfully');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).send('Username already exists');
    }
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Get All Users (Super Admin Only)
router.get('/users', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, username, role FROM users');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Admin Reset Password (Super Admin Only)
router.put('/users/:id/password', authenticateToken, requireRole('superadmin'), async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).send('New password required');

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.params.id]);
        res.send('Password reset successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
