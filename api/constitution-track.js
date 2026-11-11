import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

const SESSION_RE = /^[a-zA-Z0-9_-]{8,80}$/;

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function isEngaged(maxPage, dwellSeconds) {
  return maxPage >= 3 || dwellSeconds >= 45;
}

function truncate(value, max) {
  const s = String(value || '').trim();
  if (!s) return null;
  return s.slice(0, max);
}

async function handleTrack(req, res) {
  if (!isSupabaseConfigured()) {
    res.status(204).end();
    return;
  }

  let body = {};
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    body = req.body;
  } else if (typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body);
    } catch {
      body = {};
    }
  } else if (Buffer.isBuffer(req.body)) {
    try {
      body = JSON.parse(req.body.toString('utf8'));
    } catch {
      body = {};
    }
  }
  const sessionId = String(body.sessionId || '').trim();
  if (!SESSION_RE.test(sessionId)) {
    res.status(204).end();
    return;
  }

  const page = clampInt(body.page, 1, 500, 1);
  const totalPages = clampInt(body.totalPages, 1, 500, null);
  const dwellSeconds = clampInt(body.dwellSeconds, 0, 60 * 60 * 12, 0);
  const referrer = truncate(body.referrer, 400);
  const path = truncate(body.path || '/constitution.html', 200);
  const userAgent = truncate(req.headers['user-agent'], 300);

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('constitution_reads')
    .select('id, max_page, pages_viewed, dwell_seconds, visited_at')
    .eq('session_id', sessionId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (!existing) {
    const engaged = isEngaged(page, dwellSeconds);
    const { error } = await supabase.from('constitution_reads').insert({
      session_id: sessionId,
      visited_at: now,
      last_seen_at: now,
      max_page: page,
      pages_viewed: 1,
      dwell_seconds: dwellSeconds,
      total_pages: totalPages,
      engaged,
      referrer,
      path,
      user_agent: userAgent
    });
    if (error && !/duplicate|unique|23505/i.test(String(error.message))) {
      res.status(204).end();
      return;
    }
    res.status(204).end();
    return;
  }

  const maxPage = Math.max(existing.max_page || 1, page);
  const nextPagesViewed =
    page > (existing.max_page || 1)
      ? (existing.pages_viewed || 1) + 1
      : Math.max(existing.pages_viewed || 1, 1);
  const nextDwell = Math.max(existing.dwell_seconds || 0, dwellSeconds);
  const engaged = isEngaged(maxPage, nextDwell);

  const patch = {
    last_seen_at: now,
    max_page: maxPage,
    pages_viewed: nextPagesViewed,
    dwell_seconds: nextDwell,
    engaged
  };
  if (totalPages) patch.total_pages = totalPages;

  await supabase.from('constitution_reads').update(patch).eq('session_id', sessionId);

  res.status(204).end();
}

async function handleStats(req, res) {
  const token = readAuthToken(req);
  if (!verifyToken(token, getAdminSecret())) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('constitution_reads')
    .select('session_id, visited_at, last_seen_at, max_page, pages_viewed, dwell_seconds, total_pages, engaged, referrer, path')
    .order('last_seen_at', { ascending: false })
    .limit(2000);

  if (error) {
    res.status(500).json({
      error: error.message,
      hint: 'Run supabase/migrate-constitution-reads.sql in the Supabase SQL Editor.'
    });
    return;
  }

  const rows = data || [];
  const tz = 'Australia/Sydney';
  const dayKey = (value) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(value));

  const todayKey = dayKey(Date.now());
  const yesterdayKey = dayKey(Date.now() - 24 * 60 * 60 * 1000);

  const visitors = rows.length;
  const readers = rows.filter((r) => r.engaged).length;
  const todayRows = rows.filter((r) => dayKey(r.visited_at) === todayKey);
  const yesterdayRows = rows.filter((r) => dayKey(r.visited_at) === yesterdayKey);
  const today = todayRows.length;
  const todayReaders = todayRows.filter((r) => r.engaged).length;
  const yesterday = yesterdayRows.length;
  const yesterdayReaders = yesterdayRows.filter((r) => r.engaged).length;
  const avgMaxPage =
    visitors === 0
      ? 0
      : Math.round((rows.reduce((sum, r) => sum + (r.max_page || 1), 0) / visitors) * 10) / 10;
  const avgDwell =
    visitors === 0
      ? 0
      : Math.round(rows.reduce((sum, r) => sum + (r.dwell_seconds || 0), 0) / visitors);

  // Last 7 calendar days (AU), oldest → newest
  const byDay = [];
  for (let i = 6; i >= 0; i -= 1) {
    const key = dayKey(Date.now() - i * 24 * 60 * 60 * 1000);
    const dayRows = rows.filter((r) => dayKey(r.visited_at) === key);
    byDay.push({
      date: key,
      visitors: dayRows.length,
      readers: dayRows.filter((r) => r.engaged).length
    });
  }

  res.status(200).json({
    visitors,
    readers,
    today,
    todayReaders,
    yesterday,
    yesterdayReaders,
    timezone: tz,
    byDay,
    avgMaxPage,
    avgDwell,
    recent: rows.slice(0, 50)
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    await handleTrack(req, res);
    return;
  }
  if (req.method === 'GET') {
    await handleStats(req, res);
    return;
  }
  res.status(405).json({ error: 'Method not allowed' });
}
