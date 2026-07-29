/* ================================================
   GALERIA OTIMIZADA COM LAZY LOADING
   Carregamento Suave + Performance
================================================ */

(function() {
    const SUPABASE_URL = "https://tbwmsgztpyyratambgqs.supabase.co";
    const SUPABASE_KEY = "sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";
    
    let imagensCarregadas = [];
    let imagemAtualLightbox = 0;

    // Lazy Loading Observer
    const observerOpcoes = {
        root: null,
        rootMargin: '50px',
        threshold: 0.01
    };

    const lazyLoadObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.dataset.src;
                
                if (src) {
                    const novaImg = new Image();
                    novaImg.onload = () => {
                        img.src = src;
                        img.classList.remove('loading');
                        img.classList.add('carregada');
                        lazyLoadObserver.unobserve(img);
                    };
                    novaImg.onerror = () => {
                        img.classList.remove('loading');
                        img.classList.add('erro');
                    };
                    novaImg.src = src;
                }
            }
        });
    }, observerOpcoes);

    // Carregar galeria do Supabase
    async function carregarGaleria() {
        const container = document.getElementById('galeria-container');
        if (!container) return;

        container.innerHTML = '<p class="galeria-carregando">Carregando portfólio...</p>';

        try {
            const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            
            const { data: galerias, error } = await supabase
                .from('galerias')
                .select('*')
                .order('data_criacao', { ascending: false });

            if (error) throw error;

            if (!galerias || galerias.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                        <p style="color: #999; font-size: 16px;">Galeria em breve! 📸</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = '';
            imagensCarregadas = galerias;

            galerias.forEach((foto, index) => {
                const item = document.createElement('div');
                item.className = 'galeria-item loading';
                item.style.cursor = 'pointer';
                
                const img = document.createElement('img');
                img.dataset.src = foto.url_foto;
                img.alt = foto.titulo || 'Foto do Motazt Studio';
                img.loading = 'lazy';
                
                img.addEventListener('click', () => abrirLightbox(index));
                
                item.appendChild(img);
                container.appendChild(item);
                
                // Iniciar lazy loading
                lazyLoadObserver.observe(img);
            });

            // Efeito fade-in nas imagens
            setTimeout(() => {
                document.querySelectorAll('.galeria-item').forEach(item => {
                    item.style.animation = 'fadeInUp 0.5s ease';
                });
            }, 100);

        } catch (erro) {
            console.error('Erro ao carregar galeria:', erro);
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                    <p style="color: #999;">Erro ao carregar galeria 😔</p>
                </div>
            `;
        }
    }

    // Lightbox
    function abrirLightbox(index) {
        const lightbox = document.querySelector('.lightbox');
        const img = lightbox.querySelector('.lightbox-img');
        
        imagemAtualLightbox = index;
        img.src = imagensCarregadas[index].url_foto;
        img.alt = imagensCarregadas[index].titulo || 'Foto';
        
        lightbox.classList.add('ativo');
        document.body.style.overflow = 'hidden';
    }

    function fecharLightbox() {
        const lightbox = document.querySelector('.lightbox');
        lightbox.classList.remove('ativo');
        document.body.style.overflow = 'auto';
    }

    function proximaFoto() {
        imagemAtualLightbox = (imagemAtualLightbox + 1) % imagensCarregadas.length;
        const img = document.querySelector('.lightbox-img');
        img.style.animation = 'none';
        setTimeout(() => {
            img.style.animation = 'zoomIn 0.3s ease';
            img.src = imagensCarregadas[imagemAtualLightbox].url_foto;
        }, 10);
    }

    function fotoAnterior() {
        imagemAtualLightbox = (imagemAtualLightbox - 1 + imagensCarregadas.length) % imagensCarregadas.length;
        const img = document.querySelector('.lightbox-img');
        img.style.animation = 'none';
        setTimeout(() => {
            img.style.animation = 'zoomIn 0.3s ease';
            img.src = imagensCarregadas[imagemAtualLightbox].url_foto;
        }, 10);
    }

    // Event listeners da Lightbox
    function inicializarLightbox() {
        const lightbox = document.querySelector('.lightbox');
        if (!lightbox) return;

        const btnFechar = lightbox.querySelector('.fechar');
        const btnProximo = lightbox.querySelector('.proximo');
        const btnAnterior = lightbox.querySelector('.anterior');

        if (btnFechar) btnFechar.addEventListener('click', fecharLightbox);
        if (btnProximo) btnProximo.addEventListener('click', proximaFoto);
        if (btnAnterior) btnAnterior.addEventListener('click', fotoAnterior);

        // Teclas de teclado
        document.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('ativo')) return;
            
            if (e.key === 'Escape') fecharLightbox();
            if (e.key === 'ArrowRight') proximaFoto();
            if (e.key === 'ArrowLeft') fotoAnterior();
        });

        // Click fora da imagem
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) fecharLightbox();
        });
    }

    // Carregamento do Destaque
    async function carregarDestaque() {
        const container = document.getElementById('destaque-container');
        if (!container) return;

        try {
            const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            
            const { data: galerias, error } = await supabase
                .from('galerias')
                .select('*')
                .order('data_criacao', { ascending: false })
                .limit(6);

            if (error) throw error;

            if (!galerias || galerias.length === 0) {
                container.innerHTML = '<p>Carregando destaques...</p>';
                return;
            }

            container.innerHTML = '';

            galerias.forEach((foto, index) => {
                const item = document.createElement('div');
                item.className = 'galeria-item loading';
                item.style.cursor = 'pointer';
                
                const img = document.createElement('img');
                img.dataset.src = foto.url_foto;
                img.alt = foto.titulo || 'Destaque';
                img.loading = 'lazy';
                
                img.addEventListener('click', () => {
                    document.getElementById('galeria').scrollIntoView({ behavior: 'smooth' });
                    abrirLightbox(imagensCarregadas.indexOf(foto));
                });
                
                item.appendChild(img);
                container.appendChild(item);
                
                lazyLoadObserver.observe(img);
            });

        } catch (erro) {
            console.error('Erro ao carregar destaque:', erro);
        }
    }

    // Inicializar tudo quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            carregarGaleria();
            carregarDestaque();
            inicializarLightbox();
        });
    } else {
        carregarGaleria();
        carregarDestaque();
        inicializarLightbox();
    }

})();
