/* ======================================
   SUPABASE
====================================== */

const supabaseUrl = "https://tbwmsgztpyyratambgqs.supabase.co";
const supabaseKey = "sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";

const client = supabase.createClient(supabaseUrl, supabaseKey);


/* ======================================
   FORMULÁRIO
====================================== */

const formulario = document.getElementById('formulario');
const caixaMensagem = document.getElementById('mensagem');

/* ======================================
   PRÉ-PREENCHIMENTO VIA CHATBOT
   Se o usuário chegou do chatbot com um tipo de ensaio já
   escolhido (ex: form.html?ensaio=Casamento), preenche o select.
====================================== */
(function preencherDoChatbot() {
    const params = new URLSearchParams(window.location.search);
    const ensaioParam = params.get('ensaio');
    if (!ensaioParam) return;

    const selectEnsaio = document.getElementById('ensaio');
    if (!selectEnsaio) return;

    const match = Array.from(selectEnsaio.options).find(
        opt => opt.value.toLowerCase() === ensaioParam.toLowerCase()
    );
    if (match) {
        selectEnsaio.value = match.value;
    }
})();

/* ======================================
   RESTRIÇÕES DE DATA E HORÁRIO
====================================== */

const HORARIO_ABERTURA = '07:00';
const HORARIO_FECHAMENTO = '22:00';
const INTERVALO_ENTRE_ENSAIOS_MIN = 30; // minutos de intervalo obrigatório entre ensaios

// Duração máxima (em minutos) de cada tipo de ensaio.
// Usamos sempre o teto da faixa informada para nunca dar overbooking.
// Ajuste os valores de "Casamento", "Evento" e "Produção / Comercial" se necessário —
// não foram especificados, então usei um padrão de 2h (120 min).
const DURACAO_ENSAIO_MIN = {
    'Casamento': 240,              // não especificado — ajuste se preciso
    'Ensaio Individual': 120,      // 1h a 2h
    'Ensaio de Casal': 120,        // 1h30 a 2h
    'Ensaio Familiar': 180,        // 1h30 a 3h
    'Gestante': 120,               // 1h a 2h
    'Aniversário': 180,            // 1h a 3h
    'Evento': 240,                 // não especificado — ajuste se preciso
    'Produção / Comercial': 180    // não especificado — ajuste se preciso
};

function duracaoDoEnsaio(tipo) {
    return DURACAO_ENSAIO_MIN[tipo] || 120; // padrão de segurança: 2h
}

// Converte "HH:MM" em minutos desde 00:00
function horarioParaMinutos(horario) {
    const [h, m] = horario.split(':').map(Number);
    return h * 60 + m;
}

function minutosParaHorario(minutos) {
    const h = String(Math.floor(minutos / 60)).padStart(2, '0');
    const m = String(minutos % 60).padStart(2, '0');
    return `${h}:${m}`;
}

const campoData = document.querySelector('input[type="date"]');
const campoHorario = document.getElementById('horario');
const campoEnsaio = document.querySelector('select');
const gradeHorarios = document.getElementById('gradeHorarios');
const INTERVALO_SLOTS_MIN = 15; // de quanto em quanto tempo os botões de horário aparecem

if (campoData) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    campoData.min = `${ano}-${mes}-${dia}`;
}

/* ======================================
   GRADE DE HORÁRIOS DISPONÍVEIS
====================================== */

let ocupacoesDoDia = []; // [{ inicio: minutos, fim: minutos }] já incluindo o intervalo de 30min
let dataConsultada = null;

