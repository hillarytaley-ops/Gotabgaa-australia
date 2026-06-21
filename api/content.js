import fs from 'fs';
import path from 'path';
import { verifyToken, readAuthToken } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

const CONTENT_PATH = 'data/content.json';

async function githubGetFile(repo, token, filePath) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );
  if (!res.ok) return null;
  return res.json();
}

async function githubUpdateFile(repo, token, filePath, content, message, sha) {
  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64')
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${err}`);
  }
  return res.json();
}

function readLocalContent() {
  const file = path.join(process.cwd(), CONTENT_PATH);
  return fs.readFileSync(file, 'utf8');
}

async function readFromSupabase() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('site_content')
    .select('data')
    .eq('id', 'main')
    .maybeSingle();

  if (error || !data?.data) return null;

  const payload = data.data;
  if (!payload || typeof payload !== 'object') return null;
  if (!payload.site && !payload.pages) return null;

  return JSON.stringify(payload);
}

async function saveToSupabase(content) {
  const supabase = getSupabase();
  if (!supabase) return false;

  const updatedAt = content.meta?.updatedAt || new Date().toISOString();

  const { error } = await supabase.from('site_content').upsert({
    id: 'main',
    data: content,
    updated_at: updatedAt
  });

  if (error) throw new Error(`Supabase: ${error.message}`);
  return true;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      let json = await readFromSupabase();
      if (!json) json = readLocalContent();

      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(200).send(json);
    } catch (err) {
      res.status(500).json({ error: 'Failed to read content', detail: err.message });
    }
    return;
  }

  if (req.method !== 'PUT') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.ADMIN_SECRET;
  const token = readAuthToken(req);
  if (!verifyToken(token, secret)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Invalid content body' });
      return;
    }

    body.meta = body.meta || {};
    body.meta.updatedAt = new Date().toISOString();

    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO;
    let savedToSupabase = false;
    let savedToGithub = false;

    if (isSupabaseConfigured()) {
      savedToSupabase = await saveToSupabase(body);
    }

    if (githubToken && githubRepo) {
      const contentStr = JSON.stringify(body, null, 2) + '\n';
      const existing = await githubGetFile(githubRepo, githubToken, CONTENT_PATH);
      await githubUpdateFile(
        githubRepo,
        githubToken,
        CONTENT_PATH,
        contentStr,
        `Admin: update site content (${body.meta.updatedAt})`,
        existing?.sha
      );
      savedToGithub = true;
    }

    if (!savedToSupabase && !savedToGithub) {
      res.status(503).json({
        error: 'Publishing is not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, or GITHUB_TOKEN + GITHUB_REPO, in Vercel.'
      });
      return;
    }

    res.status(200).json({
      ok: true,
      updatedAt: body.meta.updatedAt,
      savedToSupabase,
      savedToGithub
    });
  } catch (err) {
    res.status(500).json({ error: 'Publish failed', detail: err.message });
  }
}
