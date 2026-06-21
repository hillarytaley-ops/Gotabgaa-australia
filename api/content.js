import fs from 'fs';
import path from 'path';
import { verifyToken, readAuthToken } from './lib/auth.js';

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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const json = readLocalContent();
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

  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;

  if (!githubToken || !githubRepo) {
    res.status(503).json({
      error: 'Publishing is not configured. Set GITHUB_TOKEN and GITHUB_REPO in Vercel, or export JSON from the admin and commit manually.'
    });
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

    res.status(200).json({ ok: true, updatedAt: body.meta.updatedAt });
  } catch (err) {
    res.status(500).json({ error: 'Publish failed', detail: err.message });
  }
}
