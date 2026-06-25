import { getAilcdDeadlinePayload } from './lib/ailcd-app.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(getAilcdDeadlinePayload());
}
