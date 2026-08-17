function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function clean(value, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

module.exports = async function publicFavorite(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método não permitido.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Serviço de favoritos não configurado.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const galleryId = clean(body?.galleryId);
  const photoId = clean(body?.photoId);
  const favorita = body?.favorita === true;
  if (!galleryId || !photoId) return json(res, 400, { error: 'Álbum ou foto inválidos.' });

  const base = supabaseUrl.replace(/\/$/, '');
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  try {
    const galleryResponse = await fetch(`${base}/rest/v1/galerias?id=eq.${encodeURIComponent(galleryId)}&select=id,status,data_expiracao&limit=1`, { headers });
    const galleries = await galleryResponse.json().catch(() => []);
    const gallery = Array.isArray(galleries) ? galleries[0] : null;
    if (!gallery || gallery.status !== 'ativa' || (gallery.data_expiracao && new Date(gallery.data_expiracao) <= new Date())) {
      return json(res, 403, { error: 'Álbum inválido ou expirado.' });
    }

    const photoResponse = await fetch(`${base}/rest/v1/fotos?id=eq.${encodeURIComponent(photoId)}&galeria_id=eq.${encodeURIComponent(galleryId)}&select=id`, { headers });
    const photos = await photoResponse.json().catch(() => []);
    if (!photoResponse.ok || !Array.isArray(photos) || !photos[0]) return json(res, 404, { error: 'Foto não pertence a este álbum.' });

    const updateResponse = await fetch(`${base}/rest/v1/fotos?id=eq.${encodeURIComponent(photoId)}&galeria_id=eq.${encodeURIComponent(galleryId)}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ favorita })
    });
    if (!updateResponse.ok) return json(res, 502, { error: 'Não foi possível salvar o favorito.' });
    return json(res, 200, { sucesso: true, favorita });
  } catch (error) {
    console.error('Public favorite route error:', error);
    return json(res, 502, { error: 'Serviço de favoritos indisponível.' });
  }
};
