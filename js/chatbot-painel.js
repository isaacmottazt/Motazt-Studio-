/* ============================================
   CHATBOT MOTAZT STUDIO — PAINEL EMBUTIDO
   Painel de chat que abre ancorado no botão
   flutuante, sem sair da página. Reconhece
   intenções do usuário (saudação, menu,
   valores, agendamento, datas/horários
   disponíveis etc.) e consulta o Supabase
   para responder com informação real.
============================================ */

(function () {

    const supabaseUrlChat = "https://tbwmsgztpyyratambgqs.supabase.co";
    const supabaseKeyChat = "sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";

    // Reaproveita o client já criado pelo script.js quando existir,
    // para não abrir duas conexões com o mesmo projeto Supabase
    const clientChat = (typeof supabase !== 'undefined')
        ? supabase.createClient(supabaseUrlChat, supabaseKeyChat)
        : null;

    // Mesmas regras de agenda usadas no formulário de agendamento (form.js),
    // para o chat responder com horários realmente compatíveis
    const HORARIO_ABERTURA = '07:00';
    const HORARIO_FECHAMENTO = '22:00';
    const INTERVALO_ENTRE_ENSAIOS_MIN = 30;
    const INTERVALO_SLOTS_MIN = 30; // granularidade das sugestões no chat (mais compacto que no form)

    const DURACAO_ENSAIO_MIN = {
        individual: 90,
        casal: 120,
        familia: 150,
        gestante: 90,
        casamento: 480,
        evento: 240
    };

    const VALORES_TEXTO =
        '💰 Nossos valores\n\n' +
        '• Ensaio Individual — R$ 300 a R$ 500\n' +
        '• Casal — R$ 400 a R$ 600\n' +
        '• Familiar — R$ 500 a R$ 800\n' +
        '• Gestante — R$ 350 a R$ 550\n' +
        '• Casamento — sob consulta\n' +
        '• Evento — R$ 800 a R$ 2000\n\n' +
        'O valor final depende da duração, do local e do pacote escolhido.';

    const WHATSAPP_LINK = 'https://wa.me/5585999999999';

    /* ---------- Utilidades de data/hora ---------- */

    function horarioParaMinutos(horario) {
        const [h, m] = horario.split(':').map(Number);
        return h * 60 + m;
    }

    function minutosParaHorario(minutos) {
        const h = String(Math.floor(minutos / 60)).padStart(2, '0');
        const m = String(minutos % 60).padStart(2, '0');
        return `${h}:${m}`;
    }

    function formatarDataBR(isoDate) {
        const [ano, mes, dia] = isoDate.split('-');
        return `${dia}/${mes}/${ano}`;
    }

    function proximosDiasUteis(qtd) {
        const dias = [];
        const hoje = new Date();
        let cursor = new Date(hoje);
        cursor.setDate(cursor.getDate() + 1); // sempre a partir de amanhã

        while (dias.length < qtd) {
            const diaSemana = cursor.getDay(); // 0 = domingo
            if (diaSemana !== 0) { // pula domingos
                const iso = cursor.toISOString().slice(0, 10);
                dias.push(iso);
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return dias;
    }

    // Consulta o Supabase e devolve, para uma data, se existe pelo menos
    // um horário livre considerando a duração padrão de ensaio
    async function contarHorariosLivres(dataIso, duracaoMin) {
        if (!clientChat) return null;

        try {
            const { data: agendamentos, error } = await clientChat
                .from('agendamentos')
                .select('horario, duracao_min, ensaio')
                .eq('data', dataIso)
                .neq('status', 'cancelado');

            if (error) return null;

            const ocupacoes = (agendamentos || [])
                .map(a => {
                    const horarioBruto = a.horario ? String(a.horario).slice(0, 5) : null;
                    if (!horarioBruto || !/^\d{2}:\d{2}$/.test(horarioBruto)) return null;
                    const inicio = horarioParaMinutos(horarioBruto);
                    if (Number.isNaN(inicio)) return null;
                    let duracao = Number(a.duracao_min);
                    if (!Number.isFinite(duracao) || duracao <= 0) {
                        duracao = DURACAO_ENSAIO_MIN[a.ensaio] || 120;
                    }
                    return {
                        inicio: inicio - INTERVALO_ENTRE_ENSAIOS_MIN,
                        fim: inicio + duracao + INTERVALO_ENTRE_ENSAIOS_MIN
                    };
                })
                .filter(Boolean);

            const inicioMin = horarioParaMinutos(HORARIO_ABERTURA);
            const fimMin = horarioParaMinutos(HORARIO_FECHAMENTO);
            const livres = [];

            for (let t = inicioMin; t <= fimMin; t += INTERVALO_SLOTS_MIN) {
                const fimEnsaio = t + duracaoMin;
                if (fimEnsaio > fimMin) break;
                const conflita = ocupacoes.some(o => t < o.fim && fimEnsaio > o.inicio);
                if (!conflita) livres.push(minutosParaHorario(t));
            }

            return livres;

        } catch (e) {
            console.error('Erro ao consultar horários no chat:', e);
            return null;
        }
    }

    /* ---------- Motor de intenções ---------- */

    // Cada intenção tem palavras-chave e um handler. A ordem importa:
    // intenções mais específicas ficam antes das genéricas.
    const INTENCOES = [
        {
            nome: 'saudacao',
            padroes: [/\b(oi+|ol[aá]|opa|e a[íi]|bom\s*dia|boa\s*tarde|boa\s*noite|hey|hello)\b/i],
            handler: responderSaudacao
        },
        {
            nome: 'menu',
            padroes: [/\bmenu\b|op[cç][õo]es|voltar\s*ao?\s*menu|in[ií]cio/i],
            handler: responderMenu
        },
        {
            nome: 'horarios_disponiveis',
            padroes: [/hor[aá]rio.*(dispon|livre|vago)|(dispon|livre|vago).*hor[aá]rio/i],
            handler: responderHorariosDisponiveis
        },
        {
            nome: 'datas_disponiveis',
            padroes: [/data.*(dispon|livre|vago)|(dispon|livre|vago).*data|quando.*(vago|livre|dispon)/i],
            handler: responderDatasDisponiveis
        },
        {
            nome: 'valores',
            padroes: [/\bvalor(es)?\b|pre[çc]o|quanto\s*custa|or[çc]amento|investimento/i],
            handler: responderValores
        },
        {
            nome: 'casamento',
            padroes: [/casamento|wedding|noiv[oa]/i],
            handler: responderCasamento
        },
        {
            nome: 'individual',
            padroes: [/individual|retrato|book\s*pessoal/i],
            handler: responderIndividual
        },
        {
            nome: 'agendamento',
            padroes: [/agend|marcar|reservar|booking/i],
            handler: responderAgendamento
        },
        {
            nome: 'entrega',
            padroes: [/entrega|prazo|quanto\s*tempo/i],
            handler: responderEntrega
        },
        {
            nome: 'cancelamento',
            padroes: [/cancel|reembolso|remarcar/i],
            handler: responderCancelamento
        },
        {
            nome: 'galeria',
            padroes: [/galeria|portf[oó]lio|fotos\s*prontas|exemplos?/i],
            handler: responderGaleria
        },
        {
            nome: 'humano',
            padroes: [/atendente|humano|pessoa\s*de\s*verdade|falar\s*com\s*algu[ée]m/i],
            handler: responderHumano
        }
    ];

    function identificarIntencao(textoOriginal) {
        const texto = textoOriginal.toLowerCase();
        for (const intencao of INTENCOES) {
            if (intencao.padroes.some(regex => regex.test(texto))) {
                return intencao;
            }
        }
        return null;
    }

    /* ---------- Handlers de resposta ---------- */

    function responderSaudacao() {
        Chat.falar('😊 Oi! Que bom te ver por aqui.\n\nComo posso ajudar hoje?');
        Chat.sugerir([
            { label: '📋 Ver menu', valor: 'menu' },
            { label: '💰 Valores', valor: 'valores' },
            { label: '📅 Agendar', valor: 'agendar' }
        ]);
    }

    function responderMenu() {
        Chat.falar('📋 Menu principal\n\nEscolha uma opção ou digite sua dúvida:');
        Chat.sugerir([
            { label: '📸 Serviços', valor: 'serviços que vocês oferecem' },
            { label: '💰 Valores', valor: 'valores' },
            { label: '📅 Agendar', valor: 'agendar' },
            { label: '🗓️ Datas disponíveis', valor: 'quais datas estão disponíveis' },
            { label: '⏰ Horários disponíveis', valor: 'quais horários estão disponíveis' },
            { label: '🖼️ Galeria', valor: 'ver galeria' }
        ]);
    }

    function responderValores() {
        Chat.falar(VALORES_TEXTO);
        Chat.sugerir([
            { label: '📅 Quero agendar', valor: 'agendar' },
            { label: '🏠 Menu', valor: 'menu' }
        ]);
    }

    function responderCasamento() {
        Chat.falar(
            '💍 Casamento\n\nO pacote completo inclui:\n' +
            '• Cobertura de 8 horas\n' +
            '• Edição profissional de todas as fotos\n' +
            '• Galeria digital privada\n' +
            '• Prévias em 48h\n' +
            '• Entrega final em até 30 dias\n\n' +
            'Valor sob consulta, conforme o escopo do evento.'
        );
        Chat.sugerir([
            { label: '📅 Agendar consulta', valor: 'agendar' },
            { label: '🖼️ Ver galeria', valor: 'ver galeria' },
            { label: '🏠 Menu', valor: 'menu' }
        ]);
    }

    function responderIndividual() {
        Chat.falar(
            '👤 Ensaio Individual\n\nÓtimo para redes sociais, portfólio e uso profissional.\n\n' +
            '• Duração: 1h30 a 2h\n' +
            '• Valor: R$ 300 a R$ 500\n' +
            '• Edição incluída'
        );
        Chat.sugerir([
            { label: '📅 Agendar agora', valor: 'agendar' },
            { label: '🖼️ Ver exemplos', valor: 'ver galeria' }
        ]);
    }

    function responderAgendamento() {
        Chat.falar('📅 Perfeito! Para agendar, preencha nosso formulário rápido — leva menos de 2 minutos.');
        Chat.sugerirLinks([
            { label: '→ Ir para o formulário', link: 'form.html' }
        ]);
        Chat.sugerir([
            { label: '🗓️ Ver datas disponíveis antes', valor: 'quais datas estão disponíveis' },
            { label: '🏠 Menu', valor: 'menu' }
        ]);
    }

    function responderEntrega() {
        Chat.falar(
            '⏳ Prazos de entrega\n\n' +
            '• Prévias (seleção): 24 a 48 horas\n' +
            '• Entrega parcial (50%): 7 a 10 dias\n' +
            '• Entrega final (100%): 20 a 30 dias\n\n' +
            'Você acompanha tudo pela sua galeria privada.'
        );
        Chat.sugerir([
            { label: '📅 Quero agendar', valor: 'agendar' },
            { label: '🏠 Menu', valor: 'menu' }
        ]);
    }

    function responderCancelamento() {
        Chat.falar(
            '📋 Política de cancelamento\n\n' +
            '• Até 24h antes: reembolso total\n' +
            '• Menos de 24h: multa de 30% a 50%\n\n' +
            'Reagendamentos sem multa se avisados com antecedência.'
        );
        Chat.sugerir([
            { label: '📅 Agendar', valor: 'agendar' },
            { label: '🏠 Menu', valor: 'menu' }
        ]);
    }

    function responderGaleria() {
        Chat.falar('🖼️ Você pode ver nosso portfólio completo na seção Galeria, logo acima nesta página.');
        Chat.sugerirLinks([
            { label: '→ Ir para a Galeria', link: '#galeria' }
        ]);
        Chat.sugerir([
            { label: '🏠 Menu', valor: 'menu' }
        ]);
    }

    function responderHumano() {
        Chat.falar('💬 Sem problemas! Fale direto com nossa equipe pelo WhatsApp — respondemos rapidinho.');
        Chat.sugerirLinks([
            { label: '💬 Abrir WhatsApp', link: WHATSAPP_LINK }
        ]);
    }

    async function responderDatasDisponiveis() {
        Chat.digitando(true);

        const candidatos = proximosDiasUteis(10);
        const duracaoPadrao = DURACAO_ENSAIO_MIN.individual;
        const disponiveis = [];

        for (const dataIso of candidatos) {
            const livres = await contarHorariosLivres(dataIso, duracaoPadrao);
            if (livres === null) continue; // erro de consulta, pula o dia
            if (livres.length > 0) disponiveis.push(dataIso);
            if (disponiveis.length >= 5) break;
        }

        Chat.digitando(false);

        if (disponiveis.length === 0) {
            Chat.falar('🗓️ Não consegui confirmar datas livres agora. Que tal falar direto com a equipe ou tentar pelo formulário de agendamento?');
            Chat.sugerirLinks([{ label: '→ Ir para o formulário', link: 'form.html' }]);
            return;
        }

        const lista = disponiveis.map(d => '• ' + formatarDataBR(d)).join('\n');
        Chat.falar(`🗓️ Próximas datas com horários livres:\n\n${lista}\n\nOs horários exatos podem variar conforme o tipo de ensaio.`);
        Chat.sugerir([
            { label: '⏰ Ver horários de uma data', valor: 'quais horários estão disponíveis' },
            { label: '📅 Agendar', valor: 'agendar' }
        ]);
    }

    async function responderHorariosDisponiveis() {
        Chat.digitando(true);

        const [amanha] = proximosDiasUteis(1);
        const duracaoPadrao = DURACAO_ENSAIO_MIN.individual;
        const livres = await contarHorariosLivres(amanha, duracaoPadrao);

        Chat.digitando(false);

        if (livres === null) {
            Chat.falar('⏰ Não consegui consultar os horários agora. Você pode conferir direto no formulário de agendamento, em tempo real.');
            Chat.sugerirLinks([{ label: '→ Ir para o formulário', link: 'form.html' }]);
            return;
        }

        if (livres.length === 0) {
            Chat.falar(`⏰ Para ${formatarDataBR(amanha)} não há horários livres para um ensaio individual. Quer ver outras datas?`);
            Chat.sugerir([{ label: '🗓️ Ver datas disponíveis', valor: 'quais datas estão disponíveis' }]);
            return;
        }

        const amostra = livres.slice(0, 8).join('  •  ');
        Chat.falar(`⏰ Horários livres para ${formatarDataBR(amanha)} (ensaio individual):\n\n${amostra}\n\nPara outros tipos de ensaio a disponibilidade pode variar — o formulário mostra em tempo real.`);
        Chat.sugerir([
            { label: '📅 Agendar agora', valor: 'agendar' },
            { label: '🗓️ Ver outras datas', valor: 'quais datas estão disponíveis' }
        ]);
    }

    function responderDuvidaGenerica(entrada) {
        Chat.falar(
            'Entendi sua mensagem, mas não tenho certeza da resposta certa 🤔\n\n' +
            'Posso te ajudar com valores, agendamento, datas e horários disponíveis, ou você pode falar direto com nossa equipe.'
        );
        Chat.sugerir([
            { label: '📋 Ver menu', valor: 'menu' },
            { label: '💬 Falar com a equipe', valor: 'falar com atendente' }
        ]);
    }

    /* ---------- Núcleo do chat (estado, render, storage) ---------- */

    const Chat = {
        mensagens: [],
        elMensagens: null,
        elSugestoes: null,

        falar(texto) {
            this.mensagens.push({ texto, tipo: 'bot', hora: new Date() });
            this.renderizarUltima();
            this.salvar();
        },

        falarUsuario(texto) {
            this.mensagens.push({ texto, tipo: 'usuario', hora: new Date() });
            this.renderizarUltima();
            this.salvar();
            this.limparSugestoes();
        },

        sugerir(opcoes) {
            this.limparSugestoes();
            opcoes.forEach(op => {
                const chip = document.createElement('button');
                chip.className = 'chatbot-chip';
                chip.type = 'button';
                chip.textContent = op.label;
                chip.addEventListener('click', () => processarEntradaUsuario(op.valor));
                this.elSugestoes.appendChild(chip);
            });
        },

        sugerirLinks(links) {
            this.limparSugestoes();
            links.forEach(op => {
                const chip = document.createElement('button');
                chip.className = 'chatbot-chip';
                chip.type = 'button';
                chip.textContent = op.label;
                chip.addEventListener('click', () => {
                    if (/^https?:\/\//.test(op.link)) {
                        window.open(op.link, '_blank', 'noopener');
                    } else {
                        window.location.href = op.link;
                    }
                });
                this.elSugestoes.appendChild(chip);
            });
        },

        limparSugestoes() {
            if (this.elSugestoes) this.elSugestoes.innerHTML = '';
        },

        digitando(mostrar) {
            let el = document.getElementById('chatbotDigitando');
            if (mostrar) {
                if (el) return;
                el = document.createElement('div');
                el.id = 'chatbotDigitando';
                el.className = 'chatbot-digitando';
                el.innerHTML = '<span></span><span></span><span></span>';
                this.elMensagens.appendChild(el);
                this.scrollFinal();
            } else if (el) {
                el.remove();
            }
        },

        renderizarUltima() {
            const msg = this.mensagens[this.mensagens.length - 1];
            const div = document.createElement('div');
            div.className = `chatbot-msg ${msg.tipo}`;

            const hora = new Date(msg.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const textoEscapado = document.createElement('div');
            textoEscapado.textContent = msg.texto;

            div.innerHTML = textoEscapado.innerHTML + `<span class="chatbot-msg-hora">${hora}</span>`;
            this.elMensagens.appendChild(div);
            this.scrollFinal();
        },

        renderizarTudo() {
            this.elMensagens.innerHTML = '';
            this.mensagens.forEach(msg => {
                const div = document.createElement('div');
                div.className = `chatbot-msg ${msg.tipo}`;
                const hora = new Date(msg.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const textoEscapado = document.createElement('div');
                textoEscapado.textContent = msg.texto;
                div.innerHTML = textoEscapado.innerHTML + `<span class="chatbot-msg-hora">${hora}</span>`;
                this.elMensagens.appendChild(div);
            });
            this.scrollFinal();
        },

        scrollFinal() {
            this.elMensagens.scrollTop = this.elMensagens.scrollHeight;
        },

        salvar() {
            try {
                localStorage.setItem('motazt_chat_historico', JSON.stringify(this.mensagens));
            } catch (e) { /* localStorage indisponível: segue sem persistir */ }
        },

        carregar() {
            try {
                const salvo = localStorage.getItem('motazt_chat_historico');
                this.mensagens = salvo ? JSON.parse(salvo) : [];
            } catch (e) {
                this.mensagens = [];
            }
        }
    };

    async function processarEntradaUsuario(texto) {
        const valor = texto.trim();
        if (!valor) return;

        Chat.falarUsuario(valor);
        Chat.digitando(true);

        const intencao = identificarIntencao(valor);

        // Pequeno delay para simular digitação, deixando a conversa mais natural
        await new Promise(r => setTimeout(r, 500));
        Chat.digitando(false);

        if (intencao) {
            await intencao.handler();
        } else {
            responderDuvidaGenerica(valor);
        }
    }

    /* ---------- Abrir/fechar painel ---------- */

    function iniciarPainel() {
        const btnFab = document.getElementById('chatBotBtn');
        const painel = document.getElementById('chatbotPainel');
        const overlay = document.getElementById('chatbotOverlay');
        const btnFechar = document.getElementById('chatbotFechar');
        const input = document.getElementById('chatbotInput');
        const btnEnviar = document.getElementById('chatbotEnviar');
        const badge = document.getElementById('chatbotBadge');

        if (!btnFab || !painel) return;

        Chat.elMensagens = document.getElementById('chatbotMensagens');
        Chat.elSugestoes = document.getElementById('chatbotSugestoes');
        Chat.carregar();

        let aberto = false;
        let primeiraAberturaFeita = false;

        function abrir() {
            aberto = true;
            painel.classList.add('aberto');
            overlay.classList.add('ativo');
            btnFab.classList.add('aberto');
            painel.setAttribute('aria-hidden', 'false');
            badge.classList.add('oculto');

            if (Chat.mensagens.length > 0) {
                Chat.renderizarTudo();
            } else if (!primeiraAberturaFeita) {
                primeiraAberturaFeita = true;
                Chat.falar('Olá! 👋 Bem-vindo ao Motazt Studio.\n\nCom o que posso ajudar?');
                Chat.sugerir([
                    { label: '📸 Serviços', valor: 'serviços que vocês oferecem' },
                    { label: '💰 Valores', valor: 'valores' },
                    { label: '📅 Agendar', valor: 'agendar' },
                    { label: '🗓️ Datas disponíveis', valor: 'quais datas estão disponíveis' }
                ]);
            }

            setTimeout(() => input && input.focus(), 350);
        }

        function fechar() {
            aberto = false;
            painel.classList.remove('aberto');
            overlay.classList.remove('ativo');
            btnFab.classList.remove('aberto');
            painel.setAttribute('aria-hidden', 'true');
        }

        btnFab.addEventListener('click', () => {
            aberto ? fechar() : abrir();
        });

        btnFechar.addEventListener('click', fechar);
        overlay.addEventListener('click', fechar);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && aberto) fechar();
        });

        function enviarDoInput() {
            const texto = input.value;
            if (!texto.trim()) return;
            input.value = '';
            processarEntradaUsuario(texto);
        }

        btnEnviar.addEventListener('click', enviarDoInput);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                enviarDoInput();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarPainel);
    } else {
        iniciarPainel();
    }

})();
