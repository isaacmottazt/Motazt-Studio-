/**
 * ADMIN - GERENCIADOR DE GALERIAS PRIVADAS
 * Motaz Studio
 *
 * Permite:
 * - Listar todas as galerias
 * - Ver fotos de cada galeria
 * - Ativar/Desativar galerias
 * - Alterar duração (dias até expiração)
 * - Contar corretamente as fotos
 * - Identificar galerias pelo primeiro nome do cliente
 */

const SUPABASE_URL = "https://tbwmsgztpyyratambgqs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";
const adminClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== INICIALIZAÇÃO =====

async function iniciar() {
    await carregarGalerias();
}

window.addEventListener('DOMContentLoaded', iniciar);

// ===== CARREGAR E LISTAR GALERIAS =====

async function carregarGalerias() {
    try {
        // Buscar todos os álbuns privados
        const { data: galerias, error } = await adminClient
            .from('galerias')
            .select(`
                id,
                status,
                senha,
                data_criacao,
                data_expiracao,
                cliente_nome,
                cliente_email,
                total_fotos
            `)
            .order('data_criacao', { ascending: false });

        if (error) throw error;

        if (!galerias || galerias.length === 0) {
            document.getElementById('listaGalerias').style.display = 'none';
            document.getElementById('galeriaVazia').style.display = 'block';
            return;
        }

        document.getElementById('listaGalerias').style.display = 'grid';
        document.getElementById('galeriaVazia').style.display = 'none';

        const galeriasComCliente = galerias.map(g => ({
            ...g,
            cliente_nome: g.cliente_nome || 'Desconhecido',
            cliente_email: g.cliente_email || ''
        }));

        // Contar fotos corretamente para cada galeria
        const galeriasComContagem = await Promise.all(
            galeriasComCliente.map(async (g) => {
                const { count, error: errCount } = await adminClient
                    .from('fotos')
                    .select('id', { count: 'exact', head: true })
                    .eq('galeria_id', g.id);

                if (errCount) {
                    console.error('Erro ao contar fotos:', errCount);
                    return { ...g, contagem_fotos: g.total_fotos || 0 };
                }

                return { ...g, contagem_fotos: count || 0 };
            })
        );

        renderizarGalerias(galeriasComContagem);

    } catch (erro) {
        console.error('Erro ao carregar galerias:', erro);
        mostrarMensagem(`Erro: ${erro.message}`, 'erro');
    }
}

// ===== RENDERIZAR GALERIAS =====

