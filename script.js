/* ======================================
   SUPABASE
====================================== */

const supabaseUrl = "https://tbwmsgztpyyratambgqs.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid21zZ3p0cHl5cmF0YW1iZ3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTU3OTIsImV4cCI6MjA5Mzk3MTc5Mn0.Rnq4IxsvidlkyKM23CzVGcdTPo1xarEmkIbEVdrhFUQ";

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
   HELPERS DE IMAGEM (thumbnail via Supabase)
====================================== */

// Pede ao Supabase uma versão redimensionada/comprimida da imagem
// em vez da foto original (que pode ter vários MB). Se a URL não for
// do Storage do Supabase, devolve a URL original sem alterações.
function urlThumbnail(url, largura) {
    return window.MotaztSecurity?.thumbnailUrl(url, largura, 70) || '';
}

/* ======================================
   LAZY LOADING (funciona com position:absolute
   do mosaico, diferente do atributo loading="lazy")
====================================== */

const lazyObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const img = entry.target;
            const src = img.dataset.src;
            if (src) {
                img.src = src;
                img.removeAttribute('data-src');
            }
            lazyObserver.unobserve(img);
        });
    }, { rootMargin: '600px 0px' })
    : null;


/* ======================================
   CARREGAR GALERIA DO SUPABASE
====================================== */

async function carregarGaleria() {

    try {
        const response = await fetch('/api/public-gallery', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !Array.isArray(data)) {
            console.error('Erro ao carregar galeria:', data?.error || response.status);
            galeriaContainer.innerHTML = '<p class="galeria-erro">Não foi possível carregar as fotos.</p>';
            return;
        }

        if (!data || data.length === 0) {
            galeriaContainer.innerHTML = '<p class="galeria-vazia">Nenhuma foto disponível ainda.</p>';
            return;
        }

        galeriaContainer.innerHTML = '';
        estadoMosaico = null; // reseta o estado a cada carregamento da galeria

        const urlsImagem = data.flatMap(item => [item.imagem_url, item.imagem_preview]).filter(Boolean);
        let signedUrls = new Map();
        let signedThumbnailUrls = new Map();
        try {
            [signedUrls, signedThumbnailUrls] = await Promise.all([
                window.MotaztSecurity.getSignedStorageUrls(urlsImagem, { portfolio: true }),
                window.MotaztSecurity.getSignedStorageUrls(urlsImagem, { portfolio: true, thumbnail: true })
            ]);
        } catch (signError) {
            console.warn('URLs assinadas indisponíveis; usando fallback seguro:', signError);
        }

        data.forEach((item, index) => {
            const img = document.createElement('img');
            img.alt = 'Foto ' + (index + 1);
            img.decoding = 'async';
            img.loading = index < 4 ? 'eager' : 'lazy';
            img.fetchPriority = index < 4 ? 'high' : 'low';
            const originalRaw = item.imagem_url || '';
            const previewRaw = item.imagem_preview || originalRaw;
            const imagemOriginal = signedUrls.get(originalRaw) || window.MotaztSecurity?.safeStorageUrl(originalRaw) || '';
            const imagemPreviewRaw = signedThumbnailUrls.get(previewRaw) || signedUrls.get(previewRaw) || window.MotaztSecurity?.safeStorageUrl(previewRaw) || '';
            const imagemPreview = imagemPreviewRaw;
            if (!imagemOriginal && !imagemPreview) return;
            img.dataset.full = imagemOriginal;
            img.dataset.src = imagemPreview || imagemOriginal;
            // Nota: não usamos o atributo loading="lazy" aqui porque o mosaico
            // usa position:absolute — o navegador não calcula corretamente
            // quais fotos estão fora da tela nesse caso. Em vez disso, usamos
            // o IntersectionObserver (lazyObserver) para o lazy loading.

            galeriaContainer.appendChild(img);

            // Assim que ESTA foto carregar, ela já entra no mosaico —
            // não espera as outras, então a galeria não trava/congela
            img.addEventListener('load', () => posicionarFoto(img));
            img.addEventListener('error', () => {
                // Se o thumbnail falhar (ex: transformação de imagem não
                // habilitada no projeto Supabase), cai para a foto original
                if (img.src !== img.dataset.full && img.dataset.full) {
                    img.src = img.dataset.full;
                } else {
                    posicionarFoto(img);
                }
            });

            if (index < 4) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            } else if (lazyObserver) {
                lazyObserver.observe(img);
            } else {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            }
        });

        ativarLightbox();
        window.addEventListener('resize', debounce(aoRedimensionar, 200));

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

// Detecta celular pelo tipo de dispositivo (ponteiro grosso = toque),
// não pela largura da janela. A largura da janela no mobile "treme"
// nos primeiros instantes (barra de endereço recolhendo/expandindo),
// e isso fazia o mosaico ser montado errado e depois se corrigir
// sozinho — dando a impressão de que o site "recarregava" o layout.
function isCelular() {
    return window.matchMedia('(pointer: coarse)').matches
        || window.matchMedia('(max-width: 600px)').matches;
}

// Guarda a orientação atual (retrato/paisagem) para só remontar o
// mosaico no celular quando ela realmente mudar — ignora os "tremores"
// de resize que não mudam a orientação (ex: barra de endereço do navegador).
let orientacaoAtual = window.innerWidth > window.innerHeight ? 'paisagem' : 'retrato';

function getConfigMosaico() {
    if (isCelular()) return { colunas: 2, gap: 6 };

    const largura = window.innerWidth;
    if (largura <= 1024) return { colunas: 3, gap: 8 };
    if (largura <= 1300) return { colunas: 3, gap: 12 };
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

// No celular, só remonta se a orientação da tela mudou de verdade
// (retrato -> paisagem ou vice-versa). Em telas maiores (desktop/tablet
// sem toque), continua recalculando normalmente a cada resize.
function aoRedimensionar() {
    if (isCelular()) {
        const novaOrientacao = window.innerWidth > window.innerHeight ? 'paisagem' : 'retrato';
        if (novaOrientacao === orientacaoAtual) return;
        orientacaoAtual = novaOrientacao;
    }
    montarMosaico();
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
            lightboxImg.src = img.dataset.full || img.src;
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
    lightboxImg.src = imagens[indexAtual].dataset.full || imagens[indexAtual].src;
});

anterior.addEventListener('click', () => {
    if (imagens.length === 0) return;
    indexAtual--;
    if (indexAtual < 0) {
        indexAtual = imagens.length - 1;
    }
    lightboxImg.src = imagens[indexAtual].dataset.full || imagens[indexAtual].src;
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
            img.src = urlThumbnail(item.imagem_url, 900);
            img.alt = 'Trabalho em destaque';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.addEventListener('error', () => {
                if (img.src !== item.imagem_url) img.src = item.imagem_url;
            }, { once: true });

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
