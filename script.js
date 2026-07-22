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

        data.forEach((item, index) => {
            const img = document.createElement('img');
            img.src = item.imagem_url;
            img.alt = 'Foto ' + (index + 1);
            // Primeiras fotos carregam na hora, o resto carrega sob demanda
            img.loading = index < 6 ? 'eager' : 'lazy';
            img.decoding = 'async';

            // Formato definido manualmente no admin (auto/paisagem/retrato/quadrado)
            const formato = item.formato || 'auto';
            if (formato !== 'auto') {
                img.classList.add('formato-' + formato);
            }

            galeriaContainer.appendChild(img);
        });

        ativarLightbox();

    } catch (erroFatal) {
        console.error('Erro fatal ao carregar galeria:', erroFatal);
        galeriaContainer.innerHTML = '<p class="galeria-erro">Erro ao carregar as fotos.</p>';
    }
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
