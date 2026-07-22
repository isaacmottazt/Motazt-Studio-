/**
 * SISTEMA DE LISTA DE ESPERA, CANCELAMENTO E RATE LIMITING
 * Motazt Studio
 */

// ===== RATE LIMITING (Item #79) =====
class RateLimiter {
    constructor(maxAttempts = 5, timeWindowMs = 60000) {
        this.maxAttempts = maxAttempts;
        this.timeWindowMs = timeWindowMs;
        this.attempts = new Map(); // key: identificador (IP/userId), value: array de timestamps
    }

    /**
     * Verifica se a requisição pode ser permitida
     * @param {string} key - Identificador único (pode ser IP, userID, etc)
     * @returns {object} { allowed: boolean, remaining: number, resetTime: number }
     */
    isAllowed(key) {
        const now = Date.now();
        
        if (!this.attempts.has(key)) {
            this.attempts.set(key, []);
        }

        let timestamps = this.attempts.get(key);
        
        // Remove timestamps fora da janela de tempo
        timestamps = timestamps.filter(ts => now - ts < this.timeWindowMs);
        this.attempts.set(key, timestamps);

        if (timestamps.length >= this.maxAttempts) {
            const oldestTimestamp = timestamps[0];
            const resetTime = oldestTimestamp + this.timeWindowMs;
            
            return {
                allowed: false,
                remaining: 0,
                resetTime: resetTime,
                resetInSeconds: Math.ceil((resetTime - now) / 1000)
            };
        }

        // Registra nova tentativa
        timestamps.push(now);
        this.attempts.set(key, timestamps);

        return {
            allowed: true,
            remaining: this.maxAttempts - timestamps.length,
            resetTime: null,
            resetInSeconds: null
        };
    }

    /**
     * Reseta o contador para uma chave específica
     */
    reset(key) {
        this.attempts.delete(key);
    }

    /**
     * Limpa tentativas muito antigas (executar periodicamente)
     */
    cleanup() {
        const now = Date.now();
        for (let [key, timestamps] of this.attempts.entries()) {
            const filtered = timestamps.filter(ts => now - ts < this.timeWindowMs);
            if (filtered.length === 0) {
                this.attempts.delete(key);
            } else {
                this.attempts.set(key, filtered);
            }
        }
    }
}

// Instância global
const rateLimiter = new RateLimiter(5, 60000); // 5 tentativas por minuto

// ===== POLÍTICA DE CANCELAMENTO (Item #8) =====
class PoliticaCancelamento {
    /**
     * Calcula se é possível cancelar e qual multa será aplicada
     * @param {string} tipoEnsaio - Tipo de ensaio (casamento, individual, etc)
     * @param {Date} dataAgendamento - Data/hora do agendamento
     * @param {object} config - Configuração do tipo de ensaio
     */
    static calcularCancelamento(tipoEnsaio, dataAgendamento, config) {
        const agora = new Date();
        const horasAte = (dataAgendamento - agora) / (1000 * 60 * 60);

        config = config || {};
        const prazoMinimo = config.cancelamentoPrazo || 24; // horas
        const multaPercentual = config.cancelamentoMulta || 30; // %

        const resultado = {
            podesCancelar: horasAte >= prazoMinimo,
            horasAte: Math.max(0, Math.floor(horasAte)),
            minutosFaltando: Math.max(0, Math.floor((horasAte % 1) * 60)),
            prazoMinimo: prazoMinimo,
            multaPercentual: multaPercentual,
            priceDevolvido: 0,
            motivo: '',
            botoesCancelamento: []
        };

        if (resultado.podesCancelar) {
            resultado.motivo = `✓ Cancelamento permitido! Você pode cancelar até ${prazoMinimo}h antes do agendamento.`;
            resultado.botoesCancelamento = [
                { label: 'Cancelar com reembolso', tipo: 'reembolso', cor: 'verde' },
                { label: 'Reagendar para outra data', tipo: 'reagendar', cor: 'azul' },
                { label: 'Manter agendamento', tipo: 'manter', cor: 'cinza' }
            ];
        } else {
            resultado.motivo = `✗ Cancelamento não permitido. Faltam apenas ${resultado.horasAte}h ${resultado.minutosFaltando}m para o ensaio.`;
            resultado.multaPercentual = 100; // 100% de multa se cancelar fora do prazo
            resultado.botoesCancelamento = [
                { label: 'Cancelar (100% de multa)', tipo: 'cancelar-multa', cor: 'vermelho' },
                { label: 'Manter agendamento', tipo: 'manter', cor: 'cinza' }
            ];
        }

        return resultado;
    }