async function buscarHorariosDoDia(data) {
    if (!data) {
        ocupacoesDoDia = [];
        dataConsultada = null;
        return;
    }

    try {
        const { data: agendamentos, error } = await client
            .from('agendamentos')
            .select('horario, duracao_min, ensaio')
            .eq('data', data)
            .neq('status', 'cancelado');

        if (error) {
            console.error('Erro ao buscar horários ocupados:', error);
            ocupacoesDoDia = [];
            dataConsultada = null;
            return;
        }

        // Cada ocupação existente já "ocupa" seu horário + duração + 30min de intervalo
        // de cada lado, para garantir que nenhum novo ensaio caia colado nela.
        // Descartamos registros com horário ausente/inválido para não travar o dia inteiro.
        ocupacoesDoDia = (agendamentos || [])
            .map(a => {
                const horarioBruto = a.horario ? String(a.horario).slice(0, 5) : null;
                if (!horarioBruto || !/^\d{2}:\d{2}$/.test(horarioBruto)) return null;

                const inicio = horarioParaMinutos(horarioBruto);
                if (Number.isNaN(inicio)) return null;

                let duracao = Number(a.duracao_min);
                if (!Number.isFinite(duracao) || duracao <= 0) {
                    duracao = duracaoDoEnsaio(a.ensaio); // fallback seguro: usa o teto do tipo de ensaio, não um número fixo
                }

                return {
                    inicio: inicio - INTERVALO_ENTRE_ENSAIOS_MIN,
                    fim: inicio + duracao + INTERVALO_ENTRE_ENSAIOS_MIN
                };
            })
            .filter(Boolean);
        dataConsultada = data;

    } catch (erroFatal) {
        console.error('Erro fatal ao buscar horários:', erroFatal);
        ocupacoesDoDia = [];
        dataConsultada = null;
    }
}

// Verifica se o intervalo [inicio, fim) do novo ensaio conflita com algum já existente
function haConflitoDeHorario(inicioNovoMin, fimNovoMin) {
    return ocupacoesDoDia.some(ocup => inicioNovoMin < ocup.fim && fimNovoMin > ocup.inicio);
}

function selecionarHorario(horario, botao) {
    campoHorario.value = horario;
    gradeHorarios.querySelectorAll('.slot-horario').forEach(b => b.classList.remove('selecionado'));
    if (botao) botao.classList.add('selecionado');
}

async function renderizarGradeHorarios() {
    if (!gradeHorarios || !campoData || !campoEnsaio) return;

    const data = campoData.value;
    const tipoEnsaio = campoEnsaio.value;
    const horarioSelecionadoAntes = campoHorario.value;
    campoHorario.value = '';

    if (!data || !tipoEnsaio) {
        gradeHorarios.innerHTML = '<p class="grade-horarios-vazia">Selecione o tipo de ensaio e a data para ver os horários.</p>';
        return;
    }

    gradeHorarios.innerHTML = '<p class="grade-horarios-vazia">Carregando horários…</p>';

    if (dataConsultada !== data) {
        await buscarHorariosDoDia(data);
    }

    if (dataConsultada !== data) {
        gradeHorarios.innerHTML = '<p class="grade-horarios-erro">Não foi possível carregar os horários. Tente novamente.</p>';
        return;
    }

    const duracao = duracaoDoEnsaio(tipoEnsaio);
    const inicioMin = horarioParaMinutos(HORARIO_ABERTURA);
    const fimMin = horarioParaMinutos(HORARIO_FECHAMENTO);

    const slots = [];
    for (let t = inicioMin; t <= fimMin; t += INTERVALO_SLOTS_MIN) {
        const fimEnsaio = t + duracao;
        if (fimEnsaio > fimMin) break; // não cabe mais nenhum ensaio inteiro no dia
        slots.push({
            horario: minutosParaHorario(t),
            ocupado: haConflitoDeHorario(t, fimEnsaio)
        });
    }

    if (slots.length === 0) {
        gradeHorarios.innerHTML = '<p class="grade-horarios-vazia">Nenhum horário comporta esse tipo de ensaio nesse dia. Tente outra data.</p>';
        return;
    }

    gradeHorarios.innerHTML = '';

    slots.forEach(slot => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'slot-horario';
        btn.textContent = slot.horario;
        btn.disabled = slot.ocupado;

        if (!slot.ocupado) {
            btn.addEventListener('click', () => selecionarHorario(slot.horario, btn));
            if (slot.horario === horarioSelecionadoAntes) {
                selecionarHorario(slot.horario, btn);
            }
        }

        gradeHorarios.appendChild(btn);
    });

    const legenda = document.createElement('div');
    legenda.className = 'grade-horarios-legenda';
    legenda.innerHTML = `
        <span><i class="legenda-bolinha livre"></i> Livre</span>
        <span><i class="legenda-bolinha selecionado"></i> Selecionado</span>
        <span><i class="legenda-bolinha ocupado"></i> Indisponível</span>
    `;
    gradeHorarios.appendChild(legenda);
}

