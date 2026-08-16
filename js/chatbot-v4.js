/* ================================================
   CHATBOT MOTAZ STUDIO v5.2 — INTELIGÊNCIA PRO
   Ajuste de Teclado + Grade de Fotos (Estilo WhatsApp)
================================================ */

(function() {
    // ============ CONFIGURAÇÕES ============
    const CONFIG = {
        WHATSAPP_LINK: 'https://wa.me/5573981656986?text=Olá,%20quero%20fazer%20um%20agendamento!',
        TELEFONE_DISPLAY: '(73) 98165-6986',
        INSTAGRAM: 'motaz_studio',
        NOME_BOT: 'Motaz Assistant'
    };

    const VALORES = {
        'Individual': 'R$ 150 - 250',
        'Casal': 'R$ 200 - 350',
        'Família': 'R$ 250 - 400',
        'Gestante': 'R$ 180 - 280',
        'Casamento': 'R$ 500 - 1.500',
        'Evento': 'R$ 400 - 800'
    };

    // Estado do Chat
    let ESTADO_ATUAL = 'LIVRE'; // LIVRE, AGUARDANDO_CODIGO

    // ============ MAPEAMENTO DE INTENÇÕES ============
    const INTENCOES = [
        { 
            id: 'agendamento', 
            keywords: ['agendar', 'marcar', 'reserva', 'booking', 'contratar', 'fazer um ensaio'],
            icon: 'calendar'
        },
        {
            id: 'disponibilidade',
            keywords: [
                'disponivel', 'disponibilidade', 'horario', 'data', 'quando', 'dia', 'mes', 'vaga', 'tem vaga',
                'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
            ],
            icon: 'clock'
        },
        { 
            id: 'valores', 
            keywords: ['valor', 'preco', 'quanto', 'custo', 'tabela', 'orcamento', 'investimento'],
            icon: 'dollar-sign'
        },
        { 
            id: 'portfolio', 
            keywords: ['fotos', 'galeria', 'portfolio', 'trabalho', 'exemplo', 'ver', 'mostrar'],
            icon: 'image'
        },
        { 
            id: 'albuns', 
            keywords: ['meu ensaio', 'minha galeria', 'login', 'senha', 'acessar', 'albuns', 'privada', 'id', 'codigo'],
            icon: 'lock'
        },
        { 
            id: 'contato', 
            keywords: ['whatsapp', 'telefone', 'falar', 'equipe', 'humano', 'contato', 'zap', 'instagram', 'insta'],
            icon: 'message-circle'
        }
    ];

    // ============ MOTOR DE INTELIGÊNCIA ============
    function processarTexto(texto) {
        let t = texto.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[?¿!.,;:]/g, " ")
            .trim();
        
        // Se estiver aguardando código, qualquer texto que pareça um ID é tratado como tal
        if (ESTADO_ATUAL === 'AGUARDANDO_CODIGO') {
            if (t.length > 5) return 'processar_codigo';
        }

        const intencaoDireta = INTENCOES.find(i => i.id === t);
        if (intencaoDireta) return intencaoDireta.id;

        if (/\d{1,2}\/\d{1,2}/.test(t)) return 'disponibilidade';

        let melhorIntencao = null;
        let maiorPontuacao = 0;

        INTENCOES.forEach(int => {
            let pontos = 0;
            int.keywords.forEach(key => {
                const regex = new RegExp(`\\b${key}\\b`, 'i');
                if (regex.test(t) || t.includes(key)) {
                    pontos += (t.includes(key) ? 1 : 2);
                }
            });
            if (pontos > maiorPontuacao) {
                maiorPontuacao = pontos;
                melhorIntencao = int.id;
            }
        });

        if (maiorPontuacao > 0) return melhorIntencao;
        
        if (t.includes('oi') || t.includes('ola') || t.includes('bom dia') || t.includes('boa tarde')) return 'saudacao';
        if (t.includes('obrigado') || t.includes('valeu') || t.includes('obrigada')) return 'agradecimento';
        
        return null;
    }

    // ============ RESPOSTAS ============
    const RESPOSTAS = {
        saudacao: () => {
            Chat.falar(`Olá! Sou o assistente virtual do Motaz Studio. Como posso ajudar você hoje?`);
            mostrarMenu();
        },
        agendamento: () => {
            Chat.falar(`Com certeza! Para agendar seu ensaio, o melhor caminho é conversarmos pelo WhatsApp.`);
            Chat.sugerirLinks([{ label: 'Agendar no WhatsApp', link: CONFIG.WHATSAPP_LINK, icon: 'calendar' }]);
        },
        disponibilidade: () => {
            Chat.falar(`Temos horários flexíveis! Para eu te confirmar a disponibilidade exata, fale com nossa equipe no WhatsApp.`);
            Chat.sugerirLinks([{ label: 'Consultar Agenda', link: CONFIG.WHATSAPP_LINK, icon: 'clock' }]);
        },
        valores: () => {
            let msg = `**Nossos Investimentos:**\n\n`;
            for (const [tipo, valor] of Object.entries(VALORES)) {
                msg += `• ${tipo}: ${valor}\n`;
            }
            Chat.falar(msg);
            Chat.sugerir([{ label: 'Solicitar Orçamento', valor: 'contato', icon: 'file-text' }]);
        },
        portfolio: () => {
            Chat.falar(`Nossa galeria completa está disponível na seção **Portfólio** do site.`);
            Chat.sugerirLinks([{ label: 'Ver Portfólio', link: '#galeria', icon: 'external-link' }]);
        },
        albuns: () => {
            ESTADO_ATUAL = 'AGUARDANDO_CODIGO';
            Chat.falar(`Seu ensaio está guardado com carinho! **Por favor, digite o código do seu álbum aqui no chat** para eu buscar suas fotos.`);
        },
        processar_codigo: async (codigo) => {
            const idLimpo = codigo.trim().toLowerCase();
            Chat.falar(`Buscando álbum com o código: **${idLimpo}**...`);
            
            try {
                // Aguarda um pouco para o script de galerias carregar se necessário
                if (!window.GaleriaPrivada) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                if (window.GaleriaPrivada) {
                    const galeria = await window.GaleriaPrivada.validarGaleria(idLimpo);
                    if (galeria) {
                        const fotos = await window.GaleriaPrivada.listarFotosDaGaleria(galeria.id);
                        if (fotos && fotos.length > 0) {
                            Chat.falar(`Encontrei o álbum de **${galeria.cliente_nome || 'Cliente'}**! Aqui está uma prévia das fotos:`);
                            Chat.falarGradeFotos(fotos.slice(0, 4), galeria.id);
                            Chat.sugerirLinks([{ label: 'Acessar Álbum Completo', link: `/galeria-privada?id=${galeria.id}`, icon: 'external-link' }]);
                            ESTADO_ATUAL = 'LIVRE';
                            return;
                        } else {
                            Chat.falar(`Encontrei o álbum, mas ele ainda não possui fotos carregadas.`);
                        }
                    }
                }
                
                Chat.falar(`Humm, não encontrei nenhum álbum ativo com o código **${idLimpo}**. Certifique-se de que o código está correto ou que a galeria não expirou.`);
                Chat.sugerirLinks([
                    { label: 'Tentar Outro Código', valor: 'albuns', icon: 'refresh-cw' },
                    { label: 'Página de Login', link: '/galeria-privada', icon: 'lock' }
                ]);
            } catch (e) {
                console.error('Erro no Chatbot:', e);
                Chat.falar(`Ocorreu um erro técnico ao buscar seu álbum. Por favor, tente acessar pelo link direto.`);
                Chat.sugerirLinks([{ label: 'Acessar via Login', link: '/galeria-privada', icon: 'external-link' }]);
            }
            ESTADO_ATUAL = 'LIVRE';
        },
        contato: () => {
            Chat.falar(`Fale conosco pelo WhatsApp ou Instagram.`);
            Chat.sugerirLinks([
                { label: 'WhatsApp', link: CONFIG.WHATSAPP_LINK, icon: 'message-circle' },
                { label: 'Instagram', link: `https://instagram.com/${CONFIG.INSTAGRAM}`, icon: 'instagram' }
            ]);
        },
        agradecimento: () => {
            Chat.falar(`Por nada! Fico à disposição.`);
        },
        desconhecido: () => {
            Chat.falar(`Ainda estou aprendendo. Use os botões abaixo para encontrar o que precisa:`);
            mostrarMenu();
        }
    };

    function mostrarMenu() {
        Chat.sugerir([
            { label: 'Agendar Ensaio', valor: 'agendamento', icon: 'calendar' },
            { label: 'Ver Valores', valor: 'valores', icon: 'dollar-sign' },
            { label: 'Ver Portfólio', valor: 'portfolio', icon: 'image' },
            { label: 'Meus Álbuns', valor: 'albuns', icon: 'lock' },
            { label: 'Falar com Equipe', valor: 'contato', icon: 'message-circle' }
        ]);
    }

    // ============ INTERFACE DO CHAT ============
    const Chat = {
        elMsgs: null,
        elSugest: null,
        aberto: false,

        inicializar() {
            this.elMsgs = document.getElementById('chatbotMensagens');
            this.elSugest = document.getElementById('chatbotSugestoes');
            
            const btnFab = document.getElementById('chatBotBtn');
            const painel = document.getElementById('chatbotPainel');
            
            if (btnFab) {
                btnFab.innerHTML = '<i data-lucide="message-square"></i><span class="chatbot-fab-badge" id="chatbotBadge">1</span>';
            }

            const header = document.querySelector('.chatbot-header');
            if (header) {
                header.innerHTML = `
                    <div class="chatbot-header-info">
                        <div class="chatbot-avatar"><i data-lucide="camera"></i></div>
                        <div class="chatbot-header-texto">
                            <h3>Motaz Studio</h3>
                            <p><span class="chatbot-status-dot"></span> Online agora</p>
                        </div>
                    </div>
                    <div class="chatbot-header-buttons">
                        <button id="chatbotReiniciar" class="chatbot-btn-header" title="Reiniciar"><i data-lucide="rotate-ccw"></i></button>
                        <button id="chatbotFechar" class="chatbot-btn-header" title="Fechar"><i data-lucide="x"></i></button>
                    </div>
                `;
            }

            const btnEnviar = document.getElementById('chatbotEnviar');
            if (btnEnviar) {
                btnEnviar.innerHTML = '<i data-lucide="send"></i>';
            }

            this.vincularEventos();
            this.configurarAjusteTeclado();
            lucide.createIcons();
            
            setTimeout(() => {
                if (!this.aberto) {
                    const badge = document.getElementById('chatbotBadge');
                    if (badge) badge.classList.remove('oculto');
                }
            }, 2000);
        },

        configurarAjusteTeclado() {
            if (!window.visualViewport) return;

            const painel = document.getElementById('chatbotPainel');
            const handler = () => {
                if (window.innerWidth <= 500 && this.aberto) {
                    const height = window.visualViewport.height;
                    painel.style.height = `${height}px`;
                    painel.style.bottom = '0';
                    this.scroll();
                } else {
                    painel.style.height = '';
                    painel.style.bottom = '';
                }
            };

            window.visualViewport.addEventListener('resize', handler);
            window.visualViewport.addEventListener('scroll', handler);
        },

        vincularEventos() {
            const btnFab = document.getElementById('chatBotBtn');
            const btnFechar = document.getElementById('chatbotFechar');
            const btnReiniciar = document.getElementById('chatbotReiniciar');
            const btnEnviar = document.getElementById('chatbotEnviar');
            const input = document.getElementById('chatbotInput');
            const overlay = document.getElementById('chatbotOverlay');

            btnFab.addEventListener('click', () => this.alternarChat());
            if (btnFechar) btnFechar.addEventListener('click', () => this.fechar());
            if (btnReiniciar) btnReiniciar.addEventListener('click', () => this.reiniciar());
            if (overlay) overlay.addEventListener('click', () => this.fechar());
            if (btnEnviar) btnEnviar.addEventListener('click', () => this.enviar());
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.enviar();
                });
            }
        },

        alternarChat() { this.aberto ? this.fechar() : this.abrir(); },
        
        abrir() {
            this.aberto = true;
            document.getElementById('chatbotPainel').classList.add('aberto');
            document.getElementById('chatbotOverlay').classList.add('ativo');
            document.getElementById('chatbotBadge')?.classList.add('oculto');
            if (this.elMsgs.children.length === 0) {
                RESPOSTAS.saudacao();
            }
        },

        fechar() {
            this.aberto = false;
            document.getElementById('chatbotPainel').classList.remove('aberto');
            document.getElementById('chatbotOverlay').classList.remove('ativo');
        },

        falar(texto) {
            const div = document.createElement('div');
            div.className = 'chatbot-msg bot';
            if (window.MotaztSecurity) {
                div.innerHTML = window.MotaztSecurity.textToSafeHtml(texto);
            } else {
                div.textContent = String(texto ?? '');
            }
            this.elMsgs.appendChild(div);
            this.scroll();
        },

        falarGradeFotos(fotos, galeriaId) {
            const div = document.createElement('div');
            div.className = 'chatbot-msg bot';
            div.style.padding = '8px';
            
            const grid = document.createElement('div');
            grid.className = `chatbot-photo-grid count-${fotos.length}`;
            
            fotos.forEach(foto => {
                const img = document.createElement('img');
                const urlPreview = window.MotaztSecurity?.safeStorageUrl(foto.arquivo_preview);
                if (!urlPreview) return;
                img.src = urlPreview;
                img.alt = 'Foto do álbum';
                img.referrerPolicy = 'no-referrer';
                img.onclick = () => window.open(`/galeria-privada?id=${galeriaId}`, '_blank');
                grid.appendChild(img);
            });
            
            div.appendChild(grid);
            this.elMsgs.appendChild(div);
            this.scroll();
        },

        falarUsuario(texto) {
            const div = document.createElement('div');
            div.className = 'chatbot-msg usuario';
            div.textContent = texto;
            this.elMsgs.appendChild(div);
            this.limparSugestoes();
            this.scroll();
        },

        sugerir(opcoes) {
            this.limparSugestoes();
            opcoes.forEach(op => {
                const btn = document.createElement('button');
                btn.className = 'chatbot-chip';
                const icon = document.createElement('i');
                icon.setAttribute('data-lucide', String(op.icon || 'chevron-right'));
                btn.append(icon, document.createTextNode(` ${String(op.label || '')}`));
                btn.addEventListener('click', () => this.processar(op.valor));
                this.elSugest.appendChild(btn);
            });
            lucide.createIcons();
        },

        sugerirLinks(links) {
            this.limparSugestoes();
            links.forEach(op => {
                const btn = document.createElement('button');
                btn.className = 'chatbot-chip';
                const icon = document.createElement('i');
                icon.setAttribute('data-lucide', String(op.icon || 'external-link'));
                btn.append(icon, document.createTextNode(` ${String(op.label || '')}`));
                btn.addEventListener('click', () => {
                    const safeLink = window.MotaztSecurity?.safeUrl(op.link, { allowedHosts: ['wa.me', 'instagram.com', 'www.instagram.com'], allowSameOrigin: true });
                    if (safeLink) window.open(safeLink, '_blank', 'noopener,noreferrer');
                });
                this.elSugest.appendChild(btn);
            });
            lucide.createIcons();
        },

        limparSugestoes() { if (this.elSugest) this.elSugest.innerHTML = ''; },
        scroll() { this.elMsgs.scrollTo({ top: this.elMsgs.scrollHeight, behavior: 'smooth' }); },

        processar(texto) {
            if (!texto.trim()) return;
            this.falarUsuario(texto);
            
            const typing = document.createElement('div');
            typing.className = 'chatbot-msg bot';
            typing.innerHTML = '...';
            this.elMsgs.appendChild(typing);
            this.scroll();

            setTimeout(async () => {
                typing.remove();
                const intencao = processarTexto(texto);
                if (intencao === 'processar_codigo') {
                    await RESPOSTAS.processar_codigo(texto);
                } else if (intencao && RESPOSTAS[intencao]) {
                    RESPOSTAS[intencao](texto);
                } else {
                    RESPOSTAS.desconhecido();
                }
            }, 800);
        },

        enviar() {
            const input = document.getElementById('chatbotInput');
            const val = input.value;
            if (!val.trim()) return;
            input.value = '';
            this.processar(val);
        },

        reiniciar() {
            ESTADO_ATUAL = 'LIVRE';
            this.elMsgs.innerHTML = '';
            this.limparSugestoes();
            RESPOSTAS.saudacao();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Chat.inicializar());
    } else {
        Chat.inicializar();
    }
})();