    /**
     * Processa o cancelamento
     */
    static processarCancelamento(agendamento, tipo, valor) {
        const agora = new Date();
        const data = new Date(agendamento.data);
        const horasAte = (data - agora) / (1000 * 60 * 60);
        const config = localStorage.getItem(`config_${agendamento.tipo}`);
        const multaPercentual = config ? JSON.parse(config).cancelamentoMulta : 30;

        let valorDevolvido = valor;
        
        if (horasAte < 24) {
            // Fora do prazo - aplica multa
            valorDevolvido = valor * (1 - multaPercentual / 100);
        }

        return {
            status: 'cancelado',
            dataCancel: agora,
            motivo: tipo,
            multaAplicada: valor - valorDevolvido,
            valorDevolvido: valorDevolvido,
            prazoDevolucao: '5-7 dias úteis'
        };
    }
}

// ===== LISTA DE ESPERA (Item #1) =====
class ListaEspera {
    constructor() {
        this.fila = JSON.parse(localStorage.getItem('listaEspera')) || [];
        this.notificacoes = JSON.parse(localStorage.getItem('notificacoesEspera')) || {};
    }

    /**
     * Adiciona cliente à lista de espera
     */
    adicionarALista(cliente) {
        const novaEntrada = {
            id: Date.now(),
            nome: cliente.nome,
            email: cliente.email,
            telefone: cliente.telefone,
            tipoEnsaio: cliente.tipoEnsaio,
            dataDesejada: cliente.dataDesejada,
            dataInsercao: new Date(),
            posicao: this.fila.length + 1,
            status: 'aguardando',
            notificado: false
        };

        this.fila.push(novaEntrada);
        this.salvar();

        // Enviar email de confirmação
        this.enviarEmailConfirmacao(novaEntrada);

        return novaEntrada;
    }

    /**
     * Quando um horário se libera, verifica se há clientes na espera
     */
    verificarDisponibilidade(tipoEnsaio, data, horario) {
        const candidatos = this.fila.filter(e => 
            e.tipoEnsaio === tipoEnsaio && 
            e.dataDesejada === data &&
            e.status === 'aguardando'
        );

        if (candidatos.length > 0) {
            const primeiro = candidatos[0];
            
            // Notificar cliente
            this.notificarClienteDisponivel(primeiro, data, horario);
            
            // Marcar como notificado
            primeiro.notificado = true;
            primeiro.dataNotificacao = new Date();
            primeiro.status = 'contatado';
            
            this.salvar();
            
            return primeiro;
        }

        return null;
    }

    /**
     * Remove da lista quando cliente agenda
     */
    removerDaLista(clienteId) {
        const index = this.fila.findIndex(e => e.id === clienteId);
        if (index > -1) {
            this.fila.splice(index, 1);
            this.reorganizarPosicoes();
            this.salvar();
        }
    }

    /**
     * Organiza posições na fila
     */
    reorganizarPosicoes() {
        this.fila.forEach((entrada, idx) => {
            entrada.posicao = idx + 1;
        });
    }

    /**
     * Envia email de confirmação para lista de espera
     */
    enviarEmailConfirmacao(entrada) {
        // Em produção, integrar com Sendgrid/AWS SES
        console.log(`📧 Email enviado para ${entrada.email}:
            
Você foi adicionado à lista de espera!

Tipo: ${entrada.tipoEnsaio}
Data Desejada: ${entrada.dataDesejada}
Posição na Fila: #${entrada.posicao}

Você será notificado assim que um horário se tornar disponível.
Prazo típico: 2-5 dias úteis.

Obrigado por escolher Motazt Studio!
        `);
    }

    /**
     * Notifica cliente que horário está disponível
     */
    notificarClienteDisponivel(entrada, data, horario) {
        console.log(`📱 SMS + EMAIL enviado para ${entrada.nome}:
        
🎉 Excelente notícia!

Um horário se tornou disponível para seu ensaio!

Tipo: ${entrada.tipoEnsaio}
Data: ${data}
Horário: ${horario}

Para confirmar, clique aqui: [link de confirmação]
Válido por 24 horas.

Abs,
Motazt Studio
        `);

        // Registrar notificação
        this.notificacoes[entrada.id] = {
            data: new Date(),
            data_ensaio: data,
            horario_ensaio: horario,
            status: 'enviado',
            lido: false
        };
        
        localStorage.setItem('notificacoesEspera', JSON.stringify(this.notificacoes));
    }

    /**
     * Retorna estatísticas da lista
     */
    obterEstatisticas() {
        return {
            totalNaFila: this.fila.length,
            aguardando: this.fila.filter(e => e.status === 'aguardando').length,
            contatados: this.fila.filter(e => e.status === 'contatado').length,
            tempoMedioEspera: this.calcularTempoMedioEspera(),
            proximaNotificacao: this.fila[0]?.dataDesejada || 'N/A'
        };
    }

    /**
     * Calcula tempo médio até agendamento
     */
    calcularTempoMedioEspera() {
        // Usar dados históricos
        return '3-4 dias'; // placeholder
    }

    /**
     * Salva em localStorage (em produção, seria Supabase)
     */
    salvar() {
        localStorage.setItem('listaEspera', JSON.stringify(this.fila));
    }

    /**
     * Obtém a lista completa
     */
    obterLista() {
        return this.fila;
    }

    /**
     * Remove entrada da lista
     */
    remover(id) {
        this.fila = this.fila.filter(e => e.id !== id);
        this.reorganizarPosicoes();
        this.salvar();
    }
}

// ===== UTILITÁRIOS PARA FORMULÁRIO =====

/**
 * Verifica rate limiting no envio de formulário
 */
function verificarRateLimiting(ipOuUserId) {
    const resultado = rateLimiter.isAllowed(ipOuUserId);

    if (!resultado.allowed) {
        const segundosRestantes = resultado.resetInSeconds;
        return {
            permitido: false,
            mensagem: `⏱️ Você tentou enviar muitos formulários. Aguarde ${segundosRestantes} segundos.`
        };
    }

    return {
        permitido: true,
        mensagem: `Você pode enviar ${resultado.remaining} formulários.`
    };
}

/**
 * Integra lista de espera ao formulário
 */
function processarAgendamento(dados) {
    // 1. Verifica Rate Limiting
    const rateLimitResult = verificarRateLimiting(dados.ip || 'anonimo');
    if (!rateLimitResult.permitido) {
        return { sucesso: false, mensagem: rateLimitResult.mensagem };
    }

    // 2. Tenta agendar
    const agendamento = {
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone,
        tipoEnsaio: dados.tipoEnsaio,
        data: dados.data,
        horario: dados.horario
    };

    // Simular verificação de disponibilidade
    const disponivel = verificarDisponibilidade(agendamento.tipoEnsaio, agendamento.data, agendamento.horario);

    if (disponivel) {
        // Agendou com sucesso
        return {
            sucesso: true,
            tipo: 'agendamento',
            mensagem: '✅ Agendamento confirmado!',
            id: Date.now()
        };
    } else {
        // Sem vagas - adicionar à lista de espera
        const listaEspera = new ListaEspera();
        const entrada = listaEspera.adicionarALista({
            nome: dados.nome,
            email: dados.email,
            telefone: dados.telefone,
            tipoEnsaio: dados.tipoEnsaio,
            dataDesejada: dados.data
        });

        return {
            sucesso: true,
            tipo: 'lista_espera',
            mensagem: `✅ Nenhuma vaga disponível nesta data. Você foi adicionado à lista de espera (posição #${entrada.posicao}). Você será notificado assim que um horário se tornar disponível.`,
            posicao: entrada.posicao,
            id: entrada.id
        };
    }
}

/**
 * Função stub para verificar disponibilidade
 */
function verificarDisponibilidade(tipo, data, horario) {
    // Em produção, consultar banco de dados de agendamentos
    return Math.random() > 0.3; // 70% de chance de estar disponível
}

/**
 * Permite cliente cancelar e escolher destino do reembolso
 */
function iniciarProcessoCancelamento(agendamentoId, tipoEnsaio, dataAgendamento, valor) {
    const config = JSON.parse(localStorage.getItem(`config_${tipoEnsaio}`));
    const politica = PoliticaCancelamento.calcularCancelamento(tipoEnsaio, new Date(dataAgendamento), config);

    return {
        agendamentoId: agendamentoId,
        politica: politica,
        valor: valor,
        opcoesPagamento: [
            { id: 'cartao', label: 'Crédito no Cartão', tempo: '5-7 dias' },
            { id: 'pix', label: 'Transferência PIX', tempo: '2-3 dias' },
            { id: 'creditoFuturo', label: 'Crédito para Futuro Agendamento', tempo: 'Imediato' }
        ]
    };
}

// ===== EXPORTAR PARA USO =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        RateLimiter,
        PoliticaCancelamento,
        ListaEspera,
        verificarRateLimiting,
        processarAgendamento,
        iniciarProcessoCancelamento
    };
}
