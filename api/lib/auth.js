import crypto from 'crypto';

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

export function getAdminSecret() {
  return (process.env.ADMIN_SECRET || '').trim();
}

export function createToken(secret) {
  const key = (secret || getAdminSecret()).trim();
  if (!key) return null;
  const payload = JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS });
  const sig = crypto.createHmac('sha256', key).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

export function verifyToken(token, secret) {
  const key = (secret || getAdminSecret()).trim();
  if (!token || !key) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
  const expected = crypto.createHmac('sha256', key).update(payload).digest('hex');
  if (sig !== expected) return false;
  try {
    const data = JSON.parse(payload);
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

export function readAuthToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}
