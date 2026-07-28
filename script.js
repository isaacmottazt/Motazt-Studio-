/* ======================================
   SUPABASE
====================================== */

const supabaseUrl = "https://tbwmsgztpyyratambgqs.supabase.co";
const supabaseKey = "sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";

const client = supabase.createClient(supabaseUrl, supabaseKey);


/* ======================================
   ELEMENTOS
====================================== */

const galeriaContainer = document.getElementById('galeria-container');
const destaqueContainer = document.getElementById('destaque-container');

const lightbox = document.querySelector('.lightbox');
const lightboxImg = document.querySelector('.lightbox-img');

const fechar = document.querySelector('.fechar');

const anterior = document.querySelector('.anterior');
const proximo = document.querySelector('.proximo');

let imagens = [];
let indexAtual = 0;

/* ======================================
   HAMBURGER MENU
====================================== */

const menuToggle = document.getElementById('menuToggle');
const menu = document.getElementById('menu');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        menu.classList.toggle('active');
    });

    menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            menu.classList.remove('active');
        });
    });
}


/* ======================================
   CARREGAR GALERIA DO SUPABASE
====================================== */

async function carregarGaleria() {

    try {
        const { data, error } = await client
            .from('galeria')
            .select('*')
            .order('ordem', { ascending: true, nullsFirst: false })
            .order('id', { ascending: false });

        if (error) {
            console.error('Erro ao carregar galeria:', error);
            galeriaContainer.innerHTML = '<p class="galeria-erro">Não foi possível carregar as fotos.</p>';
            return;
        }

        if (!data || data.length === 0) {
            galeriaContainer.innerHTML = '<p class="galeria-vazia">Nenhuma foto disponível ainda.</p>';
            return;
        }

        galeriaContainer.innerHTML = '';
        estadoMosaico = null; // reseta o estado a cada carregamento da galeria

        data.forEach((item, index) => {
            const img = document.createElement('img');
            img.alt = 'Foto ' + (index + 1);
            img.decoding = 'async';
            // Nota: não usamos loading="lazy" aqui porque o mosaico usa
            // position:absolute — o navegador não consegue calcular
            // corretamente quais fotos estão "fora da tela" nesse caso,
            // o que travava o carregamento das imagens mais abaixo.

            galeriaContainer.appendChild(img);

            // Assim que ESTA foto carregar, ela já entra no mosaico —
            // não espera as outras, então a galeria não trava/congela
            img.addEventListener('load', () => posicionarFoto(img));
            img.addEventListener('error', () => posicionarFoto(img));

            img.src = item.imagem_url;
        });

        ativarLightbox();
        window.addEventListener('resize', debounce(montarMosaico, 200));

    } catch (erroFatal) {
        console.error('Erro fatal ao carregar galeria:', erroFatal);
        galeriaContainer.innerHTML = '<p class="galeria-erro">Erro ao carregar as fotos.</p>';
    }
}


/* ======================================
   MOSAICO DINÂMICO (masonry real por colunas,
   compacto no celular e sem espaços vazios)
====================================== */

// Guarda o estado atual do mosaico (colunas, larguras e alturas acumuladas)
// para não precisar reler o DOM a cada foto que termina de carregar
let estadoMosaico = null;

function getConfigMosaico() {
    const largura = window.innerWidth;
    if (largura <= 480) return { colunas: 2, gap: 6 };
    if (largura <= 768) return { colunas: 2, gap: 8 };
    if (largura <= 1100) return { colunas: 3, gap: 12 };
    return { colunas: 4, gap: 14 };
}

function iniciarEstadoMosaico() {
    const { colunas, gap } = getConfigMosaico();
    const larguraTotal = galeriaContainer.clientWidth;
    const larguraColuna = (larguraTotal - gap * (colunas - 1)) / colunas;

    estadoMosaico = {
        colunas,
        gap,
        larguraColuna,
        alturas: new Array(colunas).fill(0)
    };
}

