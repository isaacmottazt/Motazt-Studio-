/**
 * SISTEMA COMPLETO DE GALERIAS PRIVADAS
 * Motaz Studio
 *
 * Funciona em 3 momentos:
 * 1. Admin cria uma galeria privada manualmente com nome, telefone e título
 * 2. Admin faz upload de fotos → vincula à galeria específica
 * 3. Cliente acessa galeria-privada.html?id=xyz → vê só suas fotos
 *
 * Requer supabase-js via CDN:
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */

const SUPABASE_URL = "https://tbwmsgztpyyratambgqs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid21zZ3p0cHl5cmF0YW1iZ3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTU3OTIsImV4cCI6MjA5Mzk3MTc5Mn0.Rnq4IxsvidlkyKM23CzVGcdTPo1xarEmkIbEVdrhFUQ";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 1. CRIAR GALERIA PRIVADA MANUALMENTE =====

/**
 * Cria uma galeria privada manualmente pelo painel administrativo.
 *
 * @param {string} clienteNome - Nome do cliente
 * @param {string} clienteTelefone - Telefone do cliente
 * @param {string} titulo - Título da galeria (nome do evento/ensaio), exibido para o cliente
 * @returns {Promise} { galeria_id, mensagem }
 */
async function criarGaleria(clienteNome, clienteTelefone, titulo = '') {
    try {
        const dataCriacao = new Date();
        const dataExpiracao = new Date(dataCriacao);
        dataExpiracao.setDate(dataExpiracao.getDate() + 30);

        const { data, error } = await supabaseClient
            .from('galerias')
            .insert({
                cliente_nome: clienteNome,
                cliente_telefone: clienteTelefone,
                titulo: titulo || null,
                status: 'ativa',
                total_fotos: 0,
                data_criacao: dataCriacao.toISOString(),
                data_expiracao: dataExpiracao.toISOString()
            })
            .select('id')
            .single();

        if (error) throw error;
        if (!data?.id) throw new Error('O banco não retornou o ID do álbum criado.');

        return {
            sucesso: true,
            galeria_id: data.id,
            mensagem: 'Álbum criado! Envie o link ao cliente pelo WhatsApp.'
        };

    } catch (erro) {
        console.error('Erro ao criar galeria:', erro);
        throw erro;
    }
}

// ===== 2. VALIDAR SE A GALERIA EXISTE E ESTÁ ATIVA =====

/**
 * Valida se a galeria existe, está ativa e não expirou
 * Chamado quando o cliente acessa galeria-privada.html?id=xyz
 *
 * @param {string} galeriaId - ID da galeria (do ?id=xyz na URL)
 * @returns {Promise<object|null>} os dados da galeria se válida, ou null
 *
 * @example
 * const galeria = await validarGaleria('123e4567');
 * if (galeria) {
 *   // mostra as fotos
 * } else {
 *   // mostra "galeria não encontrada"
 * }
 */
async function validarGaleria(galeriaId) {
    try {
        const identificador = String(galeriaId || '').trim();
        if (!identificador) return null;

        let consulta = supabaseClient
            .from('galerias')
            .select('id, codigo_curto, cliente_nome, titulo, data_expiracao, status, total_fotos');

        const pareceUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identificador);
        consulta = pareceUuid
            ? consulta.eq('id', identificador)
            : consulta.ilike('codigo_curto', identificador);

        const { data: galeria, error } = await consulta.maybeSingle();

        if (error) {
            console.error('Galeria não encontrada:', error);
            return null;
        }

        if (!galeria) return null;

        // Verificar se expirou
        if (galeria.data_expiracao && new Date() > new Date(galeria.data_expiracao)) {
            console.log('Galeria expirada');
            return null;
        }

        // Verificar se foi bloqueada
        if (galeria.status !== 'ativa') {
            console.log('Galeria bloqueada ou inativa');
            return null;
        }

        return galeria;

    } catch (erro) {
        console.error('Erro ao validar galeria:', erro);
        return null;
    }
}

// ===== 3. LISTAR FOTOS DA GALERIA =====

/**
 * Carrega todas as fotos de uma galeria
 * Chamado depois que a galeria foi validada
 *
 * @param {string} galeriaId - ID da galeria
 * @returns {Promise<Array>} Array de fotos ordenadas por posição
 *
 * @example
 * const fotos = await listarFotosDaGaleria('123e4567');
 * fotos.forEach(foto => {
 *   console.log(foto.arquivo_preview); // URL da imagem
 *   console.log(foto.favorita); // true/false
 * });
 */
