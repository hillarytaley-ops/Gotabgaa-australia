/**
 * Stream the draft constitution for in-browser viewing only.
 * Not intended as a public download endpoint — served inline, no-store, noindex.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolvePdfPath() {
  const candidates = [
    path.join(__dirname, '_private', 'constitution-draft-view.pdf'),
    path.join(process.cwd(), 'api', '_private', 'constitution-draft-view.pdf'),
    path.join(process.cwd(), '_private', 'constitution-draft-view.pdf')
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'X-Gotabgaa-Viewer, Accept');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const referer = String(req.headers.referer || '');
  const origin = String(req.headers.origin || '');
  const host = String(req.headers.host || '');
  const fromViewer = String(req.headers['x-gotabgaa-viewer'] || '') === '1';
  const sameSite =
    (host && referer.includes(host))
    || referer.includes('gotabgaaaustralia.org')
    || referer.includes('localhost')
    || referer.includes('127.0.0.1')
    || origin.includes('gotabgaaaustralia.org')
    || origin.includes('localhost');

  if (!fromViewer && !sameSite) {
    res.status(403).json({ error: 'This document can only be viewed on the Gotabgaa Australia website.' });
    return;
  }

  const pdfPath = resolvePdfPath();
  if (!pdfPath) {
    res.status(404).json({ error: 'Constitution document is not available yet.' });
    return;
  }

  const stat = fs.statSync(pdfPath);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Content-Disposition', 'inline; filename="Gotabgaa-Constitution-Draft-View.pdf"');
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Download-Options', 'noopen');

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  const stream = fs.createReadStream(pdfPath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).json({ error: 'Could not read document.' });
  });
  stream.pipe(res);
}
