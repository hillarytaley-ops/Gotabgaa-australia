/**
 * Committee documents — list, upload, download (signed URL), delete.
 * Files live in private Supabase Storage bucket "documents".
 */
import { verifyToken, readAuthToken, getAdminSecret } from './lib/auth.js';
import { getSupabase, isSupabaseConfigured } from './lib/supabase.js';

const BUCKET = 'documents';
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_EXT = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf',
  'png', 'jpg', 'jpeg', 'webp', 'gif',
  'ppt', 'pptx', 'odt', 'ods'
]);

const CATEGORIES = [
  'General',
  'Governance',
  'Finance',
  'Minutes',
  'Membership',
  'Welfare',
  'Events',
  'Letters',
  'Other'
];

function missingTable(error) {
  return /relation|does not exist|Could not find the table|PGRST205/i.test(String(error?.message || error || ''));
}

function tableMissingResponse(res) {
  res.status(503).json({
    error: 'Documents library is not set up yet. Run supabase/migrate-committee-documents.sql in Supabase, create a private Storage bucket named "documents", then try again.'
  });
}

function safeFileName(name) {
  return String(name || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180) || 'file';
}

function extOf(name) {
  const parts = String(name || '').toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function formatBytes(n) {
  const size = Number(n) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function ensureDocumentsBucket(supabase) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets || []).some(b => b.name === BUCKET);
  if (exists) return;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: null
  });
  if (error && !/already exists|duplicate/i.test(String(error.message || ''))) {
    throw new Error(
      error.message?.includes('row-level security')
        ? 'Could not create the "documents" bucket automatically. Create a private Storage bucket named "documents" in the Supabase Dashboard.'
        : error.message
    );
  }
}

export default async function handler(req, res) {
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

  try {
    if (req.method === 'GET') {
      const id = String(req.query?.id || '').trim();
      const download = String(req.query?.download || '') === '1';

      if (id && download) {
        const { data: row, error } = await supabase
          .from('committee_documents')
          .select('id, title, file_name, storage_path, content_type')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          if (missingTable(error)) {
            tableMissingResponse(res);
            return;
          }
          throw error;
        }
        if (!row) {
          res.status(404).json({ error: 'Document not found.' });
          return;
        }

        const { data: signed, error: signError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(row.storage_path, 300);

        if (signError || !signed?.signedUrl) {
          res.status(502).json({
            error: signError?.message || 'Could not create a download link. Confirm the private "documents" bucket exists.'
          });
          return;
        }

        res.status(200).json({
          ok: true,
          url: signed.signedUrl,
          fileName: row.file_name,
          title: row.title,
          contentType: row.content_type
        });
        return;
      }

      const { data, error } = await supabase
        .from('committee_documents')
        .select('id, title, description, category, file_name, content_type, byte_size, uploaded_by, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        if (missingTable(error)) {
          tableMissingResponse(res);
          return;
        }
        throw error;
      }

      res.status(200).json({
        rows: (data || []).map(row => ({
          ...row,
          size_label: formatBytes(row.byte_size)
        })),
        categories: CATEGORIES
      });
      return;
    }

    if (req.method === 'POST') {
      const title = String(req.body?.title || '').trim().slice(0, 160);
      const description = String(req.body?.description || '').trim().slice(0, 500);
      let category = String(req.body?.category || 'General').trim().slice(0, 60) || 'General';
      if (!CATEGORIES.includes(category)) category = 'Other';
      const filename = String(req.body?.filename || req.body?.fileName || '').trim();
      const contentType = String(req.body?.contentType || 'application/octet-stream').trim();
      const data = req.body?.data;
      const uploadedBy = String(req.body?.uploadedBy || '').trim().slice(0, 160);

      if (!title || title.length < 2) {
        res.status(400).json({ error: 'Enter a document title.' });
        return;
      }
      if (!filename || !data) {
        res.status(400).json({ error: 'Choose a file to upload.' });
        return;
      }

      const ext = extOf(filename);
      if (!ALLOWED_EXT.has(ext)) {
        res.status(400).json({
          error: `File type .${ext || 'unknown'} is not allowed. Use PDF, Office, CSV, TXT, or common image types.`
        });
        return;
      }

      const buffer = Buffer.from(data, 'base64');
      if (!buffer.length) {
        res.status(400).json({ error: 'The file data was empty.' });
        return;
      }
      if (buffer.length > MAX_BYTES) {
        res.status(400).json({ error: 'File too large (max 4 MB per document).' });
        return;
      }

      await ensureDocumentsBucket(supabase);

      const safe = safeFileName(filename);
      const storagePath = `${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/${Date.now()}-${safe}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: contentType || 'application/octet-stream',
          upsert: false
        });

      if (uploadError) {
        if (/Bucket not found/i.test(String(uploadError.message || ''))) {
          res.status(503).json({
            error: 'Create a private Supabase Storage bucket named "documents" first (Dashboard → Storage).'
          });
          return;
        }
        throw uploadError;
      }

      const { data: row, error: insertError } = await supabase
        .from('committee_documents')
        .insert({
          title,
          description,
          category,
          storage_path: storagePath,
          file_name: safe,
          content_type: contentType || 'application/octet-stream',
          byte_size: buffer.length,
          uploaded_by: uploadedBy || null
        })
        .select('id, title, description, category, file_name, content_type, byte_size, uploaded_by, created_at')
        .single();

      if (insertError) {
        await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
        if (missingTable(insertError)) {
          tableMissingResponse(res);
          return;
        }
        throw insertError;
      }

      res.status(200).json({
        ok: true,
        row: { ...row, size_label: formatBytes(row.byte_size) },
        message: `Uploaded “${title}”.`
      });
      return;
    }

    if (req.method === 'DELETE') {
      const id = String(req.query?.id || req.body?.id || '').trim();
      if (!id) {
        res.status(400).json({ error: 'Choose a document to remove.' });
        return;
      }

      const { data: row, error } = await supabase
        .from('committee_documents')
        .select('id, storage_path, title')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        if (missingTable(error)) {
          tableMissingResponse(res);
          return;
        }
        throw error;
      }
      if (!row) {
        res.status(404).json({ error: 'Document not found.' });
        return;
      }

      if (row.storage_path) {
        await supabase.storage.from(BUCKET).remove([row.storage_path]);
      }

      const { error: delError } = await supabase
        .from('committee_documents')
        .delete()
        .eq('id', id);

      if (delError) throw delError;

      res.status(200).json({ ok: true, id, title: row.title });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[documents]', error);
    if (missingTable(error)) {
      tableMissingResponse(res);
      return;
    }
    res.status(500).json({ error: error.message || 'Documents request failed.' });
  }
}
