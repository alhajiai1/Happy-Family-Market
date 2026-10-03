const express = require('express');
const { all } = require('../config/db');
const {
  findOrdersByBuyer,
  findOrdersForSeller,
  findOrderById,
  getStatusHistory,
  advanceOrderStatus,
  ORDER_STAGES,
} = require('../models/orderModel');
const { findUserById } = require('../models/userModel');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendOrderStatusEmail } = require('../utils/email');

const router = express.Router();

async function attachItems(order) {
  order.items = await all(`SELECT * FROM order_items WHERE order_id = $1`, [order.id]);
  return order;
}

function formatOrder(o) {
  return {
    id: o.id,
    totalAmountGHS: Number(o.total_amount_ghs),
    status: o.status,
    reference: o.paystack_reference,
    createdAt: o.created_at,
    items: o.items.map((i) => ({
      title: i.title,
      price: Number(i.price),
      quantity: i.quantity,
    })),
  };
}

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const orders = await findOrdersByBuyer(req.user.id);
    for (const order of orders) await attachItems(order);
    res.json(orders.map(formatOrder));
  } catch (err) {
    next(err);
  }
});

router.get('/selling', requireAuth, requireRole('seller'), async (req, res, next) => {
  try {
    const orders = await findOrdersForSeller(req.user.id);
    for (const order of orders) await attachItems(order);
    res.json(orders.map(formatOrder));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/track', requireAuth, async (req, res, next) => {
  try {
    const order = await findOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    await attachItems(order);

    const isBuyer = order.buyer_id === req.user.id;
    const isSeller = order.items.some((i) => i.seller_id === req.user.id);
    if (!isBuyer && !isSeller) {
      return res.status(403).json({ error: 'You are not part of this order.' });
    }

    const history = await getStatusHistory(order.id);

    res.json({
      ...formatOrder(order),
      history: history.map((h) => ({ status: h.status, note: h.note, at: h.created_at })),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requireAuth, requireRole('seller'), async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!ORDER_STAGES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${ORDER_STAGES.join(', ')}` });
    }

    const order = await findOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    await attachItems(order);
    const isSeller = order.items.some((i) => i.seller_id === req.user.id);
    if (!isSeller) return res.status(403).json({ error: 'You did not sell anything in this order.' });

    if (order.status === 'pending') {
      return res.status(400).json({ error: 'This order has not been paid for yet.' });
    }

    const updated = await advanceOrderStatus(order.id, status, note);

    // Email the buyer about this status change — don't let email failures
    // block the actual status update from succeeding.
    try {
      const buyer = await findUserById(order.buyer_id);
      const trackingUrl = `${process.env.FRONTEND_URL || ''}/orders/${order.id}/track`;
      await sendOrderStatusEmail(buyer.email, buyer.name, order.id, status, trackingUrl);
    } catch (emailErr) {
      console.error('Order status email failed to send:', emailErr.message);
    }

    res.json({ success: true, status: updated.status });
  } catch (err) {
    next(err);
  }
});

module.exports = router;