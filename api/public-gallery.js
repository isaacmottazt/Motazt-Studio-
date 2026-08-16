const MAX_ROWS = 1000;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

module.exports = async function publicGallery(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Método não permitido.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return json(res, 503, { error: 'Serviço de portfólio não configurado.' });
  }

  const origin = req.headers.origin;
  const allowedOrigin = process.env.MOTAZT_SITE_ORIGIN;
  if (allowedOrigin && origin && origin !== allowedOrigin) {
    return json(res, 403, { error: 'Origem não autorizada.' });
  }

  try {
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/galeria?select=id,imagem_url,imagem_preview,ordem&order=ordem.asc.nullslast,id.desc&limit=${MAX_ROWS}`;
    const response = await fetch(endpoint, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
    });
    if (!response.ok) {
      console.error('Supabase public gallery error:', response.status);
      return json(res, 502, { error: 'Não foi possível carregar o portfólio.' });
    }
    const rows = await response.json();
    return json(res, 200, Array.isArray(rows) ? rows : []);
  } catch (error) {
    console.error('Public gallery route error:', error);
    return json(res, 502, { error: 'Serviço de portfólio indisponível.' });
  }
};
