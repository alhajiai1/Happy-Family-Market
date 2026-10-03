require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const orderRoutes = require('./routes/orderRoutes');

require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

['JWT_SECRET', 'PAYSTACK_SECRET_KEY'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

const app = express();

console.log('CORS_ORIGIN raw value:', JSON.stringify(process.env.CORS_ORIGIN));
console.log('FRONTEND_URL raw value:', JSON.stringify(process.env.FRONTEND_URL));

app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || '').split(',').filter(Boolean),
    credentials: true,
  })
);
app.use(morgan('dev'));

app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10kb' }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));