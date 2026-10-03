const express = require('express');
const { body, param, validationResult } = require('express-validator');

const { requireAuth } = require('../middleware/auth');
const { findProductById } = require('../models/productModel');
const {
  createReview,
  findReviewByUserAndProduct,
  findReviewsByProduct,
  getProductRatingSummary,
  updateReview,
  deleteReview,
  findReviewById,
  formatReview,
} = require('../models/reviewModel');

const router = express.Router();

router.get(
  '/products/:productId/reviews',
  [param('productId').isInt().withMessage('Invalid product id.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { productId } = req.params;
      const product = await findProductById(productId);
      if (!product) return res.status(404).json({ error: 'Product not found.' });

      const reviews = await findReviewsByProduct(productId);
      const summary = await getProductRatingSummary(productId);

      res.json({ summary, reviews: reviews.map(formatReview) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/products/:productId/reviews',
  requireAuth,
  [
    param('productId').isInt().withMessage('Invalid product id.'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
    body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment is too long.'),
    body('imageUrl').optional().isURL().withMessage('Invalid image URL.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { productId } = req.params;
      const { rating, comment, imageUrl } = req.body;
      const userId = req.user.id;

      const product = await findProductById(productId);
      if (!product) return res.status(404).json({ error: 'Product not found.' });

      const existing = await findReviewByUserAndProduct(productId, userId);
      if (existing) return res.status(409).json({ error: 'You have already reviewed this product.' });

      const review = await createReview({ productId, userId, rating, comment, imageUrl });
      res.status(201).json({ review: formatReview(review) });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/reviews/:id',
  requireAuth,
  [
    param('id').isInt().withMessage('Invalid review id.'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
    body('comment').optional().trim().isLength({ max: 1000 }).withMessage('Comment is too long.'),
    body('imageUrl').optional().isURL().withMessage('Invalid image URL.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { id } = req.params;
      const { rating, comment, imageUrl } = req.body;
      const userId = req.user.id;

      const existing = await findReviewById(id);
      if (!existing) return res.status(404).json({ error: 'Review not found.' });
      if (existing.user_id !== userId) return res.status(403).json({ error: 'You can only edit your own review.' });

      const updated = await updateReview(id, userId, { rating, comment, imageUrl });
      res.json({ review: formatReview(updated) });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/reviews/:id',
  requireAuth,
  [param('id').isInt().withMessage('Invalid review id.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { id } = req.params;
      const userId = req.user.id;

      const existing = await findReviewById(id);
      if (!existing) return res.status(404).json({ error: 'Review not found.' });
      if (existing.user_id !== userId) return res.status(403).json({ error: 'You can only delete your own review.' });

      await deleteReview(id, userId);
      res.json({ message: 'Review deleted.' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;