if (campoData) {
    campoData.addEventListener('change', renderizarGradeHorarios);
}

if (campoEnsaio) {
    campoEnsaio.addEventListener('change', renderizarGradeHorarios);
}

function mostrarMensagem(texto, erro) {
    if (!caixaMensagem) return;
    caixaMensagem.textContent = texto;
    caixaMensagem.style.color = erro ? '#ff4d4d' : '#2ecc71';
}

formulario.addEventListener('submit', async function (event) {

    event.preventDefault();

    const botao = formulario.querySelector('button[type="submit"]');
    const textoOriginalBotao = botao ? botao.textContent : '';
    if (botao) {
        botao.disabled = true;
        botao.textContent = 'Enviando...';
    }

    // Rate limiting: no máximo 5 envios de formulário por minuto neste navegador,
    // para evitar spam de agendamentos (lista-espera-cancelamento.js)
    if (typeof verificarRateLimiting === 'function') {
        const identificadorLocal = 'form-agendamento';
        const rate = verificarRateLimiting(identificadorLocal);
        if (!rate.permitido) {
            mostrarMensagem(rate.mensagem, true);
            if (botao) {
                botao.disabled = false;
                botao.textContent = textoOriginalBotao;
            }
            return;
        }
    }

    const nome = document.querySelector('input[type="text"]').value.trim();
    const email = document.querySelector('input[type="email"]').value.trim();
    const telefone = document.querySelector('input[type="tel"]').value.trim();
    const ensaio = document.querySelector('select').value;
    const data = document.querySelector('input[type="date"]').value;
    const horario = campoHorario.value;
    const mensagem = document.querySelector('textarea').value.trim();

    if (!horario) {
        mostrarMensagem('Selecione um horário disponível na grade acima.', true);
        if (botao) {
            botao.disabled = false;
            botao.textContent = textoOriginalBotao;
        }
        return;
    }

    // Validação: data não pode ser antes de hoje
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataEscolhida = new Date(data + 'T00:00:00');

    if (dataEscolhida < hoje) {
        mostrarMensagem('A data não pode ser anterior ao dia de hoje.', true);
        if (botao) {
            botao.disabled = false;
            botao.textContent = textoOriginalBotao;
        }
        return;
    }

    // Validação: horário deve estar dentro do funcionamento (07:00 - 22:00)
    if (horario < HORARIO_ABERTURA || horario > HORARIO_FECHAMENTO) {
        mostrarMensagem('Nosso horário de atendimento é das 7h às 22h. Escolha um horário dentro desse intervalo.', true);
        if (botao) {
            botao.disabled = false;
            botao.textContent = textoOriginalBotao;
        }
        return;
    }

    const duracaoNovo = duracaoDoEnsaio(ensaio);
    const inicioNovoMin = horarioParaMinutos(horario);
    const fimNovoMin = inicioNovoMin + duracaoNovo;

    // Validação: o ensaio não pode ultrapassar o horário de fechamento
    if (fimNovoMin > horarioParaMinutos(HORARIO_FECHAMENTO)) {
        mostrarMensagem(`Esse ensaio dura até ${minutosParaHorario(fimNovoMin)}, o que passa do horário de fechamento (22h). Escolha um horário mais cedo.`, true);
        if (botao) {
            botao.disabled = false;
            botao.textContent = textoOriginalBotao;
        }
        return;
    }

    // Validação: horário não pode conflitar com outro ensaio, considerando duração
    // de cada um e o intervalo obrigatório de 30min (revalida direto no banco por segurança)
    try {
        const { data: agendamentosDoDia, error: erroConflito } = await client
            .from('agendamentos')
            .select('horario, duracao_min, ensaio')
            .eq('data', data)
            .neq('status', 'cancelado');

        if (erroConflito) {
            console.error('Erro ao validar horário:', erroConflito);
        } else {
            const conflita = (agendamentosDoDia || []).some(a => {
                const horarioBruto = a.horario ? String(a.horario).slice(0, 5) : null;
                if (!horarioBruto || !/^\d{2}:\d{2}$/.test(horarioBruto)) return false;

                const inicioExistente = horarioParaMinutos(horarioBruto);
                let duracaoExistente = Number(a.duracao_min);
                if (!Number.isFinite(duracaoExistente) || duracaoExistente <= 0) {
                    duracaoExistente = duracaoDoEnsaio(a.ensaio);
                }
                const inicioComFolga = inicioExistente - INTERVALO_ENTRE_ENSAIOS_MIN;
                const fimComFolga = inicioExistente + duracaoExistente + INTERVALO_ENTRE_ENSAIOS_MIN;
                return inicioNovoMin < fimComFolga && fimNovoMin > inicioComFolga;
            });

            if (conflita) {
                // Sem vaga nesse horário: em vez de só bloquear, oferece lista de espera
                // (lista-espera-cancelamento.js)
                if (typeof ListaEspera === 'function') {
                    const listaEspera = new ListaEspera();
                    const entrada = listaEspera.adicionarALista({
                        nome: nome,
                        email: email,
                        telefone: telefone,
                        tipoEnsaio: ensaio,
                        dataDesejada: data
                    });
                    mostrarMensagem(
                        `Esse horário já está ocupado. Você foi adicionado à lista de espera (posição #${entrada.posicao}) e será avisado assim que uma vaga abrir.`,
                        true
                    );
                } else {
                    mostrarMensagem('Esse horário conflita com outro ensaio já agendado (considerando duração e intervalo de 30min). Escolha outro horário.', true);
                }
                if (botao) {
                    botao.disabled = false;
                    botao.textContent = textoOriginalBotao;
                }
                return;
            }
        }
    } catch (erroFatal) {
        console.error('Erro fatal ao validar horário:', erroFatal);
    }

    mostrarMensagem('Enviando agendamento...', false);

    try {
        const { error } = await client
            .from('agendamentos')
            .insert({
                nome: nome,
                email: email,
                telefone: telefone,
                ensaio: ensaio,
                data: data,
                horario: horario,
                duracao_min: duracaoNovo,
                mensagem: mensagem,
                status: 'pendente'
            });

        if (error) {
            console.error('Erro Supabase:', error);
            mostrarMensagem('Erro ao salvar agendamento: ' + error.message, true);
            if (botao) {
                botao.disabled = false;
                botao.textContent = textoOriginalBotao;
            }
            return;
        }

    } catch (erroFatal) {
        console.error('Erro fatal:', erroFatal);
        mostrarMensagem('Erro fatal ao salvar agendamento: ' + erroFatal.message, true);
        if (botao) {
            botao.disabled = false;
            botao.textContent = textoOriginalBotao;
        }
        return;
    }

    mostrarMensagem('Agendamento salvo com sucesso! Abrindo WhatsApp...', false);

    const texto =
`Olá, gostaria de fazer um agendamento!

Nome: ${nome}
Email: ${email}
Telefone: ${telefone}

Tipo de Ensaio: ${ensaio}

Data: ${data}
Horario: ${horario}

Mensagem:
${mensagem}`;

    const numero = '5573981656986';
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');

    formulario.reset();
    gradeHorarios.innerHTML = '<p class="grade-horarios-vazia">Selecione o tipo de ensaio e a data para ver os horários.</p>';
    ocupacoesDoDia = [];
    dataConsultada = null;

    if (botao) {
        botao.disabled = false;
        botao.textContent = textoOriginalBotao;
    }
});
