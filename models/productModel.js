const { run, get, all } = require('../config/db');

function createProduct({ title, description, price, stock, category, imageUrl, sellerId }) {
  return run(
    `INSERT INTO products (title, description, price, stock, category, image_url, seller_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, description, price, stock, category || 'General', imageUrl || '', sellerId]
  ).then((result) => findProductById(result.id));
}

function findProducts({ search, category } = {}) {
  let sql = `SELECT * FROM products WHERE 1=1`;
  const params = [];
  if (search) {
    sql += ` AND (title LIKE ? OR description LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    sql += ` AND category = ?`;
    params.push(category);
  }
  sql += ` ORDER BY created_at DESC LIMIT 100`;
  return all(sql, params);
}

function findProductById(id) {
  return get(`SELECT * FROM products WHERE id = ?`, [id]);
}

function findProductsBySeller(sellerId) {
  return all(`SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC`, [sellerId]);
}

async function updateProduct(id, sellerId, fields) {
  const existing = await get(`SELECT * FROM products WHERE id = ? AND seller_id = ?`, [id, sellerId]);
  if (!existing) return null;

  const merged = { ...existing, ...fields };
  await run(
    `UPDATE products SET title = ?, description = ?, price = ?, stock = ?, category = ?, image_url = ?
     WHERE id = ? AND seller_id = ?`,
    [merged.title, merged.description, merged.price, merged.stock, merged.category, merged.image_url || merged.imageUrl, id, sellerId]
  );
  return findProductById(id);
}

function deleteProduct(id, sellerId) {
  return run(`DELETE FROM products WHERE id = ? AND seller_id = ?`, [id, sellerId]);
}

function decrementStock(id, quantity) {
  return run(`UPDATE products SET stock = stock - ? WHERE id = ?`, [quantity, id]);
}

function formatProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.price,
    stock: p.stock,
    category: p.category,
    imageUrl: p.image_url,
    sellerId: p.seller_id,
  };
}

module.exports = {
  createProduct,
  findProducts,
  findProductById,
  findProductsBySeller,
  updateProduct,
  deleteProduct,
  decrementStock,
  formatProduct,
};