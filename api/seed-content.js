import fs from 'fs';
import path from 'path';
import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

const CONTENT_PATH = 'data/content.json';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = readAuthToken(req);
  if (!verifyToken(token, getAdminSecret())) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Supabase not configured in Vercel' });
    return;
  }

  try {
    const file = path.join(process.cwd(), CONTENT_PATH);
    const content = JSON.parse(fs.readFileSync(file, 'utf8'));
    content.meta = content.meta || {};
    content.meta.updatedAt = new Date().toISOString();

    const supabase = getSupabase();
    const { error } = await supabase.from('site_content').upsert({
      id: 'main',
      data: content,
      updated_at: content.meta.updatedAt
    });

    if (error) {
      res.status(500).json({
        error: 'Seed failed',
        detail: error.message,
        hint: 'Run supabase/schema.sql in Supabase SQL Editor first.'
      });
      return;
    }

    res.status(200).json({
      ok: true,
      updatedAt: content.meta.updatedAt,
      message: 'Site content loaded into Supabase from data/content.json'
    });
  } catch (err) {
    res.status(500).json({ error: 'Seed failed', detail: err.message });
  }
}
