const crypto = require('crypto');

function base64urlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecodeToString(input) {
  const str = String(input || '');
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf8');
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function signJwt(payload, secret, options) {
  if (!secret) throw new Error('Missing JWT secret');
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const p = Object.assign({}, payload || {});
  if (p.iat == null) p.iat = now;
  if (options && options.expiresInSeconds && p.exp == null) {
    p.exp = now + Math.max(1, Number(options.expiresInSeconds) || 0);
  }

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(p));
  const signingInput = encodedHeader + '.' + encodedPayload;

  const sig = crypto.createHmac('sha256', String(secret)).update(signingInput).digest();
  const encodedSig = base64urlEncode(sig);
  return signingInput + '.' + encodedSig;
}

function verifyJwt(token, secret) {
  if (!token) throw new Error('Missing token');
  if (!secret) throw new Error('Missing JWT secret');

  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const encodedHeader = parts[0];
  const encodedPayload = parts[1];
  const encodedSig = parts[2];

  const signingInput = encodedHeader + '.' + encodedPayload;
  const expectedSig = base64urlEncode(
    crypto.createHmac('sha256', String(secret)).update(signingInput).digest()
  );

  if (!timingSafeEqualStr(encodedSig, expectedSig)) throw new Error('Invalid token signature');

  const payloadJson = base64urlDecodeToString(encodedPayload);
  let payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch (e) {
    throw new Error('Invalid token payload');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload && typeof payload.exp !== 'undefined' && Number(payload.exp) <= now) {
    throw new Error('Token expired');
  }

  return payload;
}

module.exports = {
  signJwt,
  verifyJwt,
};
