const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const { setSubaccountCode } = require('../models/userModel');
const { createSubaccount } = require('../utils/paystack');

const router = express.Router();

router.post(
  '/bank-details',
  requireAuth,
  requireRole('seller'),
  [
    body('businessName').trim().notEmpty(),
    body('bankCode').trim().notEmpty(),
    body('accountNumber').trim().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const commission = Number(process.env.PLATFORM_COMMISSION_PERCENT || 10);
      const subaccount = await createSubaccount({
        businessName: req.body.businessName,
        bankCode: req.body.bankCode,
        accountNumber: req.body.accountNumber,
        percentageCharge: commission,
      });

      await setSubaccountCode(req.user.id, subaccount.subaccount_code);

      res.json({ success: true, subaccountCode: subaccount.subaccount_code });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;