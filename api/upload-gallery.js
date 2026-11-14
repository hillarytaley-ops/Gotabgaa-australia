import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

async function githubUploadFile(repo, token, filePath, buffer, message) {
  const existing = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );

  let sha;
  if (existing.ok) {
    const json = await existing.json();
    sha = json.sha;
  }

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
      body: JSON.stringify({
        message,
        content: buffer.toString('base64'),
        sha
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub upload failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return (
    data.content?.download_url ||
    data.content?.html_url?.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/') ||
    null
  );
}

async function uploadViaGithub(storagePath, buffer, kind) {
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;
  if (!githubToken || !githubRepo) return null;

  const isLeadership = String(storagePath).startsWith('leadership/');
  const githubPath = isLeadership ? `assets/${storagePath}` : `assets/gallery/${storagePath}`;

  const url = await githubUploadFile(
    githubRepo,
    githubToken,
    githubPath,
    buffer,
    `Admin: upload ${kind} (${storagePath})`
  );

  const relative = `/${githubPath}`;
  return { url: url || relative, path: githubPath, relative };
}

async function ensureGalleryBucket(supabase) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) return { ok: false, error: listError.message };

  if ((buckets || []).some((b) => b.name === 'gallery' || b.id === 'gallery')) {
    return { ok: true, created: false };
  }

  const { error: createError } = await supabase.storage.createBucket('gallery', {
    public: true,
    fileSizeLimit: 4 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  });

  if (createError && !/already exists|duplicate/i.test(String(createError.message))) {
    return { ok: false, error: createError.message };
  }

  return { ok: true, created: true };
}

async function uploadToGallery(supabase, storagePath, buffer, contentType) {
  return supabase.storage.from('gallery').upload(storagePath, buffer, {
    contentType: contentType || 'image/jpeg',
    upsert: false
  });
}

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

  const { eventId, filename, contentType, data } = req.body || {};
  if (!eventId?.trim() || !filename?.trim() || !data) {
    res.status(400).json({ error: 'eventId, filename, and data are required' });
    return;
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const buffer = Buffer.from(data, 'base64');
  const maxSize = 4 * 1024 * 1024;
  if (buffer.length > maxSize) {
    res.status(400).json({ error: 'File too large (max 4MB per image)' });
    return;
  }

  const storagePath = `${eventId.trim()}/${Date.now()}-${safeName}`;
  const isLeadership = String(eventId).startsWith('leadership');
  const kind = isLeadership ? 'leadership photo' : 'gallery photo';

  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();

      let { error } = await uploadToGallery(supabase, storagePath, buffer, contentType);

      if (error && /bucket not found/i.test(String(error.message))) {
        const ensured = await ensureGalleryBucket(supabase);
        if (ensured.ok) {
          ({ error } = await uploadToGallery(supabase, storagePath, buffer, contentType));
        } else {
          error = { message: `Bucket missing and could not create gallery: ${ensured.error}` };
        }
      }

      if (!error) {
        const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(storagePath);
        res.status(200).json({ url: urlData.publicUrl, path: storagePath });
        return;
      }

      const msg = String(error.message || '');
      const githubResult = await uploadViaGithub(storagePath, buffer, kind);
      if (githubResult) {
        res.status(200).json({
          url: githubResult.relative || githubResult.url,
          path: githubResult.path,
          via: 'github',
          warning: `Supabase upload failed (${msg}) — uploaded via GitHub instead.`
        });
        return;
      }

      throw new Error(
        msg.includes('Bucket') || /bucket/i.test(msg)
          ? 'Could not create/use the Supabase "gallery" bucket. In Supabase → Storage → New bucket, create a public bucket named gallery. Or set GITHUB_TOKEN + GITHUB_REPO in Vercel.'
          : msg
      );
    }

    const githubResult = await uploadViaGithub(storagePath, buffer, kind);
    if (githubResult) {
      res.status(200).json({
        url: githubResult.relative || githubResult.url,
        path: githubResult.path,
        via: 'github'
      });
      return;
    }

    res.status(503).json({
      error:
        'Upload not configured. In Supabase Storage create a public bucket named "gallery", or set GITHUB_TOKEN + GITHUB_REPO in Vercel.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed', detail: err.message });
  }
}
