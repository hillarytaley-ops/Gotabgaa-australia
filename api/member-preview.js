import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = readAuthToken(req);
  if (!verifyToken(token, getAdminSecret())) {
    res.status(401).json({ error: 'Admin sign-in required for preview' });
    return;
  }

  res.status(200).json({
    preview: true,
    member: {
      name: 'Preview Member',
      email: 'preview@gotabgaa.local',
      phone: '—',
      stateChapter: 'NSW',
      membershipType: 'Full Member',
      membershipId: 'GAA-MEM-PREVIEW',
      memberStatus: 'active',
      paymentStatus: 'preview',
      feeDisplay: 'Sample preview',
      joinedAt: new Date().toISOString()
    }
  });
}
