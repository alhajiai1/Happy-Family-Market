const bcrypt = require('bcryptjs');
const { run, get } = require('../config/db');

async function createUser({ name, email, password, role, verificationCode, verificationExpires }) {
  const hashed = await bcrypt.hash(password, 12);
  const result = await run(
    `INSERT INTO users (name, email, password, role, verification_code, verification_code_expires, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING id`,
    [name, email, hashed, role || 'buyer', verificationCode, verificationExpires]
  );
  return findUserById(result.id);
}

async function createGoogleUser({ name, email, googleId, role }) {
  const result = await run(
    `INSERT INTO users (name, email, google_id, role, is_verified) VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [name, email, googleId, role || 'buyer']
  );
  return findUserById(result.id);
}

function findUserByEmail(email) {
  return get(`SELECT * FROM users WHERE email = $1`, [email]);
}

function findUserByGoogleId(googleId) {
  return get(`SELECT * FROM users WHERE google_id = $1`, [googleId]);
}

function findUserById(id) {
  return get(`SELECT * FROM users WHERE id = $1`, [id]);
}

function comparePassword(candidate, hashed) {
  return bcrypt.compare(candidate, hashed);
}

function setSubaccountCode(userId, code) {
  return run(`UPDATE users SET paystack_subaccount_code = $1 WHERE id = $2`, [code, userId]);
}

function setVerificationCode(userId, code, expires) {
  return run(
    `UPDATE users SET verification_code = $1, verification_code_expires = $2 WHERE id = $3`,
    [code, expires, userId]
  );
}

function markVerified(userId) {
  return run(
    `UPDATE users SET is_verified = true, verification_code = NULL, verification_code_expires = NULL WHERE id = $1`,
    [userId]
  );
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, isVerified: !!user.is_verified };
}

module.exports = {
  createUser,
  createGoogleUser,
  findUserByEmail,
  findUserByGoogleId,
  findUserById,
  comparePassword,
  setSubaccountCode,
  setVerificationCode,
  markVerified,
  publicUser,
};