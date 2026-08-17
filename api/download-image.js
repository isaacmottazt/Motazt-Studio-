const BUCKET = 'fotos';
const MAX_PATH_LENGTH = 420;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function cleanPath(value) {
  if (typeof value !== 'string') return null;
  const path = value.trim().replace(/^\/+/, '');
  if (!path || path.length > MAX_PATH_LENGTH || path.includes('..') || path.includes('\\') || path.includes('\0')) return null;
  return path;
}

module.exports = async function downloadImage(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Método não permitido.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Serviço de download não configurado.' });

  const query = new URL(req.url, 'https://motazt.local').searchParams;
  const galleryId = String(query.get('galleryId') || '').trim();
  const path = cleanPath(query.get('path'));
  if (!galleryId || !path) return json(res, 400, { error: 'Álbum ou arquivo inválido.' });
  if (!path.startsWith(`${galleryId}/`)) return json(res, 403, { error: 'Arquivo fora do álbum solicitado.' });

  const base = supabaseUrl.replace(/\/$/, '');
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  try {
    const galleryResponse = await fetch(`${base}/rest/v1/galerias?id=eq.${encodeURIComponent(galleryId)}&select=id,status,data_expiracao&limit=1`, { headers });
    const galleries = await galleryResponse.json().catch(() => []);
    const gallery = Array.isArray(galleries) ? galleries[0] : null;
    if (!gallery || gallery.status !== 'ativa' || (gallery.data_expiracao && new Date(gallery.data_expiracao) <= new Date())) {
      return json(res, 403, { error: 'Álbum inválido ou expirado.' });
    }

    const signedResponse = await fetch(`${base}/storage/v1/object/sign/${BUCKET}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 300, paths: [path] })
    });
    const signedBody = await signedResponse.json().catch(() => null);
    if (!signedResponse.ok) return json(res, 502, { error: 'Não foi possível preparar o download.' });
    const entry = (Array.isArray(signedBody) ? signedBody : (signedBody?.data || signedBody?.signed || []))[0];
    const rawUrl = entry?.signedURL || entry?.signedUrl || entry?.url || '';
    if (!rawUrl) return json(res, 502, { error: 'O Storage não retornou o arquivo.' });
    const signedUrl = rawUrl.startsWith('/') ? `${base}${rawUrl.startsWith('/storage/v1/') ? rawUrl : `/storage/v1${rawUrl}`}` : rawUrl;
    const fileResponse = await fetch(signedUrl);
    if (!fileResponse.ok) return json(res, 502, { error: 'Não foi possível baixar o arquivo.' });

    const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
    const contentLength = fileResponse.headers.get('content-length');
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="motaz-studio-${path.split('/').pop() || 'foto'}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    return res.end(buffer);
  } catch (error) {
    console.error('Download image route error:', error);
    return json(res, 502, { error: 'Serviço de download indisponível.' });
  }
};
