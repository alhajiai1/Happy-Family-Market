const express = require('express');
const { body, validationResult } = require('express-validator');
const {
  createProduct,
  findProducts,
  findProductById,
  findProductsBySeller,
  updateProduct,
  deleteProduct,
  addProductImages,
  findProductImages,
  deleteProductImage,
  formatProduct,
  formatProductImage,
} = require('../models/productModel');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const products = await findProducts({ search, category });
    res.json(products.map(formatProduct));
  } catch (err) {
    next(err);
  }
});

router.get('/mine', requireAuth, requireRole('seller'), async (req, res, next) => {
  try {
    const products = await findProductsBySeller(req.user.id);
    res.json(products.map(formatProduct));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const images = await findProductImages(req.params.id);
    res.json({ ...formatProduct(product), images: images.map(formatProductImage) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requireAuth,
  requireRole('seller'),
  [
    body('title').trim().notEmpty(),
    body('description').trim().notEmpty(),
    body('price').isFloat({ min: 0 }),
    body('stock').isInt({ min: 0 }),
    body('images').optional().isArray({ max: 8 }).withMessage('You can add up to 8 images.'),
    body('images.*').optional().isURL().withMessage('Each image must be a valid URL.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      if (!req.user.paystack_subaccount_code) {
        return res.status(400).json({ error: 'Add your payout bank details before listing products.' });
      }

      const { images, ...productFields } = req.body;
      const primaryImage = images && images.length > 0 ? images[0] : productFields.imageUrl;

      const product = await createProduct({ ...productFields, imageUrl: primaryImage, sellerId: req.user.id });

      let savedImages = [];
      if (images && images.length > 0) {
        savedImages = await addProductImages(product.id, images);
      }

      res.status(201).json({ ...formatProduct(product), images: savedImages.map(formatProductImage) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/images',
  requireAuth,
  requireRole('seller'),
  [
    body('images').isArray({ min: 1, max: 8 }).withMessage('Provide 1 to 8 image URLs.'),
    body('images.*').isURL().withMessage('Each image must be a valid URL.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const product = await findProductById(req.params.id);
      if (!product || product.seller_id !== req.user.id) {
        return res.status(404).json({ error: 'Product not found.' });
      }

      const savedImages = await addProductImages(req.params.id, req.body.images);
      res.status(201).json({ images: savedImages.map(formatProductImage) });
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id/images/:imageId', requireAuth, requireRole('seller'), async (req, res, next) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product || product.seller_id !== req.user.id) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    await deleteProductImage(req.params.imageId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, requireRole('seller'), async (req, res, next) => {
  try {
    const product = await updateProduct(req.params.id, req.user.id, req.body);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json(formatProduct(product));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole('seller'), async (req, res, next) => {
  try {
    const result = await deleteProduct(req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Product not found.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;