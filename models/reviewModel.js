const { run, get, all } = require('../config/db');

function createReview({ productId, userId, rating, comment, imageUrl }) {
  return run(
    `INSERT INTO reviews (product_id, user_id, rating, comment, image_url) VALUES (?, ?, ?, ?, ?)`,
    [productId, userId, rating, comment || null, imageUrl || null]
  ).then((result) => findReviewById(result.id));
}

function findReviewById(id) {
  return get(`SELECT * FROM reviews WHERE id = ?`, [id]);
}

function findReviewByUserAndProduct(productId, userId) {
  return get(`SELECT * FROM reviews WHERE product_id = ? AND user_id = ?`, [productId, userId]);
}

function findReviewsByProduct(productId) {
  return all(
    `SELECT reviews.*, users.name AS reviewer_name
     FROM reviews
     JOIN users ON users.id = reviews.user_id
     WHERE product_id = ?
     ORDER BY created_at DESC`,
    [productId]
  );
}

async function getProductRatingSummary(productId) {
  const row = await get(
    `SELECT COUNT(*) AS review_count, AVG(rating) AS average_rating
     FROM reviews WHERE product_id = ?`,
    [productId]
  );
  return {
    reviewCount: row.review_count || 0,
    averageRating: row.average_rating ? Math.round(row.average_rating * 10) / 10 : null,
  };
}

function updateReview(id, userId, { rating, comment, imageUrl }) {
  return run(
    `UPDATE reviews SET rating = ?, comment = ?, image_url = ? WHERE id = ? AND user_id = ?`,
    [rating, comment || null, imageUrl || null, id, userId]
  ).then(() => findReviewById(id));
}

function deleteReview(id, userId) {
  return run(`DELETE FROM reviews WHERE id = ? AND user_id = ?`, [id, userId]);
}

function formatReview(r) {
  if (!r) return null;
  return {
    id: r.id,
    productId: r.product_id,
    userId: r.user_id,
    reviewerName: r.reviewer_name,
    rating: r.rating,
    comment: r.comment,
    imageUrl: r.image_url,
    createdAt: r.created_at,
  };
}

module.exports = {
  createReview,
  findReviewById,
  findReviewByUserAndProduct,
  findReviewsByProduct,
  getProductRatingSummary,
  updateReview,
  deleteReview,
  formatReview,
};