const BUCKET = 'fotos';
const EXPIRES_IN = 60 * 60;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function storagePath(value, supabaseUrl) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();
  try {
    if (/^https?:\/\//i.test(input)) {
      const url = new URL(input);
      const expected = new URL(supabaseUrl);
      if (url.origin !== expected.origin) return null;
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      if (!url.pathname.startsWith(marker)) return null;
      return decodeURIComponent(url.pathname.slice(marker.length)).replace(/^\/+/, '');
    }
  } catch {
    return null;
  }
  const path = input.replace(/^\/+/, '');
  return path && !path.includes('..') && !path.includes('\\') ? path : null;
}

module.exports = async function publicAlbum(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Método não permitido.' });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Serviço de galerias não configurado.' });

  const query = new URL(req.url, 'https://motazt.local').searchParams;
  const identifier = String(query.get('codigo') || query.get('id') || '').trim();
  if (!identifier || identifier.length > 120) return json(res, 400, { error: 'Código de galeria inválido.' });

  const base = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  const filter = uuid ? `id=eq.${encodeURIComponent(identifier)}` : `codigo_curto=ilike.${encodeURIComponent(identifier)}`;
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  let galleries = [];
  for (const resource of ['galerias_publicas', 'galerias']) {
    const galleryResponse = await fetch(`${base}/${resource}?${filter}&select=id,codigo_curto,cliente_nome,titulo,data_expiracao,status,total_fotos&limit=1`, { headers });
    const candidate = await galleryResponse.json().catch(() => []);
    if (galleryResponse.ok && Array.isArray(candidate) && candidate.length) {
      galleries = candidate;
      break;
    }
  }
  const gallery = galleries[0] || null;
  if (!gallery || gallery.status !== 'ativa' || (gallery.data_expiracao && new Date(gallery.data_expiracao) <= new Date())) {
    return json(res, 404, { error: 'Galeria não encontrada ou expirada.' });
  }

  const photosResponse = await fetch(`${base}/fotos?galeria_id=eq.${encodeURIComponent(gallery.id)}&select=id,arquivo_preview,arquivo_full,posicao,favorita&order=posicao.asc`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
  });
  const photos = await photosResponse.json().catch(() => []);
  if (!photosResponse.ok || !Array.isArray(photos)) return json(res, 502, { error: 'Não foi possível carregar as fotos.' });

  const paths = [...new Set(photos.flatMap(photo => [photo.arquivo_preview, photo.arquivo_full].map(value => storagePath(value, supabaseUrl)).filter(Boolean)))];
  let signedEntries = [];
  if (paths.length) {
    const signResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/sign/${BUCKET}`, {
      method: 'POST',
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: EXPIRES_IN, paths })
    });
    const signedBody = await signResponse.json().catch(() => null);
    if (!signResponse.ok) return json(res, 502, { error: 'Não foi possível assinar as fotos.' });
    signedEntries = Array.isArray(signedBody) ? signedBody : (signedBody?.data || signedBody?.signed || []);
  }

  const signedMap = new Map(signedEntries.map(entry => {
    const path = String(entry?.path || '').replace(/^\/+/, '');
    const raw = entry?.signedURL || entry?.signedUrl || entry?.url || '';
    const url = raw.startsWith('/') ? `${supabaseUrl.replace(/\/$/, '')}${raw.startsWith('/storage/v1/') ? raw : `/storage/v1${raw}`}` : raw;
    return [path, url];
  }));
  const outputPhotos = photos.map(photo => {
    const previewPath = storagePath(photo.arquivo_preview, supabaseUrl);
    const fullPath = storagePath(photo.arquivo_full, supabaseUrl);
    return {
      id: photo.id,
      posicao: photo.posicao,
      favorita: Boolean(photo.favorita),
      arquivo_preview: signedMap.get(previewPath) || '',
      arquivo_full: signedMap.get(fullPath) || ''
    };
  });

  return json(res, 200, { expiresIn: EXPIRES_IN, galeria: gallery, fotos: outputPhotos });
};
