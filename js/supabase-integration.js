/**
 * INTEGRAÇÃO COM SUPABASE — VERSÃO CLIENT-SIDE
 * Motazt Studio
 *
 * Adaptado do original (Node.js/backend) para rodar direto no navegador,
 * já que o site é hospedado em Cloudflare Workers como HTML/JS/CSS estático,
 * sem servidor Node próprio.
 *
 * ⚠️ AVISO DE SEGURANÇA IMPORTANTE:
 * O original usava bcrypt para hash de senha de galeria — isso só é seguro
 * rodando em um servidor, pois bcrypt não deve rodar no navegador (exposto
 * ao usuário, lento em JS puro, e sem segredo real de servidor).
 * Nesta versão client-side, a "senha" da galeria é validada comparando
 * texto simples salvo no Supabase. Isso é aceitável para uma proteção
 * leve (evitar acesso casual), mas NÃO é criptograficamente seguro:
 * qualquer pessoa com acesso ao projeto Supabase (ou que inspecione as
 * requisições) pode ver a senha em texto puro.
 * Se precisar de segurança forte, a validação de senha da galeria deve
 * ser feita em uma Cloudflare Worker/Function separada (com segredo do
 * lado do servidor), não neste arquivo.
 *
 * Requer supabase-js via CDN antes deste script:
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * <script src="js/supabase-integration.js"></script>
 */

// ===== CONFIGURAÇÃO =====
// Reaproveite as mesmas credenciais já usadas em form.js
const SUPABASE_URL = "https://tbwmsgztpyyratambgqs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== SCHEMA SQL DE REFERÊNCIA =====
// Rode isso manualmente no SQL editor do Supabase (não executa no navegador).
const SCHEMA_SQL_REFERENCIA = `
-- Tabela: clientes
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT NOT NULL,
  data_criacao TIMESTAMP DEFAULT now(),
  data_ultimo_agendamento TIMESTAMP,
  total_agendamentos INT DEFAULT 0
);

-- Tabela: galerias
CREATE TABLE galerias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID,
  cliente_id UUID REFERENCES clientes(id),
  senha TEXT NOT NULL, -- texto simples (ver aviso de segurança no topo do arquivo)
  total_fotos INT DEFAULT 0,
  data_criacao TIMESTAMP DEFAULT now(),
  data_expiracao TIMESTAMP,
  status TEXT DEFAULT 'ativa' -- ativa, expirada, bloqueada
);

-- Tabela: fotos
CREATE TABLE fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  galeria_id UUID REFERENCES galerias(id) ON DELETE CASCADE,
  arquivo_original TEXT NOT NULL,
  arquivo_thumb TEXT,
  arquivo_preview TEXT,
  arquivo_full TEXT,
  tem_marca_agua BOOLEAN DEFAULT true,
  favorita BOOLEAN DEFAULT false,
  posicao INT,
  data_upload TIMESTAMP DEFAULT now()
);

-- Tabela: lista_espera
CREATE TABLE lista_espera (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id),
  tipo_ensaio TEXT NOT NULL,
  data_desejada DATE NOT NULL,
  posicao INT NOT NULL,
  status TEXT DEFAULT 'aguardando', -- aguardando, contatado, agendado, expirado
  data_insercao TIMESTAMP DEFAULT now(),
  data_notificacao TIMESTAMP
);

-- Tabela: cancelamentos
CREATE TABLE cancelamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID,
  cliente_id UUID REFERENCES clientes(id),
  data_cancelamento TIMESTAMP DEFAULT now(),
  horas_antes_agendamento INT,
  multa_percentual INT,
  valor_original DECIMAL(10,2),
  valor_multa DECIMAL(10,2),
  valor_reembolso DECIMAL(10,2),
  metodo_reembolso TEXT,
  motivo TEXT
);

-- Tabela: config_horarios
CREATE TABLE config_horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_ensaio TEXT UNIQUE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  duracao_minutos INT NOT NULL,
  intervalo_minutos INT NOT NULL,
  dias_semana TEXT[],
  prazo_cancelamento_horas INT DEFAULT 24,
  multa_cancelamento_percent INT DEFAULT 30,
  ativo BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT now()
);
`;

// ===== FUNÇÕES DE GALERIA (client-side) =====

/**
 * Gera senha aleatória simples para uma nova galeria
 */
function gerarSenhaAleatoria() {
    return Math.random().toString(36).substring(2, 10);
}

/**
 * Cria galeria para um agendamento (chamar a partir do painel admin)
 */
async function criarGaleria(agendamentoId, totalFotos) {
    const senha = gerarSenhaAleatoria();

    const { data, error } = await supabaseClient
        .from('galerias')
        .insert({
            agendamento_id: agendamentoId,
            senha: senha,
            total_fotos: totalFotos,
            data_expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select();

    if (error) {
        console.error('Erro ao criar galeria:', error);
        throw error;
    }

    return {
        galeria_id: data[0].id,
        senha: senha // enviar ao cliente por email/WhatsApp, fora deste arquivo
    };
}

/**
 * Valida acesso à galeria por ID + senha em texto simples
 * (ver aviso de segurança no topo do arquivo)
 */
async function validarAcessoGaleria(galeriaId, senhaDigitada) {
    const { data: galeria, error } = await supabaseClient
        .from('galerias')
        .select('*')
        .eq('id', galeriaId)
        .single();

    if (error || !galeria) return false;

    if (galeria.data_expiracao && new Date() > new Date(galeria.data_expiracao)) {
        return false;
    }

    return galeria.senha === senhaDigitada;
}

/**
 * Marca/desmarca foto como favorita
 */
async function marcarFavorita(fotoId, favorita = true) {
    const { data, error } = await supabaseClient
        .from('fotos')
        .update({ favorita: favorita })
        .eq('id', fotoId)
        .select();

    if (error) throw error;
    return data[0];
}

// ===== ESTATÍSTICAS PARA O DASHBOARD (admin) =====

async function obterEstatisticas() {
    const hoje = new Date().toISOString().split('T')[0];

    const { data: agendamentosHoje } = await supabaseClient
        .from('agendamentos')
        .select('*')
        .eq('status', 'confirmado')
        .gte('data', hoje);

    const { data: listaEspera } = await supabaseClient
        .from('lista_espera')
        .select('*')
        .eq('status', 'aguardando');

    const { data: cancelamentos } = await supabaseClient
        .from('cancelamentos')
        .select('*')
        .gte('data_cancelamento', hoje);

    return {
        agendamentos_hoje: agendamentosHoje?.length || 0,
        total_na_fila: listaEspera?.length || 0,
        cancelamentos_hoje: cancelamentos?.length || 0,
        receita_cancelada: cancelamentos?.reduce((soma, c) => soma + (c.valor_multa || 0), 0) || 0
    };
}
