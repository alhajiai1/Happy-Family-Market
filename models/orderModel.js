const { run, get, all } = require('../config/db');

async function createOrder({ buyerId, totalAmountGHS, reference, items }) {
  const orderResult = await run(
    `INSERT INTO orders (buyer_id, total_amount_ghs, paystack_reference, status) VALUES (?, ?, ?, 'pending')`,
    [buyerId, totalAmountGHS, reference]
  );

  for (const item of items) {
    await run(
      `INSERT INTO order_items (order_id, product_id, seller_id, title, price, quantity) VALUES (?, ?, ?, ?, ?, ?)`,
      [orderResult.id, item.productId, item.sellerId, item.title, item.price, item.quantity]
    );
  }

  return findOrderByReference(reference);
}

async function findOrderByReference(reference) {
  const order = await get(`SELECT * FROM orders WHERE paystack_reference = ?`, [reference]);
  if (!order) return null;
  order.items = await all(`SELECT * FROM order_items WHERE order_id = ?`, [order.id]);
  return order;
}

function markOrderPaid(orderId) {
  return run(`UPDATE orders SET status = 'paid' WHERE id = ?`, [orderId]);
}

module.exports = { createOrder, findOrderByReference, markOrderPaid };