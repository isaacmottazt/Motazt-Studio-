const BUCKET = 'fotos';
const MAX_PATHS = 100;
const EXPIRES_IN = 60 * 60;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function normalizePath(value, supabaseUrl) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();
  let path = input;
  try {
    if (/^https?:\/\//i.test(input)) {
      const url = new URL(input);
      const expected = new URL(supabaseUrl);
      if (url.origin !== expected.origin) return null;
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      if (!url.pathname.startsWith(marker)) return null;
      path = decodeURIComponent(url.pathname.slice(marker.length));
    }
  } catch {
    return null;
  }
  path = path.replace(/^\/+/, '');
  if (!path || path.includes('..') || path.includes('\\') || path.includes('\0')) return null;
  return path;
}

async function supabaseGet(url, key) {
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  return response.json();
}

function normalizeAllowedUrl(value, supabaseUrl) {
  return normalizePath(value, supabaseUrl);
}

module.exports = async function signedImages(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método não permitido.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 503, { error: 'Serviço de imagens não configurado.' });
  }

  const origin = req.headers.origin;
  const allowedOrigin = process.env.MOTAZT_SITE_ORIGIN;
  if (allowedOrigin && origin && origin !== allowedOrigin) {
    return json(res, 403, { error: 'Origem não autorizada.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const rawPaths = Array.isArray(body?.paths) ? body.paths : [];
  const galleryId = typeof body?.galleryId === 'string' ? body.galleryId.trim() : '';
  const isPortfolio = body?.portfolio === true;
  const thumbnail = body?.thumbnail === true;
  if (rawPaths.length === 0 || rawPaths.length > MAX_PATHS || (!galleryId && !isPortfolio)) {
    return json(res, 400, { error: 'Solicitação de imagens inválida.' });
  }

  const originalByPath = new Map();
  const normalizedRawPaths = rawPaths.map(value => {
    const normalized = normalizePath(value, supabaseUrl);
    if (normalized) originalByPath.set(normalized, String(value).trim());
    return normalized;
  });
  const paths = [...new Set(normalizedRawPaths.filter(Boolean))];
  if (paths.length === 0 || paths.length !== rawPaths.length) {
    return json(res, 400, { error: 'Um ou mais caminhos de imagem são inválidos.' });
  }

  try {
    const apiBase = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`;
    if (galleryId) {
      const safeId = encodeURIComponent(galleryId);
      const galleries = await supabaseGet(`${apiBase}/galerias?id=eq.${safeId}&select=id,status,data_expiracao&limit=1`, serviceRoleKey);
      const gallery = Array.isArray(galleries) ? galleries[0] : null;
      if (!gallery || gallery.status !== 'ativa' || (gallery.data_expiracao && new Date(gallery.data_expiracao) <= new Date())) {
        return json(res, 403, { error: 'Galeria inválida ou expirada.' });
      }
      const prefix = `${galleryId}/`;
      if (paths.some(path => !path.startsWith(prefix))) {
        return json(res, 403, { error: 'Imagem fora da galeria solicitada.' });
      }
    } else {
      const portfolioRows = await supabaseGet(`${apiBase}/galeria?select=imagem_url,imagem_preview&limit=1000`, serviceRoleKey);
      const allowed = new Set((Array.isArray(portfolioRows) ? portfolioRows : []).flatMap(row => [row.imagem_url, row.imagem_preview].map(value => normalizeAllowedUrl(value, supabaseUrl)).filter(Boolean)));
      if (paths.some(path => !allowed.has(path))) {
        return json(res, 403, { error: 'Imagem fora do portfólio público.' });
      }
    }

    const signEndpoint = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/sign/${BUCKET}`;
    const response = await fetch(signEndpoint, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expiresIn: EXPIRES_IN, paths })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('Supabase signed URL error:', response.status);
      return json(res, 502, { error: 'Não foi possível assinar as imagens.' });
    }

    const rawEntries = Array.isArray(data) ? data : (data?.data || data?.signed || []);
    const entries = Array.isArray(rawEntries) ? rawEntries : [];
    const signed = entries.map((entry, index) => {
      const returnedPath = typeof entry?.path === 'string' ? entry.path.replace(/^\/+/, '') : '';
      const matchedPath = returnedPath
        ? paths.find(path => path === returnedPath || path.endsWith(`/${returnedPath}`) || path.endsWith(`/fotos/${returnedPath}`))
        : paths[index];
      const rawSignedUrl = entry?.signedURL || entry?.signedUrl || entry?.url || '';
      let signedUrl = rawSignedUrl.startsWith('/')
        ? `${supabaseUrl.replace(/\/$/, '')}${rawSignedUrl.startsWith('/storage/v1/') ? rawSignedUrl : `/storage/v1${rawSignedUrl}`}`
        : rawSignedUrl;
      if (thumbnail && signedUrl) {
        try {
          const parsed = new URL(signedUrl);
          parsed.pathname = parsed.pathname.replace('/storage/v1/object/sign/', '/storage/v1/render/image/sign/');
          parsed.searchParams.set('width', '700');
          parsed.searchParams.set('quality', '70');
          signedUrl = parsed.href;
        } catch { /* mantém a URL assinada original */ }
      }
      return {
        path: originalByPath.get(matchedPath) || matchedPath || '',
        signedUrl
      };
    }).filter(entry => entry.path && entry.signedUrl);
    return json(res, 200, { expiresIn: EXPIRES_IN, signed });
  } catch (error) {
    console.error('Signed image route error:', error);
    return json(res, 502, { error: 'Serviço de imagens indisponível.' });
  }
};
