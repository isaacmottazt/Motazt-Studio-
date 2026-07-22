/**
 * SISTEMA COMPLETO DE GALERIAS PRIVADAS
 * Motazt Studio
 *
 * Funciona em 3 momentos:
 * 1. Admin confirma agendamento → gera galeria + senha única
 * 2. Admin faz upload de fotos → vincula à galeria específica
 * 3. Cliente acessa galeria-privada.html?id=xyz → digita senha → vê só suas fotos
 *
 * Requer supabase-js via CDN:
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */

const SUPABASE_URL = "https://tbwmsgztpyyratambgqs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 1. CRIAR GALERIA (chamado quando admin confirma agendamento) =====

/**
 * Gera uma senha aleatória única para a galeria
 * @returns {string} Senha de 8 caracteres (ex: a3f5d2e1)
 */
function gerarSenhaAleatoria() {
    return Math.random().toString(36).substring(2, 10);
}

/**
 * Cria uma galeria privada para um agendamento
 * Chamado no painel admin quando confirma/aceita um agendamento
 *
 * @param {string} agendamentoId - ID do agendamento (UUID)
 * @param {string} clienteNome - Nome do cliente (para referência)
 * @param {string} clienteEmail - Email do cliente (para enviar a senha)
 * @returns {Promise} { galeria_id, senha, mensagem }
 *
 * @example
 * const resultado = await criarGaleriaParaAgendamento(
 *   '123e4567-e89b-12d3-a456-426614174000',
 *   'João Silva',
 *   'joao@email.com'
 * );
 * console.log(resultado.senha); // 'a3f5d2e1'
 * // Enviar por email ou WhatsApp: "Sua galeria: https://site.com/galeria-privada.html?id=xyz"
 * // Senha: a3f5d2e1
 */
async function criarGaleriaParaAgendamento(agendamentoId, clienteNome, clienteEmail) {
    try {
        const senhaUnica = gerarSenhaAleatoria();
        const dataExpiracao = new Date();
        dataExpiracao.setDate(dataExpiracao.getDate() + 30); // válida por 30 dias

        const { data, error } = await supabaseClient
            .from('galerias')
            .insert({
                agendamento_id: agendamentoId,
                senha: senhaUnica,
                data_criacao: new Date().toISOString(),
                data_expiracao: dataExpiracao.toISOString(),
                status: 'ativa',
                total_fotos: 0
            })
            .select();

        if (error) throw error;

        const galeriaId = data[0].id;

        // TODO: enviar email/WhatsApp para o cliente com a senha
        console.log(`📧 ENVIAR PARA ${clienteEmail}:
---
Olá ${clienteNome}!

Sua galeria privada está pronta!

🔗 Link: https://seusite.com/galeria-privada.html?id=${galeriaId}
🔐 Senha: ${senhaUnica}

Suas fotos estarão disponíveis por 30 dias.
---`);

        return {
            sucesso: true,
            galeria_id: galeriaId,
            senha: senhaUnica,
            mensagem: `Galeria criada! Envie a senha "${senhaUnica}" ao cliente por email/WhatsApp.`
        };

    } catch (erro) {
        console.error('Erro ao criar galeria:', erro);
        throw erro;
    }
}

// ===== 2. VALIDAR ACESSO (cliente digita a senha) =====

/**
 * Valida a senha de acesso à galeria
 * Chamado quando cliente digita a senha em galeria-privada.html
 *
 * @param {string} galeriaId - ID da galeria (do ?id=xyz na URL)
 * @param {string} senhaDigitada - Senha que o cliente digitou
 * @returns {Promise<boolean>} true se válida, false se inválida
 *
 * @example
 * const valida = await validarSenhaGaleria('123e4567', 'a3f5d2e1');
 * if (valida) {
 *   // mostra as fotos
 * } else {
 *   // mostra "senha incorreta"
 * }
 */
async function validarSenhaGaleria(galeriaId, senhaDigitada) {
    try {
        const { data: galeria, error } = await supabaseClient
            .from('galerias')
            .select('*')
            .eq('id', galeriaId)
            .single();

        if (error) {
            console.error('Galeria não encontrada:', error);
            return false;
        }

        if (!galeria) return false;

        // Verificar se expirou
        if (galeria.data_expiracao && new Date() > new Date(galeria.data_expiracao)) {
            console.log('Galeria expirada');
            return false;
        }

        // Verificar se foi bloqueada
        if (galeria.status !== 'ativa') {
            console.log('Galeria bloqueada ou inativa');
            return false;
        }

        // Comparar senha em texto simples
        // ⚠️ Ver aviso de segurança em supabase-integration.js
        return galeria.senha === senhaDigitada;

    } catch (erro) {
        console.error('Erro ao validar senha:', erro);
        return false;
    }
}

// ===== 3. LISTAR FOTOS DA GALERIA =====

/**
 * Carrega todas as fotos de uma galeria
 * Chamado quando cliente já validou a senha
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
            .select('*')
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
 *
 * @example
 * const input = document.getElementById('fotoInput');
 * const resultado = await uploadFoto(galeriaId, input.files[0], true);
 * console.log(resultado.url_preview); // URL para mostrar no preview
 */
async function uploadFoto(galeriaId, arquivo, temMarcaDagua = true) {
    try {
        // Gerar nome único para o arquivo
        const timestamp = Date.now();
        const nomeArquivo = `${galeriaId}/${timestamp}-${arquivo.name}`;

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
            .select('*')
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
    criarGaleriaParaAgendamento,
    validarSenhaGaleria,
    listarFotosDaGaleria,
    uploadFoto,
    marcarFavorita,
    listarFavoritasDaGaleria,
    deletarFoto,
    atualizarStatusGaleria,
    obterInfoGaleria
};
