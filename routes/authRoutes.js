const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const {
  createUser,
  createGoogleUser,
  findUserByEmail,
  findUserByGoogleId,
  comparePassword,
  publicUser,
  setVerificationCode,
  markVerified,
} = require('../models/userModel');
const { requireAuth } = require('../middleware/auth');
const { verifyGoogleToken } = require('../utils/googleAuth');
const { generateVerificationCode, sendVerificationEmail } = require('../utils/email');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  });
}

function codeExpiryTimestamp() {
  return new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes from now
}

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('role').optional().isIn(['buyer', 'seller']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { name, email, password, role } = req.body;
      const existing = await findUserByEmail(email);
      if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

      const code = generateVerificationCode();
      const expires = codeExpiryTimestamp();

      const user = await createUser({
        name, email, password, role,
        verificationCode: code,
        verificationExpires: expires,
      });

      await sendVerificationEmail(email, name, code);

      // No token yet — they must verify first.
      res.status(201).json({
        message: 'Account created. Check your email for a verification code.',
        email: user.email,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/verify-email',
  [
    body('email').isEmail().normalizeEmail(),
    body('code').trim().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Email and code are required.' });

      const { email, code } = req.body;
      const user = await findUserByEmail(email);
      if (!user) return res.status(404).json({ error: 'No account found with this email.' });

      if (user.is_verified) {
        return res.status(400).json({ error: 'This account is already verified.' });
      }
      if (!user.verification_code || user.verification_code !== code) {
        return res.status(400).json({ error: 'Incorrect verification code.' });
      }
      if (new Date(user.verification_code_expires) < new Date()) {
        return res.status(400).json({ error: 'This code has expired. Request a new one.' });
      }

      await markVerified(user.id);
      const token = signToken(user);

      res.json({ token, user: publicUser({ ...user, is_verified: 1 }) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/resend-verification',
  [body('email').isEmail().normalizeEmail()],
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const user = await findUserByEmail(email);
      if (!user) return res.status(404).json({ error: 'No account found with this email.' });
      if (user.is_verified) return res.status(400).json({ error: 'This account is already verified.' });

      const code = generateVerificationCode();
      const expires = codeExpiryTimestamp();
      await setVerificationCode(user.id, code, expires);
      await sendVerificationEmail(email, user.name, code);

      res.json({ message: 'A new code has been sent.' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/login',
  loginLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid email or password.' });

      const { email, password } = req.body;
      const user = await findUserByEmail(email);
      if (!user || !user.password || !(await comparePassword(password, user.password))) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      if (!user.is_verified) {
        return res.status(403).json({ error: 'Please verify your email before logging in.', needsVerification: true });
      }

      const token = signToken(user);
      res.json({ token, user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/google', async (req, res, next) => {
  try {
    const { credential, role } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential.' });

    const { googleId, email, name } = await verifyGoogleToken(credential);

    let user = await findUserByGoogleId(googleId);

    if (!user) {
      const existingByEmail = await findUserByEmail(email);
      if (existingByEmail) {
        return res.status(409).json({
          error: 'An account with this email already exists. Log in with your password instead.',
        });
      }
      user = await createGoogleUser({ name, email, googleId, role });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user));
});

module.exports = router;