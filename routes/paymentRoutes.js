const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { findProductById, decrementStock } = require('../models/productModel');
const { findUserById } = require('../models/userModel');
const { createOrder, findOrderByReference, markOrderPaid } = require('../models/orderModel');
const { requireAuth } = require('../middleware/auth');
const {
  initializeSingleSellerTransaction,
  initializeMultiSellerTransaction,
  verifyTransaction,
} = require('../utils/paystack');

const router = express.Router();
const COMMISSION = Number(process.env.PLATFORM_COMMISSION_PERCENT || 10);

router.post(
  '/initiate',
  requireAuth,
  [body('items').isArray({ min: 1 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Cart items are required.' });

      const { items } = req.body;

      let total = 0;
      const orderItems = [];
      const sellerTotals = new Map();

      for (const item of items) {
        const product = await findProductById(item.productId);
        if (!product) return res.status(400).json({ error: 'One of the products no longer exists.' });
        if (product.stock < item.quantity) {
          return res.status(400).json({ error: `Not enough stock for "${product.title}".` });
        }

        const seller = await findUserById(product.seller_id);
        if (!seller.paystack_subaccount_code) {
          return res.status(400).json({ error: `Seller for "${product.title}" hasn't set up payouts yet.` });
        }

        const lineTotal = product.price * item.quantity;
        total += lineTotal;
        orderItems.push({
          productId: product.id,
          sellerId: seller.id,
          title: product.title,
          price: product.price,
          quantity: item.quantity,
        });

        const code = seller.paystack_subaccount_code;
        sellerTotals.set(code, (sellerTotals.get(code) || 0) + lineTotal);
      }

      const reference = `hfm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      await createOrder({ buyerId: req.user.id, totalAmountGHS: total, reference, items: orderItems });

      let paystackData;
      if (sellerTotals.size === 1) {
        const [subaccountCode] = sellerTotals.keys();
        paystackData = await initializeSingleSellerTransaction({
          email: req.user.email,
          amountGHS: total,
          subaccountCode,
          reference,
          callbackUrl: process.env.PAYSTACK_CALLBACK_URL,
        });
      } else {
        const sellerShares = [...sellerTotals.entries()].map(([code, amount]) => ({
          subaccountCode: code,
          percentage: (amount / total) * (100 - COMMISSION),
        }));
        paystackData = await initializeMultiSellerTransaction({
          email: req.user.email,
          amountGHS: total,
          sellerShares,
          reference,
          callbackUrl: process.env.PAYSTACK_CALLBACK_URL,
        });
      }

      res.json({ authorizationUrl: paystackData.authorization_url, reference });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/verify/:reference', requireAuth, async (req, res, next) => {
  try {
    const order = await findOrderByReference(req.params.reference);
    if (!order || order.buyer_id !== req.user.id) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status === 'paid') return res.json({ status: 'success', order });

    const verified = await verifyTransaction(req.params.reference);
    if (verified.status === 'success') {
      await finalizeOrder(order);
      return res.json({ status: 'success', order });
    }

    res.json({ status: 'failed', order });
  } catch (err) {
    next(err);
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const expected = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest('hex');

  if (signature !== expected) return res.status(401).send('Invalid signature');

  const event = JSON.parse(req.body);
  if (event.event === 'charge.success') {
    const order = await findOrderByReference(event.data.reference);
    if (order && order.status !== 'paid') await finalizeOrder(order);
  }

  res.sendStatus(200);
});

async function finalizeOrder(order) {
  await markOrderPaid(order.id);
  for (const item of order.items) {
    await decrementStock(item.product_id, item.quantity);
  }
}

module.exports = router;