const { run, get, all, pool } = require('../config/db');

async function createProduct({ title, description, price, stock, category, imageUrl, sellerId }) {
  const result = await pool.query(
    `INSERT INTO products (title, description, price, stock, category, image_url, seller_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [title, description, price, stock, category || 'General', imageUrl || '', sellerId]
  );
  return findProductById(result.rows[0].id);
}

function findProducts({ search, category } = {}) {
  let sql = `SELECT * FROM products WHERE 1=1`;
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length})`;
  }
  if (category) {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }
  sql += ` ORDER BY created_at DESC LIMIT 100`;
  return all(sql, params);
}

function findProductById(id) {
  return get(`SELECT * FROM products WHERE id = $1`, [id]);
}

function findProductsBySeller(sellerId) {
  return all(`SELECT * FROM products WHERE seller_id = $1 ORDER BY created_at DESC`, [sellerId]);
}

async function updateProduct(id, sellerId, fields) {
  const existing = await get(`SELECT * FROM products WHERE id = $1 AND seller_id = $2`, [id, sellerId]);
  if (!existing) return null;

  const merged = { ...existing, ...fields };
  await run(
    `UPDATE products SET title = $1, description = $2, price = $3, stock = $4, category = $5, image_url = $6
     WHERE id = $7 AND seller_id = $8`,
    [merged.title, merged.description, merged.price, merged.stock, merged.category, merged.image_url || merged.imageUrl, id, sellerId]
  );
  return findProductById(id);
}

function deleteProduct(id, sellerId) {
  return run(`DELETE FROM products WHERE id = $1 AND seller_id = $2`, [id, sellerId]);
}

function decrementStock(id, quantity) {
  return run(`UPDATE products SET stock = stock - $1 WHERE id = $2`, [quantity, id]);
}

function formatProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: Number(p.price),
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