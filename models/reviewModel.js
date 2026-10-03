const { run, get, all } = require('../config/db');

function createReview({ productId, userId, rating, comment, imageUrl }) {
  return run(
    `INSERT INTO reviews (product_id, user_id, rating, comment, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [productId, userId, rating, comment || null, imageUrl || null]
  ).then((result) => findReviewById(result.id));
}

function findReviewById(id) {
  return get(`SELECT * FROM reviews WHERE id = $1`, [id]);
}

function findReviewByUserAndProduct(productId, userId) {
  return get(`SELECT * FROM reviews WHERE product_id = $1 AND user_id = $2`, [productId, userId]);
}

function findReviewsByProduct(productId) {
  return all(
    `SELECT reviews.*, users.name AS reviewer_name
     FROM reviews
     JOIN users ON users.id = reviews.user_id
     WHERE product_id = $1
     ORDER BY created_at DESC`,
    [productId]
  );
}

async function getProductRatingSummary(productId) {
  const row = await get(
    `SELECT COUNT(*) AS review_count, AVG(rating) AS average_rating
     FROM reviews WHERE product_id = $1`,
    [productId]
  );
  return {
    reviewCount: Number(row.review_count) || 0,
    averageRating: row.average_rating ? Math.round(Number(row.average_rating) * 10) / 10 : null,
  };
}

function updateReview(id, userId, { rating, comment, imageUrl }) {
  return run(
    `UPDATE reviews SET rating = $1, comment = $2, image_url = $3 WHERE id = $4 AND user_id = $5`,
    [rating, comment || null, imageUrl || null, id, userId]
  ).then(() => findReviewById(id));
}

function deleteReview(id, userId) {
  return run(`DELETE FROM reviews WHERE id = $1 AND user_id = $2`, [id, userId]);
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