const SUPABASE_URL = 'https://tbwmsgztpyyratambgqs.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid21zZ3p0cHl5cmF0YW1iZ3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTU3OTIsImV4cCI6MjA5Mzk3MTc5Mn0.Rnq4IxsvidlkyKM23CzVGcdTPo1xarEmkIbEVdrhFUQ';
const loginClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function mostrarStatusLogin(mensagem, tipo = 'erro') {
    const status = document.getElementById('status');
    if (!status) return;
    status.textContent = mensagem;
    status.style.color = tipo === 'sucesso' ? '#7ee787' : '#ff8b8b';
}

async function login() {
    const email = document.getElementById('email')?.value.trim();
    const senha = document.getElementById('senha')?.value;
    if (!email || !senha) {
        mostrarStatusLogin('Informe e-mail e senha.');
        return;
    }

    const botao = document.querySelector('.login-box button:not(.btn-reset)');
    if (botao) {
        botao.disabled = true;
        botao.textContent = 'Entrando...';
    }

    const { error } = await loginClient.auth.signInWithPassword({ email, password: senha });
    if (error) {
        mostrarStatusLogin('Não foi possível entrar. Verifique seus dados.');
        if (botao) {
            botao.disabled = false;
            botao.textContent = 'Entrar';
        }
        return;
    }

    window.location.replace('admin-galerias.html');
}

async function redefinirSenha() {
    const email = document.getElementById('email')?.value.trim();
    if (!email) {
        mostrarStatusLogin('Informe seu e-mail para redefinir a senha.');
        return;
    }

    const { error } = await loginClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login.html`
    });
    mostrarStatusLogin(error ? 'Não foi possível enviar o e-mail de redefinição.' : 'E-mail de redefinição enviado.', error ? 'erro' : 'sucesso');
}

window.login = login;
window.redefinirSenha = redefinirSenha;
