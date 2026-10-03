const fetch = require('node-fetch');

const PAYSTACK_BASE = 'https://api.paystack.co';
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

async function paystackRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.message || 'Paystack request failed');
  return data.data;
}

function createSubaccount({ businessName, bankCode, accountNumber, percentageCharge }) {
  return paystackRequest('/subaccount', {
    method: 'POST',
    body: {
      business_name: businessName,
      bank_code: bankCode,
      account_number: accountNumber,
      percentage_charge: percentageCharge,
    },
  });
}

function initializeSingleSellerTransaction({ email, amountGHS, subaccountCode, reference, callbackUrl }) {
  return paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: {
      email,
      amount: Math.round(amountGHS * 100),
      currency: 'GHS',
      reference,
      callback_url: callbackUrl,
      subaccount: subaccountCode,
    },
  });
}

async function initializeMultiSellerTransaction({ email, amountGHS, sellerShares, reference, callbackUrl }) {
  const split = await paystackRequest('/split', {
    method: 'POST',
    body: {
      name: `order-${reference}`,
      type: 'percentage',
      currency: 'GHS',
      subaccounts: sellerShares.map((s) => ({ subaccount: s.subaccountCode, share: s.percentage })),
      bearer_type: 'account',
    },
  });

  return paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: {
      email,
      amount: Math.round(amountGHS * 100),
      currency: 'GHS',
      reference,
      callback_url: callbackUrl,
      split_code: split.split_code,
    },
  });
}

function verifyTransaction(reference) {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
}

module.exports = {
  createSubaccount,
  initializeSingleSellerTransaction,
  initializeMultiSellerTransaction,
  verifyTransaction,
};