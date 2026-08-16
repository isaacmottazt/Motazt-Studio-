const BUCKET = 'fotos';
const MAX_PATH_LENGTH = 420;
const ADMIN_ORIGIN = 'https://admin-luz-urbana.vercel.app';

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin === ADMIN_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ADMIN_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  return !origin || origin === ADMIN_ORIGIN;
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safePath(value) {
  const path = clean(value, MAX_PATH_LENGTH).replace(/^\/+/, '');
  if (!path || path.includes('..') || path.includes('\\') || path.includes('\0')) return null;
  return path;
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return null;
}

async function supabaseFetch(base, key, path, options = {}) {
  return fetch(`${base.replace(/\/$/, '')}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
}

async function authenticate(req, supabaseUrl, serviceRoleKey) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return { error: [401, 'Autenticação administrativa necessária.'] };
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` }
  });
  const user = await response.json().catch(() => null);
  if (!response.ok || !user?.id) return { error: [403, 'Sessão administrativa inválida ou expirada.'] };
  const allowedEmail = clean(process.env.MOTAZT_ADMIN_EMAIL, 320).toLowerCase();
  if (allowedEmail && String(user.email || '').toLowerCase() !== allowedEmail) {
    return { error: [403, 'Usuário não autorizado para administrar o painel.'] };
  }
  return { user };
}

async function createGallery(req, res, base, key, body) {
  const nome = clean(body?.clienteNome, 180);
  const telefone = clean(body?.clienteTelefone, 80);
  const titulo = clean(body?.titulo, 240);
  if (!nome || !telefone) return json(res, 400, { error: 'Nome e telefone do cliente são obrigatórios.' });

  const created = new Date();
  const expiration = new Date(created);
  expiration.setDate(expiration.getDate() + 30);
  let publication = null;
  if (body?.dataPublicacao) {
    const parsed = new Date(body.dataPublicacao);
    if (Number.isNaN(parsed.getTime())) return json(res, 400, { error: 'Data de publicação inválida.' });
    publication = parsed;
  }
  const payload = {
    cliente_nome: nome,
    cliente_telefone: telefone,
    titulo: titulo || null,
    status: 'ativa',
    total_fotos: 0,
    data_criacao: created.toISOString(),
    data_expiracao: expiration.toISOString(),
    mensagem_agradecimento: clean(body?.mensagemAgradecimento, 1000) || null,
    data_publicacao: publication ? publication.toISOString() : null,
    status_publicacao: publication && publication > created ? 'agendado' : 'publicado'
  };
  const response = await supabaseFetch(base, key, '/rest/v1/galerias?select=id,codigo_curto,titulo,status,data_expiracao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data) || !data[0]?.id) {
    console.error('Create gallery failed:', response.status, data);
    return json(res, 502, { error: 'Não foi possível criar o álbum no banco de dados.' });
  }
  return json(res, 200, { sucesso: true, galeria: data[0], galeria_id: data[0].id, mensagem: 'Álbum criado com sucesso.' });
}

async function resolveGallery(req, res, base, key, body) {
  const reference = clean(body?.reference, 80);
  if (!reference) return json(res, 400, { error: 'Código ou ID da galeria obrigatório.' });
  const filter = /^MZ-[A-Z0-9]+$/i.test(reference)
    ? `codigo_curto=eq.${encodeURIComponent(reference.toUpperCase())}`
    : `id=eq.${encodeURIComponent(reference)}`;
  const response = await supabaseFetch(base, key, `/rest/v1/galerias?select=id,codigo_curto&${filter}&limit=1`);
  const data = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data) || !data[0]?.id) return json(res, 404, { error: 'Álbum não encontrado para esse código.' });
  return json(res, 200, { sucesso: true, galeria_id: data[0].id, codigo_curto: data[0].codigo_curto });
}

