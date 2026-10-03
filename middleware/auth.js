const jwt = require('jsonwebtoken');
const { findUserById } = require('../models/userModel');

async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findUserById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User no longer exists.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Only ${role}s can do this.` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };