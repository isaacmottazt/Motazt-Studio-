/* ================================================
   CHATBOT MOTAZT STUDIO v4.0 — FINAL OTIMIZADO
   Menu Completo + Validações + Reinicio
   Estilo Padrão do Site + Instruções
================================================ */

(function() {
    const SUPABASE_URL = "https://tbwmsgztpyyratambgqs.supabase.co";
    const SUPABASE_KEY = "sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";
    
    const supabase = (typeof window.supabase !== 'undefined') 
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
        : null;

    // ============ CONFIGURAÇÕES ============
    const CONFIG = {
        WHATSAPP: '73981656986',
        WHATSAPP_LINK: 'https://wa.me/5573981656986',
        HORARIO_ABERTURA: '07:00',
        HORARIO_FECHAMENTO: '22:00',
        INTERVALO_MINUTOS: 30,
        TELEFONE_DISPLAY: '(73) 98165-6986',
        ENDERECO: 'Motazt Studio - Centro',
        EMAIL: 'contato@motazt.com.br'
    };

    // VALORES ÚNICOS PARA FOTÓGRAFO INICIANTE
    const VALORES = {
        'Ensaio Individual': 'R$ 150 a R$ 250',
        'Ensaio de Casal': 'R$ 200 a R$ 350',
        'Ensaio Familiar': 'R$ 250 a R$ 400',
        'Gestante': 'R$ 180 a R$ 280',
        'Casamento': 'R$ 500 a R$ 1.500',
        'Evento': 'R$ 400 a R$ 800',
        'Aniversário': 'R$ 200 a R$ 400',
        'Produção / Comercial': 'R$ 300 a R$ 600'
    };

    const DURACAO_ENSAIOS = {
        'Casamento': 240,
        'Ensaio Individual': 120,
        'Ensaio de Casal': 120,
        'Ensaio Familiar': 180,
        'Gestante': 120,
        'Aniversário': 180,
        'Evento': 240,
        'Produção / Comercial': 180
    };

    const INSTRUCOES_AGENDAMENTO = `
📋 **Informações Importantes Sobre Agendamentos**

✨ **Os valores podem variar conforme:**
   • Local do ensaio (estúdio, externo, sua casa)
   • Horário (manhã, tarde, noite)
   • Quantidade de fotos finais
   • Número de dias para entrega

⏰ **Prazos:**
   • Prévias: 24-48 horas
   • Entrega Parcial: 7-10 dias
   • Entrega Completa: 20-30 dias

💳 **Pagamento:**
   • 50% de adiantamento
   • Restante no dia
   • Aceito PIX, cartão e dinheiro

❌ **Cancelamento:**
   • Até 24h antes: reembolso total
   • Menos de 24h: multa de 30-50%

Entendido? Vamos prosseguir! 👇
    `;

    // ============ ESTADO GLOBAL ============
    const ESTADO = {
        agendamento: {
            nome: null,
            telefone: null,
            cidade: null,
            tipo: null,
            data: null,
            horario: null
        },
        etapa: null,
        historicoMensagens: []
    };

    // ============ VALIDAÇÃO DE TELEFONE ============
    function validarTelefone(telefone) {
        // Remove caracteres especiais
        const apenasNumeros = telefone.replace(/\D/g, '');
        
        // Verifica se tem entre 10 e 11 dígitos (sem código de país)
        if (apenasNumeros.length === 11 || apenasNumeros.length === 10) {
            return {
                valido: true,
                formatado: apenasNumeros
            };
        }
        
        // Se tem 12 ou 13, pode ser com código de país
        if (apenasNumeros.length === 12 || apenasNumeros.length === 13) {
            // Remove primeiros dígitos (código de país)
            const semCodigo = apenasNumeros.slice(-11);
            if (semCodigo.length === 11 || semCodigo.length === 10) {
                return {
                    valido: true,
                    formatado: semCodigo
                };
            }
        }

        return {
            valido: false,
            formatado: null
        };
    }

    // ============ GERADOR DE DATAS E HORÁRIOS ============
    function gerarProximasDatas(quantidade = 7) {
        const datas = [];
        let data = new Date();
        data.setDate(data.getDate() + 1);

        while (datas.length < quantidade) {
            const diaSemana = data.getDay();
            if (diaSemana !== 0) {
                datas.push({
                    iso: data.toISOString().split('T')[0],
                    display: formatarDataBR(data)
                });
            }
            data.setDate(data.getDate() + 1);
        }
        return datas;
    }

    function formatarDataBR(data) {
        if (typeof data === 'string') {
            data = new Date(data + 'T00:00:00');
        }
        const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        const diaSemana = dias[data.getDay()];
        
        return `${dia}/${mes}/${ano} (${diaSemana})`;
    }

    function gerarHorarios() {
        const horarios = [];
        const [h_abr, m_abr] = CONFIG.HORARIO_ABERTURA.split(':').map(Number);
        const [h_fech, m_fech] = CONFIG.HORARIO_FECHAMENTO.split(':').map(Number);
        
        let minutos = h_abr * 60 + m_abr;
        const fimMinutos = h_fech * 60 + m_fech;
        
        while (minutos < fimMinutos) {
            const h = Math.floor(minutos / 60);
            const m = minutos % 60;
            horarios.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            minutos += CONFIG.INTERVALO_MINUTOS;
        }
        
        return horarios;
    }

    // ============ RECONHECIMENTO DE INTENÇÕES ============
    const PALAVRAS = {
        saudacao: /^(oi|olá|opa|e aí|bom dia|boa tarde|boa noite|hey|tudo bom)?$/i,
        menu: /menu|opções|voltar|o que vocês/i,
        agendamento: /agend|marcar|reserv|booking|quero marca|agendar|marcar data/i,
        datas: /data.*(disponível|livre|vago)|qual data|próximas datas|quando posso|que dias vocês|vocês trabalham/i,
        horarios: /horário|que horas|qual hora|disponibilidade|que horários|quando vocês/i,
        valores: /valor|preço|quanto custa|orçamento|tabela|quanto é|investimento/i,
        casamento: /casamento|wedding|noivo|noiva/i,
        individual: /individual|retrato|book pessoal|solo/i,
        casal: /casal|duplo|para dois|couple/i,
        familia: /familia|familiar|todos juntos|grupo/i,
        gestante: /gestant|grávida|gravidez/i,
        aniversario: /aniversário|aniversario|birthday|bday/i,
        evento: /evento|corporativo|festa/i,
        producao: /produção|comercial|editorial|publicitário/i,
        galeria: /galeria|portfolio|portfólio|fotos|exemplos/i,
        entrega: /entrega|prazo|quanto tempo|quando recebo/i,
        endereco: /endereço|onde vocês|localização|como chego/i,
        whatsapp: /whatsapp|zap|wpp|numero|telefone|contato|ligar/i,
        termos: /termos|condições|política|cancelamento|multa|reembolso/i,
        galeria_privada: /galeria privada|meu ensaio|minha galeria|acessar fotos/i,
        sobre: /sobre|quem é|história|experiência|quanto tempo/i,
        reiniciar: /reiniciar|recomeçar|limpar|novo chat|recomecar/i,
        obrigado: /obrigad|valeu|vlw|brigado/i,
        tudo_bem: /tudo bem|e você|como vai|como está/i
    };

    function identificarIntencoes(texto) {
        const t = texto.toLowerCase();
        const intencoes = [];
        
        for (const [chave, regex] of Object.entries(PALAVRAS)) {
            if (regex.test(t)) {
                intencoes.push(chave);
            }
        }
        
        return intencoes;
    }

    // ============ RESPOSTAS DO BOT ============
    function responder(texto) {
        const intencoes = identificarIntencoes(texto);
        
        if (intencoes.includes('reiniciar')) {
            reiniciarChat();
            return true;
        }

        if (intencoes.includes('obrigado')) {
            Chat.falar('😊 De nada! Qualquer coisa, é só chamar!');
            return true;
        }

        if (intencoes.includes('tudo_bem')) {
            Chat.falar('Tudo bem sim! E com você? Como posso ajudar?');
            Chat.sugerir([
                { label: '📅 Agendar', valor: 'agendar' },
                { label: '💰 Valores', valor: 'valores' },
                { label: '📞 Contato', valor: 'whatsapp' }
            ]);
            return true;
        }

        if (intencoes.includes('saudacao')) {
            Chat.falar('👋 Oi! Bem-vindo ao Motazt Studio!\n\nSou seu assistente de agendamentos. Em que posso ajudar?');
            Chat.sugerir([
                { label: '📅 Agendar', valor: 'agendar' },
                { label: '💰 Valores', valor: 'valores' },
                { label: '📸 Serviços', valor: 'serviços' },
                { label: '📞 Contato', valor: 'whatsapp' }
            ]);
            return true;
        }

        if (intencoes.includes('menu')) {
            mostrarMenu();
            return true;
        }

        if (intencoes.includes('agendamento')) {
            iniciarAgendamento();
            return true;
        }

        if (intencoes.includes('valores')) {
            mostrarValores();
            return true;
        }

        if (intencoes.includes('datas')) {
            mostrarDatasDisp();
            return true;
        }

        if (intencoes.includes('horarios')) {
            Chat.falar('⏰ Que dia você gostaria? Digite no formato DD/MM/AAAA\n\nExemplo: 15/08/2026');
            ESTADO.etapa = 'aguardando_data_para_horario';
            return true;
        }

        if (intencoes.includes('galeria')) {
            Chat.falar('🖼️ Você pode ver nosso portfólio na seção **Galeria** acima!');
            Chat.sugerirLinks([
                { label: '→ Ver Galeria', link: '#galeria' }
            ]);
            return true;
        }

        if (intencoes.includes('galeria_privada')) {
            Chat.falar('🔐 Acesse sua galeria privada aqui:');
            Chat.sugerirLinks([
                { label: '→ Minha Galeria', link: 'galeria-privada.html' }
            ]);
            return true;
        }

        if (intencoes.includes('entrega')) {
            Chat.falar('⏳ **Prazos de Entrega**\n\n⚡ Prévias: 24-48 horas\n🖼️ Parcial (50%): 7-10 dias\n✨ Final (100%): 20-30 dias');
            return true;
        }

        if (intencoes.includes('termos')) {
            Chat.falar(INSTRUCOES_AGENDAMENTO);
            Chat.sugerir([
                { label: '📅 Agendar', valor: 'agendar' }
            ]);
            return true;
        }

        if (intencoes.includes('whatsapp')) {
            Chat.falar(`💬 **Nosso WhatsApp**\n\n📱 ${CONFIG.TELEFONE_DISPLAY}\n\nRespondemos rápido!`);
            Chat.sugerirLinks([
                { label: '💬 Abrir WhatsApp', link: CONFIG.WHATSAPP_LINK }
            ]);
            return true;
        }

        if (intencoes.includes('sobre')) {
            Chat.falar(`📸 **Sobre Nós**\n\n🎯 Somos especialistas em fotografia profissional e artística.\n\n✨ Transformamos seus momentos em memórias eternas!\n\nQuer conhecer nossos trabalhos?`);
            Chat.sugerir([
                { label: '🖼️ Ver galeria', valor: 'galeria' },
                { label: '📅 Agendar', valor: 'agendar' }
            ]);
            return true;
        }

        // Se está em agendamento
        if (ESTADO.etapa) {
            processarAgendamento(texto);
            return true;
        }

        return false;
    }

    function mostrarMenu() {
        Chat.falar('📋 **O que você gostaria de fazer?**');
        Chat.sugerir([
            { label: '📅 Agendar', valor: 'agendar' },
            { label: '💰 Valores', valor: 'valores' },
            { label: '📸 Serviços', valor: 'serviços' },
            { label: '🗓️ Datas', valor: 'datas' },
            { label: '🖼️ Galeria', valor: 'galeria' },
            { label: '📋 Termos', valor: 'termos' },
            { label: '📞 Contato', valor: 'whatsapp' }
        ]);
    }

    function mostrarValores() {
        let texto = '💰 **Tabela de Valores - Fotógrafo Iniciante**\n\n';
        for (const [tipo, valor] of Object.entries(VALORES)) {
            texto += `• **${tipo}**: ${valor}\n`;
        }
        texto += '\n⚠️ *Valores podem variar conforme local, horário e duração.*';
        
        Chat.falar(texto);
        Chat.sugerir([
            { label: '📅 Agendar', valor: 'agendar' },
            { label: '📋 Termos', valor: 'termos' }
        ]);
    }

    function mostrarServiços() {
        const texto = `📸 **Nossos Serviços**

👤 **Ensaio Individual** — R$ 150 a R$ 250 • 2h
Retrato, book pessoal, redes sociais

👫 **Ensaio de Casal** — R$ 200 a R$ 350 • 2h
Pré-casamento, book casal

👨‍👩‍👧‍👦 **Ensaio Familiar** — R$ 250 a R$ 400 • 3h
Fotos da família toda junta

🤰 **Gestante** — R$ 180 a R$ 280 • 2h
Celebrando a gravidez com arte

💍 **Casamento** — R$ 500 a R$ 1.500
Cobertura do seu grande dia

🎉 **Evento** — R$ 400 a R$ 800
Aniversários, corporativos, celebrações

🎂 **Aniversário** — R$ 200 a R$ 400
Festa inesquecível registrada

📸 **Produção Comercial** — R$ 300 a R$ 600
Fotos para marcas, editorials, publicidade`;

        Chat.falar(texto);
        Chat.sugerir([
            { label: '📅 Agendar', valor: 'agendar' },
            { label: '💰 Ver valores', valor: 'valores' }
        ]);
    }

    function mostrarDatasDisp() {
        Chat.digitando(true);
        setTimeout(() => {
            Chat.digitando(false);
            const datas = gerarProximasDatas(7);
            const lista = datas.map(d => `• ${d.display}`).join('\n');
            
            Chat.falar(`🗓️ **Próximas Datas Disponíveis**\n\n${lista}`);
            Chat.sugerir(
                datas.slice(0, 4).map(d => ({
                    label: d.display.split(' ')[0],
                    valor: d.iso
                }))
            );
        }, 500);
    }

    function iniciarAgendamento() {
        Chat.falar(INSTRUCOES_AGENDAMENTO);
        
        setTimeout(() => {
            Chat.falar('🎉 Vamos começar?\n\nQual é o seu nome completo?');
            ESTADO.etapa = 'aguardando_nome';
        }, 500);
    }

    function processarAgendamento(texto) {
        if (ESTADO.etapa === 'aguardando_nome') {
            ESTADO.agendamento.nome = texto.trim();
            Chat.falar(`😊 Prazer, ${ESTADO.agendamento.nome}!\n\nQual é seu telefone/WhatsApp? (com DDD)\n\nExemplo: (73) 98165-6986`);
            ESTADO.etapa = 'aguardando_telefone';
            return;
        }

        if (ESTADO.etapa === 'aguardando_telefone') {
            const validacao = validarTelefone(texto);
            
            if (!validacao.valido) {
                Chat.falar('❌ Telefone inválido.\n\nDigite novamente com DDD.\n\nExemplo: (73) 98165-6986 ou 73 98165-6986');
                return;
            }

            ESTADO.agendamento.telefone = validacao.formatado;
            Chat.falar(`📱 Perfeito! ${ESTADO.agendamento.telefone}\n\nDe qual cidade você é?`);
            ESTADO.etapa = 'aguardando_cidade';
            return;
        }

        if (ESTADO.etapa === 'aguardando_cidade') {
            ESTADO.agendamento.cidade = texto.trim();
            Chat.falar('🏙️ Obrigado!\n\nAgora, qual tipo de ensaio você gostaria?');
            Chat.sugerir([
                { label: '👤 Individual', valor: 'individual' },
                { label: '👫 Casal', valor: 'casal' },
                { label: '👨‍👩‍👧‍👦 Família', valor: 'familia' },
                { label: '🤰 Gestante', valor: 'gestante' },
                { label: '💍 Casamento', valor: 'casamento' },
                { label: '🎉 Evento', valor: 'evento' }
            ]);
            ESTADO.etapa = 'aguardando_tipo';
            return;
        }

        if (ESTADO.etapa === 'aguardando_tipo') {
            const tipos = Object.keys(DURACAO_ENSAIOS);
            const tipo = tipos.find(t => t.toLowerCase().includes(texto.toLowerCase()));
            
            if (tipo) {
                ESTADO.agendamento.tipo = tipo;
                Chat.falar(`📸 ${tipo}\n\n${VALORES[tipo]}\n\n*Valores podem mudar conforme local e horário.*\n\nPara qual data você gostaria?`);
                
                const datas = gerarProximasDatas(5);
                Chat.sugerir(
                    datas.map(d => ({
                        label: d.display.slice(0, 10),
                        valor: d.iso
                    }))
                );
                
                ESTADO.etapa = 'aguardando_data';
            } else {
                Chat.falar('❌ Tipo não reconhecido. Escolha uma das opções acima.');
            }
            return;
        }

        if (ESTADO.etapa === 'aguardando_data') {
            let data = null;
            
            if (texto.includes('-')) {
                data = texto.trim();
            } else if (texto.match(/\d{2}\/\d{2}\/\d{4}/)) {
                const [dia, mes, ano] = texto.split('/');
                data = `${ano}-${mes}-${dia}`;
            }

            if (data) {
                ESTADO.agendamento.data = data;
                const horarios = gerarHorarios();
                
                Chat.falar(`📅 ${formatarDataBR(data)}\n\n⏰ Qual horário você prefere?`);
                
                const grupo1 = horarios.slice(0, 6);
                Chat.sugerir(
                    grupo1.map(h => ({
                        label: h,
                        valor: h
                    }))
                );
                
                ESTADO.etapa = 'aguardando_horario';
            } else {
                Chat.falar('❌ Data inválida. Digite assim: 15/08/2026');
            }
            return;
        }

        if (ESTADO.etapa === 'aguardando_horario') {
            if (texto.match(/\d{1,2}:\d{2}/)) {
                ESTADO.agendamento.horario = texto.trim();
                finalizarAgendamento();
            } else {
                Chat.falar('❌ Horário inválido. Digite assim: 14:30');
            }
            return;
        }

        if (ESTADO.etapa === 'aguardando_data_para_horario') {
            let data = null;
            
            if (texto.includes('-')) {
                data = texto.trim();
            } else if (texto.match(/\d{2}\/\d{2}\/\d{4}/)) {
                const [dia, mes, ano] = texto.split('/');
                data = `${ano}-${mes}-${dia}`;
            }

            if (data) {
                const horarios = gerarHorarios();
                Chat.falar(`⏰ **Horários disponíveis para ${formatarDataBR(data)}**\n\n${horarios.join(' • ')}`);
                ESTADO.etapa = null;
            } else {
                Chat.falar('❌ Data inválida. Digite assim: 15/08/2026');
            }
            return;
        }
    }

    function finalizarAgendamento() {
        Chat.digitando(true);

        setTimeout(async () => {
            Chat.digitando(false);

            try {
                if (supabase) {
                    const duracao = DURACAO_ENSAIOS[ESTADO.agendamento.tipo] || 120;
                    
                    const { error } = await supabase
                        .from('agendamentos')
                        .insert([{
                            nome: ESTADO.agendamento.nome,
                            telefone: ESTADO.agendamento.telefone,
                            cidade: ESTADO.agendamento.cidade,
                            ensaio: ESTADO.agendamento.tipo,
                            data: ESTADO.agendamento.data,
                            horario: ESTADO.agendamento.horario,
                            duracao_min: duracao,
                            status: 'confirmado'
                        }]);

                    if (error) throw error;
                }

                const confirmacao = `✅ **Agendamento Confirmado!**

📛 ${ESTADO.agendamento.nome}
📱 ${ESTADO.agendamento.telefone}
🏙️ ${ESTADO.agendamento.cidade}
📸 ${ESTADO.agendamento.tipo}
📅 ${formatarDataBR(ESTADO.agendamento.data)}
⏰ ${ESTADO.agendamento.horario}

🎉 Você receberá confirmação no WhatsApp!
💳 Enviaremos link de pagamento do adiantamento
🖼️ Acessará sua galeria privada em breve`;

                Chat.falar(confirmacao);
                Chat.sugerir([
                    { label: '🖼️ Ver galeria', valor: 'galeria' },
                    { label: '📞 Tirar dúvidas', valor: 'whatsapp' },
                    { label: '📋 Menu', valor: 'menu' }
                ]);

                resetarAgendamento();

            } catch (erro) {
                Chat.falar('❌ Houve um erro. Entre em contato pelo WhatsApp.');
                Chat.sugerirLinks([
                    { label: '💬 WhatsApp', link: CONFIG.WHATSAPP_LINK }
                ]);
            }
        }, 1000);
    }

    function resetarAgendamento() {
        ESTADO.agendamento = {
            nome: null,
            telefone: null,
            cidade: null,
            tipo: null,
            data: null,
            horario: null
        };
        ESTADO.etapa = null;
    }

    function reiniciarChat() {
        Chat.msgs = [];
        ESTADO.historicoMensagens = [];
        resetarAgendamento();
        
        Chat.elMsgs.innerHTML = '';
        Chat.limparSugestoes();
        
        Chat.falar('👋 Chat reiniciado!\n\nBem-vindo ao Motazt Studio!\n\nComo posso ajudá-lo?');
        Chat.sugerir([
            { label: '📅 Agendar', valor: 'agendar' },
            { label: '💰 Valores', valor: 'valores' },
            { label: '📸 Serviços', valor: 'serviços' },
            { label: '📞 Contato', valor: 'whatsapp' }
        ]);
    }

    // ============ INTERFACE DO CHAT ============
    const Chat = {
        msgs: [],
        elMsgs: null,
        elSugest: null,
        aberto: false,

        inicializar() {
            this.elMsgs = document.getElementById('chatbotMensagens');
            this.elSugest = document.getElementById('chatbotSugestoes');

            const btnFab = document.getElementById('chatBotBtn');
            const painel = document.getElementById('chatbotPainel');
            const overlay = document.getElementById('chatbotOverlay');
            const btnFechar = document.getElementById('chatbotFechar');
            const btnReiniciar = document.getElementById('chatbotReiniciar');
            const input = document.getElementById('chatbotInput');
            const btnEnviar = document.getElementById('chatbotEnviar');

            if (!btnFab || !painel) return;

            btnFab.addEventListener('click', () => this.alternarChat());
            btnFechar.addEventListener('click', () => this.fechar());
            if (btnReiniciar) btnReiniciar.addEventListener('click', reiniciarChat);
            overlay.addEventListener('click', () => this.fechar());
            
            btnEnviar.addEventListener('click', () => this.enviar());
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.enviar();
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.aberto) this.fechar();
            });

            this.falar('👋 Oi! Bem-vindo ao Motazt Studio!\n\nSou seu assistente de agendamentos. Como posso ajudar?');
            this.sugerir([
                { label: '📅 Agendar', valor: 'agendar' },
                { label: '💰 Valores', valor: 'valores' },
                { label: '📸 Serviços', valor: 'serviços' },
                { label: '📞 Contato', valor: 'whatsapp' }
            ]);
        },

        alternarChat() {
            this.aberto ? this.fechar() : this.abrir();
        },

        abrir() {
            this.aberto = true;
            document.getElementById('chatbotPainel').classList.add('aberto');
            document.getElementById('chatbotOverlay').classList.add('ativo');
            document.getElementById('chatBotBtn').classList.add('aberto');
            document.getElementById('chatbotInput').focus();
        },

        fechar() {
            this.aberto = false;
            document.getElementById('chatbotPainel').classList.remove('aberto');
            document.getElementById('chatbotOverlay').classList.remove('ativo');
            document.getElementById('chatBotBtn').classList.remove('aberto');
        },

        falar(texto) {
            this.msgs.push({ texto, tipo: 'bot' });
            this.renderizarUltima();
        },

        falarUsuario(texto) {
            this.msgs.push({ texto, tipo: 'usuario' });
            this.renderizarUltima();
            this.limparSugestoes();
        },

        sugerir(opcoes) {
            this.limparSugestoes();
            opcoes.forEach(op => {
                const btn = document.createElement('button');
                btn.className = 'chatbot-chip';
                btn.textContent = op.label;
                btn.addEventListener('click', () => this.processar(op.valor));
                this.elSugest.appendChild(btn);
            });
        },

        sugerirLinks(links) {
            this.limparSugestoes();
            links.forEach(op => {
                const btn = document.createElement('button');
                btn.className = 'chatbot-chip';
                btn.textContent = op.label;
                btn.addEventListener('click', () => {
                    window.open(op.link, '_blank', 'noopener');
                });
                this.elSugest.appendChild(btn);
            });
        },

        limparSugestoes() {
            if (this.elSugest) this.elSugest.innerHTML = '';
        },

        digitando(mostrar) {
            let el = document.getElementById('chatbotDigitando');
            if (mostrar) {
                if (!el) {
                    el = document.createElement('div');
                    el.id = 'chatbotDigitando';
                    el.className = 'chatbot-digitando';
                    el.innerHTML = '<span></span><span></span><span></span>';
                    this.elMsgs.appendChild(el);
                }
            } else if (el) {
                el.remove();
            }
            this.scroll();
        },

        renderizarUltima() {
            const msg = this.msgs[this.msgs.length - 1];
            const div = document.createElement('div');
            div.className = `chatbot-msg ${msg.tipo}`;
            div.textContent = msg.texto;
            this.elMsgs.appendChild(div);
            this.scroll();
        },

        scroll() {
            this.elMsgs.scrollTop = this.elMsgs.scrollHeight;
        },

        processar(texto) {
            const val = texto.trim();
            if (!val) return;
            
            this.falarUsuario(val);
            this.digitando(true);

            setTimeout(() => {
                this.digitando(false);
                if (!responder(val)) {
                    this.falar('🤔 Não entendi bem... Pode repetir?\n\nOu use o menu! ☝️');
                    this.sugerir([
                        { label: '📋 Menu', valor: 'menu' }
                    ]);
                }
            }, 500);
        },

        enviar() {
            const input = document.getElementById('chatbotInput');
            const val = input.value;
            if (!val.trim()) return;
            
            input.value = '';
            this.processar(val);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Chat.inicializar());
    } else {
        Chat.inicializar();
    }

})();
