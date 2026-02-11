const express = require('express');
const { db } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Get All Buildings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [buildings] = await db.query('SELECT * FROM buildings ORDER BY name ASC');
    res.json(buildings);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Create Building (Super Admin)
router.post('/', authenticateToken, requireRole('superadmin'), upload.single('logo'), async (req, res) => {
    const { name, address } = req.body;
    if (!name) return res.status(400).send('Building name is required');

    const logoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        await db.query('INSERT INTO buildings (name, address, logo_url) VALUES (?, ?, ?)', 
            [name, address, logoUrl]);
        res.status(201).send('Building created successfully');
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).send('Building name already exists');
        }
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Update Building (Super Admin)
router.put('/:id', authenticateToken, requireRole('superadmin'), upload.single('logo'), async (req, res) => {
    const { name, address } = req.body;
    const buildingId = req.params.id;

    try {
        // Get existing building to handle logo replacement
        const [existing] = await db.query('SELECT * FROM buildings WHERE id = ?', [buildingId]);
        if (existing.length === 0) return res.status(404).send('Building not found');

        let logoUrl = existing[0].logo_url;

        // If new file uploaded
        if (req.file) {
            logoUrl = `/uploads/${req.file.filename}`;
            
            // Optional: Delete old logo if it exists
            if (existing[0].logo_url) {
                const oldPath = path.join(__dirname, '../public', existing[0].logo_url);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        // Update DB
        // Only update fields if they are provided, or keep existing (simple logic: update all passed)
        // However, name is required if we are doing a full update-like form.
        const newName = name || existing[0].name;
        const newAddress = address !== undefined ? address : existing[0].address;

        await db.query('UPDATE buildings SET name = ?, address = ?, logo_url = ? WHERE id = ?', 
            [newName, newAddress, logoUrl, buildingId]);

        res.send('Building updated successfully');

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Delete Building (Super Admin)
router.delete('/:id', authenticateToken, requireRole('superadmin'), async (req, res) => {
    try {
        // Check if rooms exist
        const [rooms] = await db.query('SELECT COUNT(*) as count FROM rooms WHERE building_id = ?', [req.params.id]);
        if (rooms[0].count > 0) {
            return res.status(400).send('Cannot delete building with existing rooms. Move rooms first.');
        }

        const [building] = await db.query('SELECT * FROM buildings WHERE id = ?', [req.params.id]);
        if (building.length === 0) return res.status(404).send('Building not found');

        // Delete Logo file
        if (building[0].logo_url) {
            const oldPath = path.join(__dirname, '../public', building[0].logo_url);
             if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        await db.query('DELETE FROM buildings WHERE id = ?', [req.params.id]);
        res.send('Building deleted successfully');

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
