import { createToken } from './lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SECRET;

  if (!password || !secret) {
    res.status(503).json({
      error: 'Admin login is not configured. Set ADMIN_PASSWORD and ADMIN_SECRET in Vercel environment variables.'
    });
    return;
  }

  const { password: attempt } = req.body || {};
  if (!attempt || attempt !== password) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  res.status(200).json({
    token: createToken(secret),
    expiresIn: 8 * 60 * 60
  });
}
