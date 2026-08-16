const TABLES = {
  galeria: 'id, imagem_url, imagem_preview, formato, ordem',
  destaques: 'id, imagem_url, ordem'
};

const ADMIN_ORIGIN = 'https://admin-luz-urbana.vercel.app';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

module.exports = async function adminContent(req, res) {
  if (req.headers.origin === ADMIN_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ADMIN_ORIGIN);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS' && req.headers.origin === ADMIN_ORIGIN) return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Método não permitido.' });
  }
  if (req.headers.origin !== ADMIN_ORIGIN) return json(res, 403, { error: 'Origem administrativa não autorizada.' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Serviço administrativo não configurado.' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(res, 401, { error: 'Autenticação administrativa necessária.' });
  const userResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` }
  });
  const user = await userResponse.json().catch(() => null);
  if (!userResponse.ok || !user?.id) return json(res, 403, { error: 'Sessão administrativa inválida.' });

  const resource = String(new URL(req.url, 'https://admin.local').searchParams.get('resource') || '');
  const select = TABLES[resource];
  if (!select) return json(res, 400, { error: 'Recurso administrativo inválido.' });

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${resource}?select=${encodeURIComponent(select)}&order=ordem.asc.nullslast,id.desc`;
  const response = await fetch(endpoint, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
  const data = await response.json().catch(() => null);
  if (!response.ok) return json(res, 502, { error: 'Não foi possível carregar os dados administrativos.' });
  return json(res, 200, { data: Array.isArray(data) ? data : [] });
};
