const { run, get, all, pool } = require('../config/db');

// The full lifecycle a real order moves through, in order.
const ORDER_STAGES = ['pending', 'paid', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

async function createOrder({ buyerId, totalAmountGHS, reference, items }) {
  const orderResult = await pool.query(
    `INSERT INTO orders (buyer_id, total_amount_ghs, paystack_reference, status) VALUES ($1, $2, $3, 'pending') RETURNING id`,
    [buyerId, totalAmountGHS, reference]
  );
  const orderId = orderResult.rows[0].id;

  for (const item of items) {
    await pool.query(
      `INSERT INTO order_items (order_id, product_id, seller_id, title, price, quantity) VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, item.productId, item.sellerId, item.title, item.price, item.quantity]
    );
  }

  // Log the very first event in this order's timeline.
  await addStatusEvent(orderId, 'pending', 'Order placed, awaiting payment.');

  return findOrderByReference(reference);
}

async function findOrderByReference(reference) {
  const order = await get(`SELECT * FROM orders WHERE paystack_reference = $1`, [reference]);
  if (!order) return null;
  order.items = await all(`SELECT * FROM order_items WHERE order_id = $1`, [order.id]);
  return order;
}

function findOrderById(id) {
  return get(`SELECT * FROM orders WHERE id = $1`, [id]);
}

function findOrdersByBuyer(buyerId) {
  return all(`SELECT * FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC`, [buyerId]);
}

// Orders that contain at least one item sold by this seller.
function findOrdersForSeller(sellerId) {
  return all(
    `SELECT DISTINCT o.* FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE oi.seller_id = $1
     ORDER BY o.created_at DESC`,
    [sellerId]
  );
}

async function markOrderPaid(orderId) {
  await run(`UPDATE orders SET status = 'paid' WHERE id = $1`, [orderId]);
  await addStatusEvent(orderId, 'paid', 'Payment confirmed.');
}

// Records one step in the order's journey. This is what powers the timeline.
function addStatusEvent(orderId, status, note = null) {
  return run(
    `INSERT INTO order_status_history (order_id, status, note) VALUES ($1, $2, $3)`,
    [orderId, status, note]
  );
}

function getStatusHistory(orderId) {
  return all(
    `SELECT status, note, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC`,
    [orderId]
  );
}

// A seller advances an order to the next real-world stage (processing,
// shipped, out_for_delivery, delivered). Only allowed to move forward,
// never backward or skip the payment step itself.
async function advanceOrderStatus(orderId, newStatus, note) {
  if (!ORDER_STAGES.includes(newStatus)) {
    throw new Error(`"${newStatus}" is not a valid order status.`);
  }
  await run(`UPDATE orders SET status = $1 WHERE id = $2`, [newStatus, orderId]);
  await addStatusEvent(orderId, newStatus, note);
  return findOrderById(orderId);
}

module.exports = {
  ORDER_STAGES,
  createOrder,
  findOrderByReference,
  findOrderById,
  findOrdersByBuyer,
  findOrdersForSeller,
  markOrderPaid,
  addStatusEvent,
  getStatusHistory,
  advanceOrderStatus,
};