async function prepareUpload(req, res, base, key, body) {
  const path = safePath(body?.path);
  if (!path) return json(res, 400, { error: 'Caminho de upload inválido.' });
  const response = await supabaseFetch(base, key, `/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('Prepare upload failed:', response.status, data);
    return json(res, 502, { error: 'Não foi possível preparar o upload seguro.' });
  }
  const token = data?.token || data?.data?.token;
  const rawUrl = data?.url || data?.signedURL || data?.signedUrl || data?.data?.url || '';
  let signedUrl = rawUrl;
  if (signedUrl.startsWith('/')) {
    signedUrl = `${base.replace(/\/$/, '')}${signedUrl.startsWith('/storage/v1/') ? signedUrl : `/storage/v1${signedUrl}`}`;
  } else if (signedUrl) {
    try {
      const parsed = new URL(signedUrl);
      if (parsed.origin === new URL(base).origin && parsed.pathname.startsWith('/object/')) {
        parsed.pathname = `/storage/v1${parsed.pathname}`;
        signedUrl = parsed.toString();
      }
    } catch {}
  }
  if (!token && !signedUrl) return json(res, 502, { error: 'O Storage não retornou uma URL de upload válida.' });
  return json(res, 200, { path, token, signedUrl });
}

async function deleteGallery(req, res, base, key, body) {
  const galeriaId = clean(body?.galeriaId, 80);
  if (!galeriaId) return json(res, 400, { error: 'ID do álbum inválido.' });
  const listResponse = await supabaseFetch(base, key, '/storage/v1/object/list/' + BUCKET, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: galeriaId, limit: 1000, offset: 0 })
  });
  const listed = await listResponse.json().catch(() => []);
  const objects = Array.isArray(listed) ? listed.filter(item => item?.name).map(item => `${galeriaId}/${item.name}`) : [];
  for (const path of objects) {
    const response = await supabaseFetch(base, key, `/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE' });
    if (!response.ok) console.error('Failed to remove test object:', path, response.status);
  }
  const photosResponse = await supabaseFetch(base, key, `/rest/v1/fotos?galeria_id=eq.${encodeURIComponent(galeriaId)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  const galleryResponse = await supabaseFetch(base, key, `/rest/v1/galerias?id=eq.${encodeURIComponent(galeriaId)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  if (!photosResponse.ok || !galleryResponse.ok) return json(res, 502, { error: 'Não foi possível remover completamente o álbum temporário.' });
  return json(res, 200, { sucesso: true, arquivos_removidos: objects.length });
}

async function reorderPhotos(req, res, base, key, body) {
  const galeriaId = clean(body?.galeriaId, 80);
  const photoIds = Array.isArray(body?.photoIds) ? body.photoIds.map(id => clean(id, 80)).filter(Boolean).slice(0, 200) : [];
  if (!galeriaId || !photoIds.length) return json(res, 400, { error: 'Álbum ou ordem de fotos inválida.' });
  for (const [index, photoId] of photoIds.entries()) {
    const response = await supabaseFetch(base, key, `/rest/v1/fotos?id=eq.${encodeURIComponent(photoId)}&galeria_id=eq.${encodeURIComponent(galeriaId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ posicao: index + 1 })
    });
    if (!response.ok) {
      console.error('Photo reorder failed:', response.status, photoId);
      return json(res, 502, { error: 'Não foi possível salvar a ordem das fotos.' });
    }
  }
  return json(res, 200, { sucesso: true, total: photoIds.length });
}

async function finalizePhoto(req, res, base, key, body) {
  const galeriaId = clean(body?.galeriaId, 80);
  const previewPath = safePath(body?.previewPath);
  const originalPath = safePath(body?.originalPath);
  if (!galeriaId || !previewPath || !originalPath) return json(res, 400, { error: 'Dados da foto incompletos.' });

  const countResponse = await supabaseFetch(base, key, `/rest/v1/fotos?select=id&galeria_id=eq.${encodeURIComponent(galeriaId)}`, { headers: { Prefer: 'count=exact' } });
  const range = countResponse.headers.get('content-range') || '';
  const count = Number((range.split('/')[1] || '0')) || 0;
  const photoResponse = await supabaseFetch(base, key, '/rest/v1/fotos?select=id,galeria_id,arquivo_preview,arquivo_full,posicao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ galeria_id: galeriaId, arquivo_preview: previewPath, arquivo_full: originalPath, arquivo_original: originalPath, posicao: count + 1 })
  });
  const photoData = await photoResponse.json().catch(() => null);
  if (!photoResponse.ok || !Array.isArray(photoData) || !photoData[0]?.id) {
    console.error('Finalize photo failed:', photoResponse.status, photoData);
    return json(res, 502, { error: 'Os arquivos foram enviados, mas não foi possível registrar a foto.' });
  }
  const updateResponse = await supabaseFetch(base, key, `/rest/v1/galerias?id=eq.${encodeURIComponent(galeriaId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ total_fotos: count + 1 })
  });
  if (!updateResponse.ok) console.error('Gallery count update failed:', updateResponse.status, await updateResponse.text().catch(() => ''));
  return json(res, 200, { sucesso: true, foto: photoData[0], foto_id: photoData[0].id, mensagem: 'Foto registrada com sucesso.' });
}

module.exports = async function adminMutations(req, res) {
  const origin = req.headers.origin;
  if (!applyCors(req, res)) return json(res, 403, { error: 'Origem não autorizada.' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método não permitido.' });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Serviço administrativo não configurado.' });
  const auth = await authenticate(req, supabaseUrl, serviceRoleKey);
  if (auth.error) return json(res, auth.error[0], { error: auth.error[1] });
  const body = parseBody(req) || {};
  try {
    if (body.action === 'create-gallery') return await createGallery(req, res, supabaseUrl, serviceRoleKey, body);
    if (body.action === 'resolve-gallery') return await resolveGallery(req, res, supabaseUrl, serviceRoleKey, body);
    if (body.action === 'prepare-upload') return await prepareUpload(req, res, supabaseUrl, serviceRoleKey, body);
    if (body.action === 'reorder-photos') return await reorderPhotos(req, res, supabaseUrl, serviceRoleKey, body);
    if (body.action === 'finalize-photo') return await finalizePhoto(req, res, supabaseUrl, serviceRoleKey, body);
    if (body.action === 'delete-gallery') return await deleteGallery(req, res, supabaseUrl, serviceRoleKey, body);
    return json(res, 400, { error: 'Operação administrativa inválida.' });
  } catch (error) {
    console.error('Admin mutation error:', error);
    return json(res, 502, { error: 'Serviço administrativo indisponível.' });
  }
};
