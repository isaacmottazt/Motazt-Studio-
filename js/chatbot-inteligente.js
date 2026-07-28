/* ============================================
   CHATBOT MOTAZT STUDIO — VERSÃO 2.0
   Inteligência avançada + Agendamento integrado
   + Sugestões contextuais + Análise de intenções
============================================ */

(function () {

    const supabaseUrlChat = "https://tbwmsgztpyyratambgqs.supabase.co";
    const supabaseKeyChat = "sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";

    const clientChat = (typeof supabase !== 'undefined')
        ? supabase.createClient(supabaseUrlChat, supabaseKeyChat)
        : null;

    // ============ CONFIGURAÇÕES ============
    const HORARIO_ABERTURA = '07:00';
    const HORARIO_FECHAMENTO = '22:00';
    const INTERVALO_ENTRE_ENSAIOS_MIN = 30;
    const INTERVALO_SLOTS_MIN = 30;

    const DURACAO_ENSAIO_MIN = {
        'Casamento': 240,
        'Ensaio Individual': 120,
        'Ensaio de Casal': 120,
        'Ensaio Familiar': 180,
        'Gestante': 120,
        'Aniversário': 180,
        'Evento': 240,
        'Produção / Comercial': 180
    };

    const VALORES_SERVICOS = {
        'Casamento': 'Sob consulta — cobertura completa com edição',
        'Ensaio Individual': 'R$ 300 a R$ 500',
        'Ensaio de Casal': 'R$ 400 a R$ 600',
        'Ensaio Familiar': 'R$ 500 a R$ 800',
        'Gestante': 'R$ 350 a R$ 550',
        'Aniversário': 'R$ 400 a R$ 700',
        'Evento': 'R$ 800 a R$ 2.000',
        'Produção / Comercial': 'R$ 1.000 a R$ 3.000'
    };

    const WHATSAPP_LINK = 'https://wa.me/5585999999999';

    // ============ ESTADO DO CHAT ============
    const estadoAgendamento = {
        nome: null,
        telefone: null,
        ensaio: null,
        data: null,
        horario: null,
        atividade: null, // rastreamento de contexto
        etapaAtual: null
    };

    // ============ UTILIDADES ============

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
        const nomeDia = new Date(`${isoDate}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' });
        return `${dia}/${mes}/${ano} (${nomeDia})`;
    }

    function proximosDiasUteis(qtd) {
        const dias = [];
        const hoje = new Date();
        let cursor = new Date(hoje);
        cursor.setDate(cursor.getDate() + 1);

        while (dias.length < qtd) {
            const diaSemana = cursor.getDay();
            if (diaSemana !== 0) {
                const iso = cursor.toISOString().slice(0, 10);
                dias.push(iso);
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return dias;
    }

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
            console.error('Erro ao consultar horários:', e);
            return null;
        }
    }

    // ============ MOTOR DE INTENÇÕES AVANÇADO ============

    // Palavras-chave expandidas para melhor detecção
    const PALAVRAS_CHAVE = {
        saudacao: /\b(oi+|ol[aá]|opa|e a[íi]|bom\s*dia|boa\s*tarde|boa\s*noite|hey|hello|opa|ei)\b/i,
        menu: /\bmenu\b|op[cç][õo]es|voltar\s*ao?(?:\s+|\\s*)?menu|in[ií]cio|comandos/i,
        horarios: /hor[aá]rio.*(dispon|livre|vago)|(dispon|livre|vago).*hor[aá]rio|que\s+horas|qual\s+hora/i,
        datas: /data.*(dispon|livre|vago)|(dispon|livre|vago).*data|quando.*(vago|livre|dispon|marcar)/i,
        valores: /\bvalor(es)?\b|pre[çc]o|quanto\s*custa|or[çc]amento|investimento|tabela\s+de\s+pre[çc]os/i,
        casamento: /casamento|wedding|noiv[oa]|casar|b[oó]das/i,
        individual: /individual|retrato|book\s*pessoal|solo|meu\s+ensaio\s+pessoal/i,
        casal: /casal|casal|dois|para\s+dois|couple/i,
        familiar: /familia|familiar|fam[íi]lia|todos\s+juntos|inteira/i,
        gestante: /gestante|gr[aá]vida|grav[íi]dez|barriga|barriguda/i,
        agendamento: /agend|marcar|reservar|booking|quero\s+agend|como\s+agend/i,
        entrega: /entrega|prazo|quanto\s+tempo|quando\s+recebo|quando\s+fico\s+com/i,
        cancelamento: /cancel|reembolso|remarcar|desmarcar|rescind|devolv|multa/i,
        galeria: /galeria|portf[oó]lio|fotos\s*prontas|exemplos?|seu\s+trabalho/i,
        humano: /atendente|humano|pessoa\s*de\s*verdade|falar\s*com\s*algu[ée]m|suporte|atendimento|equipe/i,
        whatsapp: /whatsapp|zap|wpp|conversar\s+l[aá]/i,
        evento: /evento|aniversário|corporate|festa|produto\s+launch/i,
        producao: /produ[çc][aã]o|comercial|editorial|publicit[aá]rio|branding/i
    };

    function identificarIntencoes(textoOriginal) {
        const texto = textoOriginal.toLowerCase();
        const intencoes = [];

        for (const [chave, regex] of Object.entries(PALAVRAS_CHAVE)) {
            if (regex.test(texto)) {
                intencoes.push(chave);
            }
        }

        return intencoes;
    }

    // ============ HANDLERS DE RESPOSTA ============

    function responderSaudacao() {
        Chat.falar('😊 Oi! Bem-vindo ao Motazt Studio!\n\nSou o assistente de agendamentos e posso te ajudar com valores, datas, horários e muito mais.\n\nCom o que posso ajudar hoje?');
        Chat.sugerir([
            { label: '📸 Conhecer serviços', valor: 'quais são os serviços' },
            { label: '💰 Ver valores', valor: 'valores' },
            { label: '📅 Agendar agora', valor: 'quero agendar' },
            { label: '🗓️ Datas disponíveis', valor: 'quais datas estão disponíveis' }
        ]);
    }

    function responderMenu() {\n        Chat.falar('📋 Menu — O que você gostaria de fazer?');\n        Chat.sugerir([\n            { label: '📸 Serviços', valor: 'serviços' },\n            { label: '💰 Valores', valor: 'valores' },\n            { label: '📅 Agendar', valor: 'agendar' },\n            { label: '🗓️ Datas livres', valor: 'datas disponíveis' },\n            { label: '⏰ Horários livres', valor: 'horários disponíveis' },\n            { label: '🖼️ Ver galeria', valor: 'galeria' },\n            { label: '💬 Falar com equipe', valor: 'falar com humano' }\n        ]);\n    }\n\n    function responderServicos() {\n        const texto = '📸 Nossos Serviços\\n\\n' +\n            '👤 **Ensaio Individual**\\n' +\n            '   Retrato, book pessoal, redes sociais.\\n' +\n            '   1h30 a 2h | ' + VALORES_SERVICOS['Ensaio Individual'] + '\\n\\n' +\n            '👫 **Ensaio de Casal**\\n' +\n            '   Pré-casamento, book de casal.\\n' +\n            '   1h30 a 2h | ' + VALORES_SERVICOS['Ensaio de Casal'] + '\\n\\n' +\n            '👨‍👩‍👧‍👦 **Ensaio Familiar**\\n' +\n            '   Fotos da família toda junta.\\n' +\n            '   1h30 a 3h | ' + VALORES_SERVICOS['Ensaio Familiar'] + '\\n\\n' +\n            '🤰 **Gestante**\\n' +\n            '   Celebrando a gravidez com arte.\\n' +\n            '   1h a 2h | ' + VALORES_SERVICOS['Gestante'] + '\\n\\n' +\n            '💍 **Casamento**\\n' +\n            '   Cobertura completa do seu grande dia.\\n' +\n            '   8h de cobertura | ' + VALORES_SERVICOS['Casamento'] + '\\n\\n' +\n            '🎉 **Evento**\\n' +\n            '   Aniversários, corporativos, celebrações.\\n' +\n            '   4h a 6h | ' + VALORES_SERVICOS['Evento'] + '\\n\\n' +\n            '📸 **Produção Comercial**\\n' +\n            '   Fotos para marcas, editorials, publicidade.\\n' +\n            '   Conforme projeto | ' + VALORES_SERVICOS['Produção / Comercial'];\n\n        Chat.falar(texto);\n        Chat.sugerir([\n            { label: '💰 Ver valores', valor: 'valores completos' },\n            { label: '📅 Agendar', valor: 'agendar' }\n        ]);\n    }\n\n    function responderValores() {\n        const texto = '💰 **Tabela de Valores**\\n\\n' +\n            Object.entries(VALORES_SERVICOS)\n                .map(([tipo, valor]) => `• ${tipo}: ${valor}`)\n                .join('\\n') +\n            '\\n\\nOs valores finais podem variar conforme duração, local e pacote. Todos incluem edição profissional.';\n\n        Chat.falar(texto);\n        Chat.sugerir([\n            { label: '📅 Quero agendar', valor: 'agendar' },\n            { label: '📸 Ver detalhes dos serviços', valor: 'serviços' }\n        ]);\n    }\n\n    function responderEntrega() {\n        Chat.falar('⏳ **Prazos de Entrega**\\n\\n' +\n            '⚡ **Prévias (seleção)**: 24 a 48 horas\\n' +\n            '🖼️ **Entrega parcial (50%)**: 7 a 10 dias\\n' +\n            '✨ **Entrega final (100%)**: 20 a 30 dias\\n\\n' +\n            'Você acompanha tudo pela sua galeria privada com login exclusivo.');\n        Chat.sugerir([\n            { label: '📅 Agendar agora', valor: 'agendar' }\n        ]);\n    }\n\n    function responderCancelamento() {\n        Chat.falar('📋 **Política de Cancelamento**\\n\\n' +\n            '✅ **Até 24h antes**: Reembolso total\\n' +\n            '⚠️ **Menos de 24h**: Multa de 30% a 50%\\n' +\n            '📅 **Reagendamento**: Sem multa com aviso prévio\\n\\n' +\n            'Você pode remarcar quantas vezes precisar (com exceção acima).');\n        Chat.sugerir([\n            { label: '📅 Agendar', valor: 'agendar' },\n            { label: '💬 Falar com equipe', valor: 'falar com humano' }\n        ]);\n    }\n\n    function responderGaleria() {\n        Chat.falar('🖼️ Você pode ver nosso portfólio completo logo acima, na seção **Galeria**. Lá você verá ensaios de casamentos, famílias, eventos e muito mais!');\n        Chat.sugerirLinks([\n            { label: '→ Ir para a Galeria', link: '#galeria' }\n        ]);\n        Chat.sugerir([\n            { label: '📅 Agendar', valor: 'agendar' }\n        ]);\n    }\n\n    function responderHumano() {\n        Chat.falar('💬 Sem problemas! Fale direto com nossa equipe pelo **WhatsApp** — respondemos rapidinho!');\n        Chat.sugerirLinks([\n            { label: '💬 Abrir WhatsApp', link: WHATSAPP_LINK }\n        ]);\n    }\n\n    async function responderDatasDisponiveis() {\n        Chat.digitando(true);\n\n        const candidatos = proximosDiasUteis(10);\n        const duracaoPadrao = estadoAgendamento.ensaio\n            ? DURACAO_ENSAIO_MIN[estadoAgendamento.ensaio] || 120\n            : DURACAO_ENSAIO_MIN['Ensaio Individual'];\n        const disponiveis = [];\n\n        for (const dataIso of candidatos) {\n            const livres = await contarHorariosLivres(dataIso, duracaoPadrao);\n            if (livres === null) continue;\n            if (livres.length > 0) disponiveis.push(dataIso);\n            if (disponiveis.length >= 7) break;\n        }\n\n        Chat.digitando(false);\n\n        if (disponiveis.length === 0) {\n            Chat.falar('🗓️ Não consegui confirmar datas livres no momento. Entre em contato direto ou tente novamente em breve.');\n            Chat.sugerirLinks([\n                { label: '💬 Abrir WhatsApp', link: WHATSAPP_LINK }\n            ]);\n            return;\n        }\n\n        const lista = disponiveis.map(d => formatarDataBR(d)).join('\\n• ');\n        Chat.falar(`🗓️ **Próximas datas com horários livres:**\\n\\n• ${lista}\\n\\nDesde já podemos sugerir os melhores horários de acordo com sua preferência!`);\n        Chat.sugerir([\n            { label: '⏰ Ver horários disponíveis', valor: 'mostrar horários' },\n            { label: '📅 Vou agendar', valor: 'agendar' }\n        ]);\n    }\n\n    async function responderHorariosDisponiveis() {\n        Chat.digitando(true);\n\n        const [amanha] = proximosDiasUteis(1);\n        const duracaoPadrao = estadoAgendamento.ensaio\n            ? DURACAO_ENSAIO_MIN[estadoAgendamento.ensaio] || 120\n            : DURACAO_ENSAIO_MIN['Ensaio Individual'];\n        const livres = await contarHorariosLivres(amanha, duracaoPadrao);\n\n        Chat.digitando(false);\n\n        if (livres === null) {\n            Chat.falar('⏰ Não consegui consultar no momento. Veja no formulário de agendamento em tempo real!');\n            Chat.sugerirLinks([{ label: '→ Ir para agendamento', link: 'form.html' }]);\n            return;\n        }\n\n        if (livres.length === 0) {\n            Chat.falar(`⏰ Para ${formatarDataBR(amanha)} todos os horários estão ocupados. Quer ver outras datas?`);\n            Chat.sugerir([{ label: '🗓️ Ver datas disponíveis', valor: 'datas disponíveis' }]);\n            return;\n        }\n\n        const amostra = livres.slice(0, 12).join(' • ');\n        Chat.falar(`⏰ **Horários livres para ${formatarDataBR(amanha)}:**\\n\\n${amostra}\\n\\nPode selecionar qualquer um destes!`);\n        Chat.sugerir([\n            { label: '📅 Agendar com estes horários', valor: 'agendar' },\n            { label: '🗓️ Ver outras datas', valor: 'datas disponíveis' }\n        ]);\n    }\n\n    async function iniciarAgendamentoNoChat() {\n        estadoAgendamento.etapaAtual = 'nome';\n        Chat.falar('🎉 Ótimo! Vamos agendar seu ensaio.\\n\\nPrimeiro, qual é o seu nome?');\n    }\n\n    async function coletarDadosAgendamento(entrada) {\n        const stage = estadoAgendamento.etapaAtual;\n\n        if (stage === 'nome') {\n            estadoAgendamento.nome = entrada.trim();\n            estadoAgendamento.etapaAtual = 'telefone';\n            Chat.falar(`😊 Prazer, ${estadoAgendamento.nome}!\\n\\nAgora, qual é seu telefone/WhatsApp? (com DDD)`);\n            return true;\n        }\n\n        if (stage === 'telefone') {\n            estadoAgendamento.telefone = entrada.trim();\n            estadoAgendamento.etapaAtual = 'ensaio';\n            Chat.falar('📱 Perfeito! Agora, qual tipo de ensaio você gostaria?');\n            Chat.sugerir([\n                { label: '👤 Individual', valor: 'Ensaio Individual' },\n                { label: '👫 Casal', valor: 'Ensaio de Casal' },\n                { label: '👨‍👩‍👧‍👦 Família', valor: 'Ensaio Familiar' },\n                { label: '🤰 Gestante', valor: 'Gestante' },\n                { label: '💍 Casamento', valor: 'Casamento' },\n                { label: '🎉 Evento', valor: 'Evento' },\n                { label: '📸 Produção', valor: 'Produção / Comercial' }\n            ]);\n            return true;\n        }\n\n        if (stage === 'ensaio') {\n            const tiposValidos = Object.keys(DURACAO_ENSAIO_MIN);\n            const tipoBuscado = tiposValidos.find(t => t.toLowerCase() === entrada.toLowerCase());\n\n            if (tipoBuscado) {\n                estadoAgendamento.ensaio = tipoBuscado;\n                estadoAgendamento.etapaAtual = 'data';\n                Chat.falar(`📸 ${tipoBuscado} — ótima escolha!\\n\\nPara qual data você gostaria?\\n\\n${VALORES_SERVICOS[tipoBuscado]}`);\n                Chat.sugerir([\n                    { label: '📅 Ver próximas datas', valor: 'mostrar datas' },\n                    { label: '✍️ Digitar data', valor: 'digitar data' }\n                ]);\n                return true;\n            }\n\n            Chat.falar('❌ Não reconheci esse tipo. Qual desses você prefere?');\n            Chat.sugerir([\n                { label: '👤 Individual', valor: 'Ensaio Individual' },\n                { label: '👫 Casal', valor: 'Ensaio de Casal' },\n                { label: '👨‍👩‍👧‍👦 Família', valor: 'Ensaio Familiar' },\n                { label: '🤰 Gestante', valor: 'Gestante' }\n            ]);\n            return true;\n        }\n\n        if (stage === 'data') {\n            const regex = /(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{4})/;\n            const match = entrada.match(regex);\n\n            if (match) {\n                const [_, dia, mes, ano] = match;\n                const dataFormatada = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;\n                estadoAgendamento.data = dataFormatada;\n                estadoAgendamento.etapaAtual = 'horario';\n\n                Chat.falar(`📅 ${formatarDataBR(dataFormatada)}\\n\\nAgora escolha um horário:`);\n                const duracaoEnsaio = DURACAO_ENSAIO_MIN[estadoAgendamento.ensaio] || 120;\n                await exibirHorariosChatInteligente(dataFormatada, duracaoEnsaio);\n                return true;\n            }\n\n            Chat.falar('❌ Formato de data inválido. Digite assim: 15/07/2026');\n            return true;\n        }\n\n        if (stage === 'horario') {\n            const horariosValidos = /(\\d{1,2}):(\\d{2})/g.exec(entrada);\n            if (horariosValidos) {\n                const horario = `${String(horariosValidos[1]).padStart(2, '0')}:${horariosValidos[2]}`;\n                estadoAgendamento.horario = horario;\n                await finalizarAgendamento();\n                return true;\n            }\n\n            Chat.falar('❌ Horário inválido. Digite assim: 14:30');\n            return true;\n        }\n\n        return false;\n    }\n\n    async function exibirHorariosChatInteligente(dataIso, duracaoMin) {\n        Chat.digitando(true);\n        const livres = await contarHorariosLivres(dataIso, duracaoMin);\n        Chat.digitando(false);\n\n        if (!livres || livres.length === 0) {\n            Chat.falar('❌ Sem horários livres para esta data. Quer escolher outro dia?');\n            Chat.sugerir([\n                { label: '🗓️ Ver datas disponíveis', valor: 'datas' },\n                { label: '📅 Digitar outra data', valor: 'nova data' }\n            ]);\n            return;\n        }\n\n        const amostra = livres.slice(0, 10);\n        amostra.forEach(h => {\n            // Criar chips para cada horário\n        });\n\n        const stringHorarios = amostra.join(' • ');\n        Chat.falar(`⏰ **Horários disponíveis:**\\n\\n${stringHorarios}\\n\\nQual você prefere? (Digite no formato HH:MM, ex: 14:30)`);\n    }\n\n    async function finalizarAgendamento() {\n        if (!estadoAgendamento.nome || !estadoAgendamento.telefone || !estadoAgendamento.ensaio || !estadoAgendamento.data || !estadoAgendamento.horario) {\n            Chat.falar('❌ Faltam dados. Não consegui processar seu agendamento.');\n            return;\n        }\n\n        Chat.falar('⏳ Processando seu agendamento...');\n        Chat.digitando(true);\n\n        try {\n            const duracao = DURACAO_ENSAIO_MIN[estadoAgendamento.ensaio] || 120;\n\n            const { error } = await clientChat\n                .from('agendamentos')\n                .insert([{\n                    nome: estadoAgendamento.nome,\n                    telefone: estadoAgendamento.telefone,\n                    ensaio: estadoAgendamento.ensaio,\n                    data: estadoAgendamento.data,\n                    horario: estadoAgendamento.horario,\n                    duracao_min: duracao,\n                    status: 'confirmado'\n                }]);\n\n            Chat.digitando(false);\n\n            if (error) throw error;\n\n            Chat.falar(\n                `✅ **Agendamento confirmado!**\\n\\n` +\n                `📛 ${estadoAgendamento.nome}\\n` +\n                `📱 ${estadoAgendamento.telefone}\\n` +\n                `📸 ${estadoAgendamento.ensaio}\\n` +\n                `📅 ${formatarDataBR(estadoAgendamento.data)}\\n` +\n                `⏰ ${estadoAgendamento.horario}\\n\\n` +\n                `Você receberá uma confirmação no WhatsApp. Qualquer dúvida, é só chamar! 😊`\n            );\n\n            // Resetar estado\n            Object.keys(estadoAgendamento).forEach(k => estadoAgendamento[k] = null);\n\n            Chat.sugerir([\n                { label: '🖼️ Ver galeria', valor: 'galeria' },\n                { label: '📞 Falar com equipe', valor: 'falar com humano' },\n                { label: '📋 Menu', valor: 'menu' }\n            ]);\n\n        } catch (erro) {\n            Chat.digitando(false);\n            console.error('Erro ao agendar:', erro);\n            Chat.falar('❌ Houve um erro ao processar. Tente novamente ou fale com nossa equipe pelo WhatsApp.');\n            Chat.sugerirLinks([\n                { label: '💬 Abrir WhatsApp', link: WHATSAPP_LINK }\n            ]);\n        }\n    }\n\n    function responderDuvidaGenerica(entrada) {\n        Chat.falar('🤔 Não entendi bem, mas posso ajudar com:\\n\\n📅 Agendamento • 💰 Valores • 🗓️ Datas e horários • 📸 Serviços\\n\\nQual desses?');\n        Chat.sugerir([\n            { label: '📋 Menu', valor: 'menu' },\n            { label: '💬 Falar com equipe', valor: 'falar com humano' }\n        ]);\n    }\n\n    // ============ NÚCLEO DO CHAT ============\n\n    const Chat = {\n        mensagens: [],\n        elMensagens: null,\n        elSugestoes: null,\n        emAgendamento: false,\n\n        falar(texto) {\n            this.mensagens.push({ texto, tipo: 'bot', hora: new Date() });\n            this.renderizarUltima();\n            this.salvar();\n        },\n\n        falarUsuario(texto) {\n            this.mensagens.push({ texto, tipo: 'usuario', hora: new Date() });\n            this.renderizarUltima();\n            this.salvar();\n            this.limparSugestoes();\n        },\n\n        sugerir(opcoes) {\n            this.limparSugestoes();\n            opcoes.forEach(op => {\n                const chip = document.createElement('button');\n                chip.className = 'chatbot-chip';\n                chip.type = 'button';\n                chip.textContent = op.label;\n                chip.addEventListener('click', () => processarEntradaUsuario(op.valor));\n                this.elSugestoes.appendChild(chip);\n            });\n        },\n\n        sugerirLinks(links) {\n            this.limparSugestoes();\n            links.forEach(op => {\n                const chip = document.createElement('button');\n                chip.className = 'chatbot-chip';\n                chip.type = 'button';\n                chip.textContent = op.label;\n                chip.addEventListener('click', () => {\n                    if (/^https?:\\/\\//.test(op.link)) {\n                        window.open(op.link, '_blank', 'noopener');\n                    } else {\n                        window.location.href = op.link;\n                    }\n                });\n                this.elSugestoes.appendChild(chip);\n            });\n        },\n\n        limparSugestoes() {\n            if (this.elSugestoes) this.elSugestoes.innerHTML = '';\n        },\n\n        digitando(mostrar) {\n            let el = document.getElementById('chatbotDigitando');\n            if (mostrar) {\n                if (el) return;\n                el = document.createElement('div');\n                el.id = 'chatbotDigitando';\n                el.className = 'chatbot-digitando';\n                el.innerHTML = '<span></span><span></span><span></span>';\n                this.elMensagens.appendChild(el);\n                this.scrollFinal();\n            } else if (el) {\n                el.remove();\n            }\n        },\n\n        renderizarUltima() {\n            const msg = this.mensagens[this.mensagens.length - 1];\n            const div = document.createElement('div');\n            div.className = `chatbot-msg ${msg.tipo}`;\n\n            const hora = new Date(msg.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });\n            const textoEscapado = document.createElement('div');\n            textoEscapado.textContent = msg.texto;\n\n            div.innerHTML = textoEscapado.innerHTML + `<span class=\"chatbot-msg-hora\">${hora}</span>`;\n            this.elMensagens.appendChild(div);\n            this.scrollFinal();\n        },\n\n        renderizarTudo() {\n            this.elMensagens.innerHTML = '';\n            this.mensagens.forEach(msg => {\n                const div = document.createElement('div');\n                div.className = `chatbot-msg ${msg.tipo}`;\n                const hora = new Date(msg.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });\n                const textoEscapado = document.createElement('div');\n                textoEscapado.textContent = msg.texto;\n                div.innerHTML = textoEscapado.innerHTML + `<span class=\"chatbot-msg-hora\">${hora}</span>`;\n                this.elMensagens.appendChild(div);\n            });\n            this.scrollFinal();\n        },\n\n        scrollFinal() {\n            this.elMensagens.scrollTop = this.elMensagens.scrollHeight;\n        },\n\n        salvar() {\n            try {\n                localStorage.setItem('motazt_chat_historico', JSON.stringify(this.mensagens));\n            } catch (e) { }\n        },\n\n        carregar() {\n            try {\n                const salvo = localStorage.getItem('motazt_chat_historico');\n                this.mensagens = salvo ? JSON.parse(salvo) : [];\n            } catch (e) {\n                this.mensagens = [];\n            }\n        }\n    };\n\n    async function processarEntradaUsuario(texto) {\n        const valor = texto.trim();\n        if (!valor) return;\n\n        Chat.falarUsuario(valor);\n        Chat.digitando(true);\n\n        // Se está em agendamento, coletar dados\n        if (estadoAgendamento.etapaAtual) {\n            const coletou = await coletarDadosAgendamento(valor);\n            Chat.digitando(false);\n            if (coletou) return;\n        }\n\n        const intencoes = identificarIntencoes(valor);\n        await new Promise(r => setTimeout(r, 300));\n        Chat.digitando(false);\n\n        // Mapear intenções para handlers\n        const handlers = {\n            saudacao: responderSaudacao,\n            menu: responderMenu,\n            valores: responderValores,\n            servicos: responderServicos,\n            casamento: () => responderServicos(), // redireciona para serviços\n            individual: () => responderServicos(),\n            casal: () => responderServicos(),\n            familiar: () => responderServicos(),\n            gestante: () => responderServicos(),\n            evento: () => responderServicos(),\n            producao: () => responderServicos(),\n            horarios: responderHorariosDisponiveis,\n            datas: responderDatasDisponiveis,\n            entrega: responderEntrega,\n            cancelamento: responderCancelamento,\n            galeria: responderGaleria,\n            humano: responderHumano,\n            whatsapp: responderHumano,\n            agendamento: iniciarAgendamentoNoChat\n        };\n\n        let executoualgo = false;\n        for (const intencao of intencoes) {\n            if (handlers[intencao]) {\n                await handlers[intencao]();\n                executoualgo = true;\n                break; // Executa apenas a primeira intenção principal\n            }\n        }\n\n        if (!executoualgo) {\n            responderDuvidaGenerica(valor);\n        }\n    }\n\n    // ============ ABRIR/FECHAR PAINEL ============\n\n    function iniciarPainel() {\n        const btnFab = document.getElementById('chatBotBtn');\n        const painel = document.getElementById('chatbotPainel');\n        const overlay = document.getElementById('chatbotOverlay');\n        const btnFechar = document.getElementById('chatbotFechar');\n        const input = document.getElementById('chatbotInput');\n        const btnEnviar = document.getElementById('chatbotEnviar');\n        const badge = document.getElementById('chatbotBadge');\n\n        if (!btnFab || !painel) return;\n\n        Chat.elMensagens = document.getElementById('chatbotMensagens');\n        Chat.elSugestoes = document.getElementById('chatbotSugestoes');\n        Chat.carregar();\n\n        let aberto = false;\n        let primeiraAberturaFeita = false;\n\n        function abrir() {\n            aberto = true;\n            painel.classList.add('aberto');\n            overlay.classList.add('ativo');\n            btnFab.classList.add('aberto');\n            painel.setAttribute('aria-hidden', 'false');\n            badge.classList.add('oculto');\n\n            if (Chat.mensagens.length > 0) {\n                Chat.renderizarTudo();\n            } else if (!primeiraAberturaFeita) {\n                primeiraAberturaFeita = true;\n                Chat.falar('👋 Oi! Bem-vindo ao Motazt Studio!\\n\\nSou o assistente de agendamentos. Como posso te ajudar?');\n                Chat.sugerir([\n                    { label: '📸 Ver serviços', valor: 'serviços' },\n                    { label: '💰 Ver valores', valor: 'valores' },\n                    { label: '📅 Agendar agora', valor: 'agendar' },\n                    { label: '🗓️ Datas disponíveis', valor: 'datas' }\n                ]);\n            }\n\n            setTimeout(() => input && input.focus(), 350);\n        }\n\n        function fechar() {\n            aberto = false;\n            painel.classList.remove('aberto');\n            overlay.classList.remove('ativo');\n            btnFab.classList.remove('aberto');\n            painel.setAttribute('aria-hidden', 'true');\n        }\n\n        btnFab.addEventListener('click', () => {\n            aberto ? fechar() : abrir();\n        });\n\n        btnFechar.addEventListener('click', fechar);\n        overlay.addEventListener('click', fechar);\n\n        document.addEventListener('keydown', (e) => {\n            if (e.key === 'Escape' && aberto) fechar();\n        });\n\n        function enviarDoInput() {\n            const texto = input.value;\n            if (!texto.trim()) return;\n            input.value = '';\n            processarEntradaUsuario(texto);\n        }\n\n        btnEnviar.addEventListener('click', enviarDoInput);\n        input.addEventListener('keydown', (e) => {\n            if (e.key === 'Enter') {\n                e.preventDefault();\n                enviarDoInput();\n            }\n        });\n    }\n\n    if (document.readyState === 'loading') {\n        document.addEventListener('DOMContentLoaded', iniciarPainel);\n    } else {\n        iniciarPainel();\n    }\n\n})();\n