// Posiciona só a foto que acabou de carregar, direto na coluna mais curta.
// O mosaico cresce suavemente foto a foto, sem travar esperando tudo carregar.
function posicionarFoto(img) {
    if (!estadoMosaico) iniciarEstadoMosaico();
    const { colunas, gap, larguraColuna, alturas } = estadoMosaico;

    const proporcao = (img.naturalWidth && img.naturalHeight)
        ? img.naturalWidth / img.naturalHeight
        : 1;
    const alturaFoto = larguraColuna / proporcao;

    let colunaMenor = 0;
    for (let i = 1; i < colunas; i++) {
        if (alturas[i] < alturas[colunaMenor]) colunaMenor = i;
    }

    const x = colunaMenor * (larguraColuna + gap);
    const y = alturas[colunaMenor];

    img.style.width = larguraColuna + 'px';
    img.style.height = alturaFoto + 'px';
    img.style.transform = `translate(${x}px, ${y}px)`;
    img.classList.add('pronta');

    alturas[colunaMenor] += alturaFoto + gap;

    const maiorAltura = Math.max(...alturas) - gap;
    galeriaContainer.style.height = Math.max(0, maiorAltura) + 'px';
}

// Reorganiza tudo do zero — usado no resize da tela (mudança de
// orientação do celular, redimensionar janela, etc.)
function montarMosaico() {
    const imgs = Array.from(galeriaContainer.querySelectorAll('img'))
        .filter(img => img.naturalWidth);
    if (imgs.length === 0) return;

    iniciarEstadoMosaico();
    imgs.forEach(posicionarFoto);
}

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}


/* ======================================
   LIGHTBOX
====================================== */

function ativarLightbox() {

    imagens = Array.from(galeriaContainer.querySelectorAll('img'));

    imagens.forEach((img, index) => {
        img.addEventListener('click', () => {
            lightbox.classList.add('active');
            lightboxImg.src = img.src;
            indexAtual = index;
        });
    });
}

fechar.addEventListener('click', () => {
    lightbox.classList.remove('active');
});

proximo.addEventListener('click', () => {
    if (imagens.length === 0) return;
    indexAtual++;
    if (indexAtual >= imagens.length) {
        indexAtual = 0;
    }
    lightboxImg.src = imagens[indexAtual].src;
});

anterior.addEventListener('click', () => {
    if (imagens.length === 0) return;
    indexAtual--;
    if (indexAtual < 0) {
        indexAtual = imagens.length - 1;
    }
    lightboxImg.src = imagens[indexAtual].src;
});


/* ======================================
   CARREGAR DESTAQUES (MOMENTOS CAPTURADOS)
====================================== */

async function carregarDestaques() {

    if (!destaqueContainer) return;

    try {
        const { data, error } = await client
            .from('destaques')
            .select('*')
            .order('ordem', { ascending: true, nullsFirst: false })
            .order('id', { ascending: false })
            .limit(4);

        if (error) {
            console.error('Erro ao carregar destaques:', error);
            destaqueContainer.innerHTML = '';
            document.querySelector('.destaque-section')?.remove();
            return;
        }

        if (!data || data.length === 0) {
            // Sem destaques definidos pelo admin: oculta a seção inteira
            document.querySelector('.destaque-section')?.remove();
            return;
        }

        destaqueContainer.innerHTML = '';

        data.forEach((item) => {
            const div = document.createElement('div');
            div.className = 'destaque-item';

            const img = document.createElement('img');
            img.src = item.imagem_url;
            img.alt = 'Trabalho em destaque';
            img.loading = 'lazy';
            img.decoding = 'async';

            div.appendChild(img);
            destaqueContainer.appendChild(div);
        });

    } catch (erroFatal) {
        console.error('Erro fatal ao carregar destaques:', erroFatal);
        document.querySelector('.destaque-section')?.remove();
    }
}


/* ======================================
   INICIAR
====================================== */

carregarGaleria();
carregarDestaques();