async function listarFotosDaGaleria(galeriaId) {
    try {
        const { data: fotos, error } = await supabaseClient
            .from('fotos')
            .select('id, arquivo_preview, arquivo_full, posicao, favorita')
            .eq('galeria_id', galeriaId)
            .order('posicao', { ascending: true });

        if (error) throw error;
        return fotos || [];

    } catch (erro) {
        console.error('Erro ao listar fotos:', erro);
        return [];
    }
}

// ===== 4. UPLOAD DE FOTOS (admin) =====

/**
 * Admin faz upload de foto para uma galeria específica
 * Armazena no Supabase Storage e registra na tabela 'fotos'
 *
 * @param {string} galeriaId - ID da galeria
 * @param {File} arquivo - Arquivo da imagem
 * @param {boolean} temMarcaDagua - se deve ter marca d'água (default: true)
 * @returns {Promise} { foto_id, url_preview, url_full }
 */
async function uploadFoto(galeriaId, arquivo, temMarcaDagua = true) {
    try {
        const tiposPermitidos = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
        const limiteBytes = 25 * 1024 * 1024;
        if (!arquivo || !tiposPermitidos.has(arquivo.type)) {
            throw new Error('Tipo de imagem não permitido. Use JPG, PNG, WebP ou GIF.');
        }
        if (arquivo.size > limiteBytes) {
            throw new Error('A imagem excede o limite de 25 MB.');
        }
        const idSeguro = String(galeriaId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
        if (!idSeguro) throw new Error('ID de galeria inválido.');
        const nomeSeguro = String(arquivo.name || 'imagem').split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'imagem';
        const identificador = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const nomeArquivo = `${idSeguro}/${identificador}-${nomeSeguro}`;

        // Upload para Storage do Supabase
        const { data: uploadData, error: erroUpload } = await supabaseClient
            .storage
            .from('fotos') // bucket chamado 'fotos'
            .upload(nomeArquivo, arquivo);

        if (erroUpload) {
            throw new Error(`Erro no upload: ${erroUpload.message}`);
        }

        // Obter URL pública da foto
        const { data: { publicUrl } } = supabaseClient
            .storage
            .from('fotos')
            .getPublicUrl(nomeArquivo);

        // Calcular a próxima posição sequencial (evita estourar o
        // tipo "integer" do banco, que Date.now() ultrapassaria)
        const { count: totalAtual } = await supabaseClient
            .from('fotos')
            .select('id', { count: 'exact', head: true })
            .eq('galeria_id', galeriaId);

        const proximaPosicao = (totalAtual || 0) + 1;

        // Registrar na tabela 'fotos'
        const { data: fotoRecord, error: erroFoto } = await supabaseClient
            .from('fotos')
            .insert({
                galeria_id: galeriaId,
                arquivo_original: nomeArquivo,
                arquivo_preview: publicUrl, // pode ser redimensionado depois
                arquivo_full: publicUrl,
                tem_marca_agua: temMarcaDagua,
                posicao: proximaPosicao
            })
            .select();

        if (erroFoto) throw erroFoto;

        // Atualizar contagem de fotos na galeria
        const { count: totalFotos } = await supabaseClient
            .from('fotos')
            .select('id', { count: 'exact', head: true })
            .eq('galeria_id', galeriaId);

        await supabaseClient
            .from('galerias')
            .update({ total_fotos: totalFotos || 0 })
            .eq('id', galeriaId);

        return {
            sucesso: true,
            foto_id: fotoRecord[0].id,
            url_preview: publicUrl,
            url_full: publicUrl,
            mensagem: 'Foto enviada com sucesso!'
        };

    } catch (erro) {
        console.error('Erro ao fazer upload:', erro);
        throw erro;
    }
}

// ===== 5. MARCAR/DESMARCAR FAVORITA =====

/**
 * Cliente marca uma foto como favorita
 *
 * @param {string} fotoId - ID da foto
 * @param {boolean} favorita - true para marcar, false para desmarcar
 * @returns {Promise<boolean>} sucesso?
 *
 * @example
 * await marcarFavorita('abc123', true);
 * // Depois pode filtrar só favoritas
 */
async function marcarFavorita(fotoId, favorita = true) {
    try {
        const { error } = await supabaseClient
            .from('fotos')
            .update({ favorita: favorita })
            .eq('id', fotoId);

        if (error) throw error;
        return true;

    } catch (erro) {
        console.error('Erro ao marcar favorita:', erro);
        return false;
    }
}

/**
 * Lista só as fotos marcadas como favoritas de uma galeria
 *
 * @param {string} galeriaId - ID da galeria
 * @returns {Promise<Array>} Fotos favoritas
 *
 * @example
 * const favoritas = await listarFavoritasDaGaleria('123e4567');
 */
async function listarFavoritasDaGaleria(galeriaId) {
    try {
        const { data: fotos, error } = await supabaseClient
            .from('fotos')
            .select('*')
            .eq('galeria_id', galeriaId)
            .eq('favorita', true)
            .order('posicao', { ascending: true });

        if (error) throw error;
        return fotos || [];

    } catch (erro) {
        console.error('Erro ao listar favoritas:', erro);
        return [];
    }
}

// ===== 6. DELETAR FOTO =====

/**
 * Admin deleta uma foto da galeria
 *
 * @param {string} fotoId - ID da foto
 * @param {string} nomeArquivoStorage - nome do arquivo no Storage
 * @returns {Promise<boolean>} sucesso?
 */
async function deletarFoto(fotoId, nomeArquivoStorage) {
    try {
        // Deletar do Storage
        await supabaseClient.storage
            .from('fotos')
            .remove([nomeArquivoStorage]);

        // Deletar do banco
        const { error } = await supabaseClient
            .from('fotos')
            .delete()
            .eq('id', fotoId);

        if (error) throw error;
        return true;

    } catch (erro) {
        console.error('Erro ao deletar foto:', erro);
        return false;
    }
}

// ===== 7. ATUALIZAR STATUS DA GALERIA =====

/**
 * Admin pode bloquear/desbloquear uma galeria ou alterar seu status
 *
 * @param {string} galeriaId - ID da galeria
 * @param {string} novoStatus - 'ativa', 'bloqueada', 'expirada'
 * @returns {Promise<boolean>} sucesso?
 *
 * @example
 * await atualizarStatusGaleria('123e4567', 'bloqueada');
 */
async function atualizarStatusGaleria(galeriaId, novoStatus) {
    try {
        const { error } = await supabaseClient
            .from('galerias')
            .update({ status: novoStatus })
            .eq('id', galeriaId);

        if (error) throw error;
        return true;

    } catch (erro) {
        console.error('Erro ao atualizar status:', erro);
        return false;
    }
}

// ===== 8. OBTER INFO DA GALERIA =====

/**
 * Pega informações gerais da galeria (nome cliente, data, total de fotos)
 *
 * @param {string} galeriaId - ID da galeria
 * @returns {Promise<object>} { total_fotos, data_criacao, data_expiracao, status }
 */
async function obterInfoGaleria(galeriaId) {
    try {
        const { data: galeria, error } = await supabaseClient
            .from('galerias')
            .select('id, cliente_nome, titulo, data_expiracao, status, total_fotos')
            .eq('id', galeriaId)
            .single();

        if (error) throw error;

        // Contar fotos
        const { data: fotos } = await supabaseClient
            .from('fotos')
            .select('id')
            .eq('galeria_id', galeriaId);

        return {
            galeria_id: galeria.id,
            total_fotos: fotos?.length || 0,
            data_criacao: galeria.data_criacao,
            data_expiracao: galeria.data_expiracao,
            status: galeria.status,
            diasRestantes: Math.ceil(
                (new Date(galeria.data_expiracao) - new Date()) / (1000 * 60 * 60 * 24)
            )
        };

    } catch (erro) {
        console.error('Erro ao obter info da galeria:', erro);
        return null;
    }
}

// ===== EXPORTAR PARA USO =====
// Deixa disponível globalmente no window
window.GaleriaPrivada = {
    criarGaleria,
    validarGaleria,
    listarFotosDaGaleria,
    uploadFoto,
    marcarFavorita,
    listarFavoritasDaGaleria,
    deletarFoto,
    atualizarStatusGaleria,
    obterInfoGaleria
};
