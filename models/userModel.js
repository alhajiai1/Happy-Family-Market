const bcrypt = require('bcryptjs');
const { run, get } = require('../config/db');

async function createUser({ name, email, password, role, verificationCode, verificationExpires }) {
  const hashed = await bcrypt.hash(password, 12);
  const result = await run(
    `INSERT INTO users (name, email, password, role, verification_code, verification_code_expires, is_verified)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [name, email, hashed, role || 'buyer', verificationCode, verificationExpires]
  );
  return findUserById(result.id);
}

async function createGoogleUser({ name, email, googleId, role }) {
  // Google already verified this email for us — skip the code step.
  const result = await run(
    `INSERT INTO users (name, email, google_id, role, is_verified) VALUES (?, ?, ?, ?, 1)`,
    [name, email, googleId, role || 'buyer']
  );
  return findUserById(result.id);
}

function findUserByEmail(email) {
  return get(`SELECT * FROM users WHERE email = ?`, [email]);
}

function findUserByGoogleId(googleId) {
  return get(`SELECT * FROM users WHERE google_id = ?`, [googleId]);
}

function findUserById(id) {
  return get(`SELECT * FROM users WHERE id = ?`, [id]);
}

function comparePassword(candidate, hashed) {
  return bcrypt.compare(candidate, hashed);
}

function setSubaccountCode(userId, code) {
  return run(`UPDATE users SET paystack_subaccount_code = ? WHERE id = ?`, [code, userId]);
}

function setVerificationCode(userId, code, expires) {
  return run(
    `UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE id = ?`,
    [code, expires, userId]
  );
}

function markVerified(userId) {
  return run(
    `UPDATE users SET is_verified = 1, verification_code = NULL, verification_code_expires = NULL WHERE id = ?`,
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