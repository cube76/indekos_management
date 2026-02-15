const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { initDB } = require('./database');
const router = require('express').Router();
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const app = express();
const PORT = process.env.PORT || 3693; // Changed default to 3693 as verified

app.use(cors());
app.use(express.json());

// Initialize Database
initDB();           

// Routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const paymentRoutes = require('./routes/payments');
const { startReminders } = require('./cron/reminders');

app.use('/auth', authRoutes);
app.use('/rooms', roomRoutes);
app.use('/buildings', require('./routes/buildings'));
app.use('/payments', paymentRoutes);
app.use('/notifications', require('./routes/notifications'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Start Cron Jobs
startReminders();

app.get('/', (req, res) => {
  res.send('Residence API is running');
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Server Time: ${new Date().toString()}`);
});
