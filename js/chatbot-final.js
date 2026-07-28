/* ================================================
   CHATBOT MOTAZT STUDIO v3.0 — VERSÃO FINAL
   Menu Completo + Reconhecimento Avançado
   Horários Dinâmicos + Galeria Otimizada
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
        EMAIL: 'contato@motazt.com.br',
        INSTAGRAM: '@motazt_studio',
        FACEBOOK: 'Motazt Studio'
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

    const VALORES = {
        'Casamento': 'Sob consulta — cobertura completa',
        'Ensaio Individual': 'R$ 300 a R$ 500',
        'Ensaio de Casal': 'R$ 400 a R$ 600',
        'Ensaio Familiar': 'R$ 500 a R$ 800',
        'Gestante': 'R$ 350 a R$ 550',
        'Aniversário': 'R$ 400 a R$ 700',
        'Evento': 'R$ 800 a R$ 2.000',
        'Produção / Comercial': 'R$ 1.000 a R$ 3.000'
    };

    const TERMOS = `
📋 **Termos e Condições**

**Pagamento:**
• 50% de adiantamento para confirmar data
• Restante no dia do ensaio
• Aceitamos PIX, cartão e dinheiro

**Cancelamento:**
• Até 24h antes: reembolso total
• Menos de 24h: multa de 30-50%
• Reagendamento sem multa com aviso

**Entrega:**
• Prévias: 24-48h
• Entrega parcial: 7-10 dias
• Entrega final: 20-30 dias

**Direitos:**
• Todas as fotos em alta resolução
• Uso ilimitado para pessoal
• Compartilhamento em redes sociais autorizado
• Créditos ao Motazt Studio apreciados

**Garantia:**
• Qualidade profissional garantida
• Reenquadramento incluído
• Ajustes de cores incluídos
• Refotos se não gostar do resultado
    `;

    // ============ ESTADO GLOBAL ============
    const ESTADO = {
        agendamento: {
            nome: null,
            telefone: null,
            tipo: null,
            data: null,
            horario: null
        },
        etapa: null,
        historicoHorarios: [],
        horariosSelecionados: [],
        dataAtual: new Date()
    };

    // ============ PALAVRAS-CHAVE EXPANDIDAS ============
    const PALAVRAS = {
        saudacao: /^(oi|olá|opa|e aí|bom dia|boa tarde|boa noite|hey|opa|ei|elo|tudo bom|tudo certo|fala|opa|quatro|vai)?$/i,
        menu: /menu|opções|voltar|o que vocês/i,
        agendamento: /agend|marcar|reserv|booking|quero marca|agendar|marcar data|fazer agendamento/i,
        cancelamento: /cancel|remarc|desmarc|remover agendamento|limpar agendamento/i,
        datas: /data.*(disponível|livre|vago)|qual data|próximas datas|quando posso|que dias vocês|vocês trabalham|que dias|qual (dia|semana)/i,
        horarios: /horário|que horas|qual hora|disponibilidade|que horários|quando vocês/i,
        valores: /valor|preço|quanto custa|orçamento|tabela|quanto é|quanto sai|investimento/i,
        casamento: /casamento|wedding|noivo|noiva|casar|boda/i,
        individual: /individual|retrato|book pessoal|solo|fotografia individual/i,
        casal: /casal|duplo|para dois|couple|namorido/i,
        familia: /familia|familiar|todos juntos|grupo|inteira/i,
        gestante: /gestant|grávida|gravidez|barriguda|barriguinha/i,
        aniversario: /aniversário|aniversario|birthday|bday|festinha/i,
        evento: /evento|corporativo|festa|confraternização|congresso/i,
        producao: /produção|comercial|editorial|publicitário|branding|marca/i,
        galeria: /galeria|portfolio|portfólio|fotos prontas|exemplos|seus trabalhos|ver fotos|mostra trabalho/i,
        entrega: /entrega|prazo|quanto tempo|quando recebo|quando fico com|quanto demora/i,
        endereco: /endereço|onde vocês|localização|como chego|aonde fica|em qual lugar/i,
        whatsapp: /whatsapp|zap|wpp|numero|telefone|contato|ligar|chamar/i,
        instagram: /instagram|insta|redes|segue lá|siga|social media/i,
        email: /email|e-mail|enviar email|mandar email/i,
        termos: /termos|condições|política|regras|cancelamento|multa|reembolso/i,
        galeria_privada: /galeria privada|meu ensaio|minha galeria|acessar fotos|login|senha|meu acesso/i,
        outros_servicos: /outros serviços|você faz|vocês fazem|qual tipos|tipos de|o que vocês|que mais/i,
        sobre: /sobre|quem é|história|experiência|quanto tempo|há quanto tempo|desde quando/i,
        atendente: /atendente|humano|pessoa|falar com alguém|suporte|equipe|gerente/i,
        duvida: /não entendi|como assim|explica|o que é|qual é|significa|quer dizer/i,
        obrigado: /obrigad|valeu|vlw|brigado|thank|thanks/i,
        tudo_bem: /tudo bem|e você|como vai|como está|beleza/i
    };

    // ============ GERADOR DE DATAS E HORÁRIOS ============
    function gerarProximasDatas(quantidade = 7) {
        const datas = [];
        let data = new Date();
        data.setDate(data.getDate() + 1);

        while (datas.length < quantidade) {
            const diaSemana = data.getDay();
            if (diaSemana !== 0) { // pula domingo
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
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
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
        
        if (intencoes.includes('obrigado')) {
            Chat.falar('😊 De nada! Qualquer coisa, é só chamar!');
            return true;
        }

        if (intencoes.includes('tudo_bem')) {
            Chat.falar('Tudo bem sim! E com você? Como posso ajudar?');
            Chat.sugerir([
                { label: '📅 Agendar', valor: 'agendar' },
                { label: '📸 Ver serviços', valor: 'serviços' },
                { label: '💬 Falar com equipe', valor: 'whatsapp' }
            ]);
            return true;
        }

        if (intencoes.includes('saudacao')) {
            Chat.falar('👋 Oi! Bem-vindo ao Motazt Studio!\n\nSou seu assistente de agendamentos. Em que posso ajudar?');
            Chat.sugerir([
                { label: '📅 Agendar', valor: 'agendar' },
                { label: '💰 Valores', valor: 'valores' },
                { label: '📸 Serviços', valor: 'serviços' },
                { label: '🗓️ Datas livres', valor: 'datas' },
                { label: '⏰ Horários', valor: 'horarios' }
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

        if (intencoes.includes('datas')) {
            mostraDataisDisp();
            return true;
        }

        if (intencoes.includes('horarios')) {
            Chat.falar('⏰ Que dia você gostaria? Digite no formato DD/MM/AAAA\n\nExemplo: 15/08/2026');
            ESTADO.etapa = 'aguardando_data_para_horario';
            return true;
        }

        if (intencoes.includes('valores')) {
            mostrarValores();
            return true;
        }

        if (intencoes.includes('casamento') || intencoes.includes('individual') || 
            intencoes.includes('casal') || intencoes.includes('familia') || 
            intencoes.includes('gestante') || intencoes.includes('aniversario') || 
            intencoes.includes('evento') || intencoes.includes('producao')) {
            mostrarServicos();
            return true;
        }

        if (intencoes.includes('galeria')) {
            Chat.falar('🖼️ Você pode ver nosso portfólio completo na seção **Galeria** acima! Lá tem fotos de casamentos, famílias, eventos e muito mais.\n\nClique nas imagens para ampliar e arrastar para ver as próximas!');
            Chat.sugerirLinks([
                { label: '→ Ir para Galeria', link: '#galeria' }
            ]);
            return true;
        }

        if (intencoes.includes('galeria_privada')) {
            Chat.falar('🔐 Você pode acessar sua galeria privada com login exclusivo aqui:');
            Chat.sugerirLinks([
                { label: '→ Minha Galeria', link: 'galeria-privada.html' }
            ]);
            return true;
        }

        if (intencoes.includes('entrega')) {
            Chat.falar('⏳ **Prazos de Entrega**\n\n⚡ Prévias (seleção): 24-48 horas\n🖼️ Parcial (50%): 7-10 dias\n✨ Final (100%): 20-30 dias\n\nVocê acompanha tudo pela galeria privada!');
            return true;
        }

        if (intencoes.includes('endereco')) {
            Chat.falar(`📍 **Nossa Localização**\n\n${CONFIG.ENDERECO}\n\nFacilmente acessível!\n\nQuer o mapa?`);
            Chat.sugerir([
                { label: '🗺️ Ver no Google Maps', valor: 'mapa' },
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

        if (intencoes.includes('instagram')) {
            Chat.falar(`📷 **Instagram**\n\n${CONFIG.INSTAGRAM}\n\nVeja nossos stories, reels e dicas!`);
            Chat.sugerirLinks([
                { label: '📷 Seguir Instagram', link: `https://instagram.com/${CONFIG.INSTAGRAM.replace('@', '')}` }
            ]);
            return true;
        }

        if (intencoes.includes('email')) {
            Chat.falar(`📧 **Email**\n\n${CONFIG.EMAIL}\n\nPodemos conversar por email também!`);
            return true;
        }

        if (intencoes.includes('termos')) {
            Chat.falar(TERMOS);
            Chat.sugerir([
                { label: '📅 Agendar', valor: 'agendar' },
                { label: '💬 Dúvidas', valor: 'duvidas' }
            ]);
            return true;
        }

        if (intencoes.includes('cancelamento')) {
            Chat.falar('❌ **Cancelamento de Agendamento**\n\n✅ Até 24h antes: reembolso total\n⚠️ Menos de 24h: multa de 30-50%\n📅 Reagendamento: sem multa com aviso\n\nQuer cancelar ou remarcar?');
            Chat.sugerirLinks([
                { label: '💬 Cancelar/Remarcar', link: CONFIG.WHATSAPP_LINK }
            ]);
            return true;
        }

        if (intencoes.includes('sobre')) {
            Chat.falar(`📸 **Sobre Nós**\n\n🎯 Motazt Studio é especialista em fotografia profissional desde 2018.\n\n✨ Somos apaixonados por capturar momentos e transformá-los em arte.\n\n📍 Baseados em ${CONFIG.ENDERECO}\n\n💼 Experientes em: casamentos, ensaios, eventos corporativos e produções comerciais.\n\nGostaria de conhecer nossos trabalhos?`);
            Chat.sugerir([
                { label: '🖼️ Ver galeria', valor: 'galeria' },
                { label: '📅 Agendar', valor: 'agendar' }
            ]);
            return true;
        }

        if (intencoes.includes('duvida')) {
            Chat.falar('🤔 Não entendi bem... Pode repetir de outra forma?\n\nOu quer falar com alguém?');
            Chat.sugerir([
                { label: '📋 Ver menu', valor: 'menu' },
                { label: '💬 Falar com equipe', valor: 'whatsapp' }
            ]);
            return true;
        }

        if (intencoes.includes('atendente')) {
            Chat.falar('👤 Sem problema! Nossa equipe está pronta para ajudar!');
            Chat.sugerirLinks([
                { label: '💬 Falar com Equipe (WhatsApp)', link: CONFIG.WHATSAPP_LINK }
            ]);
            return true;
        }

        // Se houver etapa de agendamento em curso
        if (ESTADO.etapa) {
            processarAgendamento(texto);
            return true;
        }

        return false;
    }

    function mostrarMenu() {
        Chat.falar('📋 **O que você gostaria de fazer?**');
        Chat.sugerir([
            { label: '📅 Agendar Ensaio', valor: 'agendar' },
            { label: '📸 Nossos Serviços', valor: 'serviços' },
            { label: '💰 Ver Valores', valor: 'valores' },
            { label: '🗓️ Datas Disponíveis', valor: 'datas' },
            { label: '⏰ Ver Horários', valor: 'horarios' },
            { label: '🖼️ Galeria', valor: 'galeria' },
            { label: '❓ Perguntas Frequentes', valor: 'faq' },
            { label: '📋 Termos e Condições', valor: 'termos' },
            { label: '📞 Contato', valor: 'whatsapp' }
        ]);
    }

    function mostrarServicos() {
        const texto = `📸 **Nossos Serviços**

👤 **Ensaio Individual** — R$ 300 a R$ 500
   Retrato, book pessoal, redes sociais. 2h

👫 **Ensaio de Casal** — R$ 400 a R$ 600
   Pré-casamento, book casal. 2h

👨‍👩‍👧‍👦 **Ensaio Familiar** — R$ 500 a R$ 800
   Fotos da família toda. 3h

🤰 **Gestante** — R$ 350 a R$ 550
   Celebrando a gravidez. 2h

💍 **Casamento** — Sob consulta
   Cobertura completa com edição profissional

🎉 **Evento** — R$ 800 a R$ 2.000
   Aniversários, corporativos, celebrações

🎂 **Aniversário** — R$ 400 a R$ 700
   Festa inesquecível registrada

📸 **Produção Comercial** — R$ 1.000 a R$ 3.000
   Fotos para marcas, editorials, publicidade`;

        Chat.falar(texto);
        Chat.sugerir([
            { label: '💰 Ver valores completos', valor: 'valores' },
            { label: '📅 Agendar', valor: 'agendar' }
        ]);
    }

    function mostrarValores() {
        let texto = '💰 **Tabela de Valores**\n\n';
        for (const [tipo, valor] of Object.entries(VALORES)) {
            texto += `• ${tipo}: ${valor}\n`;
        }
        texto += '\n⚠️ Os valores podem variar conforme duração, local e pacote.\n✨ Todos incluem edição profissional.';
        
        Chat.falar(texto);
        Chat.sugerir([
            { label: '📅 Agendar', valor: 'agendar' },
            { label: '📸 Ver serviços', valor: 'serviços' }
        ]);
    }

    function mostraDataisDisp() {
        Chat.digitando(true);
        setTimeout(() => {
            Chat.digitando(false);
            const datas = gerarProximasDatas(7);
            const lista = datas.map(d => `• ${d.display}`).join('\n');
            
            Chat.falar(`🗓️ **Próximas Datas Disponíveis**\n\n${lista}\n\nQual você prefere?`);
            Chat.sugerir(
                datas.slice(0, 5).map(d => ({
                    label: d.display.split(' ')[0] + '/' + d.display.split(' ')[1],
                    valor: d.iso
                }))
            );
        }, 500);
    }

    function iniciarAgendamento() {
        Chat.falar('🎉 Vamos agendar seu ensaio?\n\nPrimeiro, qual é o seu nome completo?');
        ESTADO.etapa = 'aguardando_nome';
    }

    function processarAgendamento(texto) {
        if (ESTADO.etapa === 'aguardando_nome') {
            ESTADO.agendamento.nome = texto.trim();
            Chat.falar(`😊 Prazer, ${ESTADO.agendamento.nome}!\n\nQual é seu telefone/WhatsApp? (com DDD)\n\nExemplo: (73) 98165-6986`);
            ESTADO.etapa = 'aguardando_telefone';
            return;
        }

        if (ESTADO.etapa === 'aguardando_telefone') {
            ESTADO.agendamento.telefone = texto.trim();
            Chat.falar('📱 Perfeito! Agora, qual tipo de ensaio você gostaria?');
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
                Chat.falar(`📸 ${tipo} — ótima escolha!\n\n${VALORES[tipo]}\n\nPara qual data você gostaria?`);
                
                const datas = gerarProximasDatas(5);
                Chat.sugerir(
                    datas.map(d => ({
                        label: d.display.slice(0, 10),
                        valor: d.iso
                    }))
                );
                
                ESTADO.etapa = 'aguardando_data';
            } else {
                Chat.falar('❌ Tipo não reconhecido. Qual desses?\n\nIndividual, Casal, Família, Gestante, Casamento, Evento ou Aniversário?');
            }
            return;
        }

        if (ESTADO.etapa === 'aguardando_data') {
            // Aceita formato DD/MM/AAAA ou ISO
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
                
                // Mostrar horários em grupos
                const grupo1 = horarios.slice(0, 6);
                const grupo2 = horarios.slice(6, 12);
                
                Chat.sugerir(
                    grupo1.map(h => ({
                        label: h,
                        valor: h
                    }))
                );
                
                // Mostrar mais opções se houver
                if (grupo2.length > 0) {
                    Chat.falar(`\n⏰ Ou escolha outro horário (ainda há ${grupo2.length} opções)`);
                }
                
                ESTADO.etapa = 'aguardando_horario';
            } else {
                Chat.falar('❌ Data inválida. Digite assim: 15/08/2026 ou 2026-08-15');
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
📸 ${ESTADO.agendamento.tipo}
📅 ${formatarDataBR(ESTADO.agendamento.data)}
⏰ ${ESTADO.agendamento.horario}

🎉 Você receberá confirmação no WhatsApp!
💳 Enviaremos link de pagamento do adiantamento
🖼️ Acessará sua galeria privada em breve`;

                Chat.falar(confirmacao);
                Chat.sugerir([
                    { label: '📸 Ver galeria', valor: 'galeria' },
                    { label: '📞 Tirar dúvidas', valor: 'whatsapp' },
                    { label: '📋 Menu', valor: 'menu' }
                ]);

                // Resetar estado
                ESTADO.agendamento = {
                    nome: null,
                    telefone: null,
                    tipo: null,
                    data: null,
                    horario: null
                };
                ESTADO.etapa = null;

            } catch (erro) {
                Chat.falar('❌ Houve um erro ao processar o agendamento.\n\nPor favor, entre em contato conosco pelo WhatsApp.');
                Chat.sugerirLinks([
                    { label: '💬 WhatsApp', link: CONFIG.WHATSAPP_LINK }
                ]);
            }
        }, 1000);
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
            const input = document.getElementById('chatbotInput');
            const btnEnviar = document.getElementById('chatbotEnviar');

            if (!btnFab || !painel) return;

            btnFab.addEventListener('click', () => this.alternarChat());
            btnFechar.addEventListener('click', () => this.fechar());
            overlay.addEventListener('click', () => this.fechar());
            
            btnEnviar.addEventListener('click', () => this.enviar());
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.enviar();
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.aberto) this.fechar();
            });

            // Primeira mensagem
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
                    this.falar('🤔 Não entendi bem... Pode repetir?\n\nOu use o menu para explorar as opções!');
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

    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Chat.inicializar());
    } else {
        Chat.inicializar();
    }

})();