async function renderizarGalerias(galerias) {
    const container = document.getElementById('listaGalerias');
    container.innerHTML = '';

    for (const galeria of galerias) {
        const primeiroNome = extrairPrimeiroNome(galeria.cliente_nome);
        const status = determinarStatus(galeria);
        const diasRestantes = calcularDiasRestantes(galeria.data_expiracao);
        
        // Buscar fotos preview
        const { data: fotos } = await adminClient
            .from('fotos')
            .select('id, arquivo_preview')
            .eq('galeria_id', galeria.id)
            .limit(3);

        const fotosPreview = fotos || [];

        const card = document.createElement('div');
        card.className = 'galeria-card';
        card.innerHTML = `
            <div class="galeria-header">
                <div class="galeria-nome">${primeiroNome}</div>
                <span class="galeria-status ${status.classe}">${status.texto}</span>
            </div>

            <div class="galeria-info">
                <div class="info-item">
                    <span class="info-label">Fotos</span>
                    <span class="info-value">${galeria.contagem_fotos} foto(s)</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Criada em</span>
                    <span class="info-value">${formatarData(galeria.data_criacao)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Vence em</span>
                    <span class="info-value">${formatarData(galeria.data_expiracao)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Dias restantes</span>
                    <span class="info-value">${diasRestantes}</span>
                </div>
            </div>

            ${fotosPreview.length > 0 ? `
                <div class="galeria-fotos-preview">
                    ${fotosPreview.map(f => `
                        <div class="foto-thumb">
                            <img src="${f.arquivo_preview}" alt="Foto" loading="lazy">
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="fotos-vazio">Sem fotos ainda</div>
            `}

            <div class="galeria-controles">
                <!-- Status -->
                <div class="controle-group">
                    <span class="controle-label">Status da Galeria</span>
                    <div class="toggle-status">
                        <button class="toggle-btn ${galeria.status === 'ativa' ? 'ativo' : ''}" 
                                onclick="mudarStatus('${galeria.id}', 'ativa')">
                            Ativa
                        </button>
                        <button class="toggle-btn ${galeria.status === 'inativa' ? 'ativo' : ''}" 
                                onclick="mudarStatus('${galeria.id}', 'inativa')">
                            Inativa
                        </button>
                    </div>
                </div>

                <!-- Duração -->
                <div class="controle-group">
                    <span class="controle-label">Duração (dias)</span>
                    <div class="controle-row">
                        <input type="number" min="1" max="365" value="${diasRestantes}" 
                               id="dias-${galeria.id}" placeholder="Dias">
                        <button class="btn btn-primary btn-pequeno" 
                                onclick="atualizarDuracao('${galeria.id}')">
                            Atualizar
                        </button>
                    </div>
                </div>
            </div>

            <div class="galeria-acoes">
                <button class="btn btn-primary" onclick="verFotos('${galeria.id}', '${primeiroNome}')">
                    Ver Fotos (${galeria.contagem_fotos})
                </button>
                <button class="btn btn-secondary" onclick="copiarSenha('${galeria.senha}')">
                    Copiar senha
                </button>
            </div>
        `;

        container.appendChild(card);
    }
}

// ===== FUNÇÕES UTILITÁRIAS =====

function extrairPrimeiroNome(nomeCompleto) {
    if (!nomeCompleto) return 'Cliente';
    return nomeCompleto.split(' ')[0];
}

function determinarStatus(galeria) {
    if (galeria.status === 'inativa') {
        return { texto: 'Desativada', classe: 'inativa' };
    }

    const agora = new Date();
    const expira = new Date(galeria.data_expiracao);

    if (agora > expira) {
        return { texto: 'Expirada', classe: 'expirada' };
    }

    return { texto: 'Ativa', classe: 'ativa' };
}

function calcularDiasRestantes(dataExpiracao) {
    const agora = new Date();
    const expira = new Date(dataExpiracao);
    const diff = expira - agora;
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return Math.max(0, dias);
}

function formatarData(dataISO) {
    if (!dataISO) return '—';
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    });
}

function mostrarMensagem(texto, tipo = 'sucesso') {
    const msg = document.getElementById('msgGeral');
    msg.textContent = texto;
    msg.className = `mensagem ${tipo} mostrar`;
    
    setTimeout(() => {
        msg.classList.remove('mostrar');
    }, 4000);
}

// ===== AÇÕES =====

async function mudarStatus(galeriaId, novoStatus) {
    try {
        const { error } = await adminClient
            .from('galerias')
            .update({ status: novoStatus })
            .eq('id', galeriaId);

        if (error) throw error;

        mostrarMensagem(
            novoStatus === 'ativa' ? 'Galeria ativada' : 'Galeria desativada',
            'sucesso'
        );

        await carregarGalerias();

    } catch (erro) {
        console.error('Erro ao mudar status:', erro);
        mostrarMensagem(`Erro: ${erro.message}`, 'erro');
    }
}

async function atualizarDuracao(galeriaId) {
    try {
        const dias = parseInt(document.getElementById(`dias-${galeriaId}`).value);

        if (!dias || dias < 1 || dias > 365) {
            mostrarMensagem('Insira um número entre 1 e 365 dias', 'erro');
            return;
        }

        const novaExpiracao = new Date();
        novaExpiracao.setDate(novaExpiracao.getDate() + dias);

        const { error } = await adminClient
            .from('galerias')
            .update({ data_expiracao: novaExpiracao.toISOString() })
            .eq('id', galeriaId);

        if (error) throw error;

        mostrarMensagem(`Galeria válida por ${dias} dia(s)`, 'sucesso');

        await carregarGalerias();

    } catch (erro) {
        console.error('Erro ao atualizar duração:', erro);
        mostrarMensagem(`Erro: ${erro.message}`, 'erro');
    }
}

async function verFotos(galeriaId, nomeCliente) {
    try {
        const { data: fotos, error } = await adminClient
            .from('fotos')
            .select('id, arquivo_full, data_upload')
            .eq('galeria_id', galeriaId)
            .order('data_upload', { ascending: false });

        if (error) throw error;

        const modal = document.getElementById('modalFotos');
        const titulo = document.getElementById('modalTitulo');
        const grid = document.getElementById('modalFotosGrid');

        titulo.textContent = `Fotos de ${nomeCliente} (${fotos?.length || 0})`;
        grid.innerHTML = '';

        if (!fotos || fotos.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--texto-mudo); padding: 40px;">Nenhuma foto nesta galeria</div>';
            modal.classList.add('ativo');
            return;
        }

        fotos.forEach(foto => {
            const card = document.createElement('div');
            card.className = 'foto-card';
            card.innerHTML = `<img src="${foto.arquivo_full}" alt="Foto" loading="lazy">`;
            grid.appendChild(card);
        });

        modal.classList.add('ativo');

    } catch (erro) {
        console.error('Erro ao carregar fotos:', erro);
        mostrarMensagem(`Erro: ${erro.message}`, 'erro');
    }
}

function fecharModalFotos() {
    document.getElementById('modalFotos').classList.remove('ativo');
}

// Fechar modal ao clicar fora
document.addEventListener('click', (e) => {
    const modal = document.getElementById('modalFotos');
    if (e.target === modal) {
        fecharModalFotos();
    }
});

function copiarSenha(senha) {
    navigator.clipboard.writeText(senha).then(() => {
        mostrarMensagem('Senha copiada para a área de transferência', 'sucesso');
    }).catch(erro => {
        console.error('Erro ao copiar:', erro);
        mostrarMensagem('Erro ao copiar senha', 'erro');
    });
}

async function fazerLogout() {
    try {
        await adminClient.auth.signOut();
    } catch (e) {
        console.error('Erro ao logout:', e);
    }
    window.location.href = 'index.html';
}
