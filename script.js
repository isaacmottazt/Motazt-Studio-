const supabaseUrl =
"https://tbwmsgztpyyratambgqs.supabase.co";

const supabaseKey =
"sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";

const client =
supabase.createClient(
    supabaseUrl,
    supabaseKey
);

/* ======================================
   LOGIN
====================================== */

async function login(){

    const email =
    document.getElementById("email").value;

    const senha =
    document.getElementById("senha").value;

    const status =
    document.getElementById("status");

    if(!email || !senha){

        status.innerHTML =
        "Preencha email e senha.";

        return;
    }

    status.innerHTML =
    "Entrando...";

    const {
        error
    } = await client.auth
    .signInWithPassword({

        email: email,
        password: senha

    });

    if(error){

        console.log(error);

        status.innerHTML =
        "Email ou senha inválidos.";

        return;
    }

    status.innerHTML =
    "Login realizado!";

    setTimeout(() => {

        window.location.href =
        "index.html";

    }, 1000);

}

/* ======================================
   REDEFINIR SENHA
====================================== */

async function redefinirSenha(){

    const email =
    document.getElementById("email").value;

    const status =
    document.getElementById("status");

    if(!email){

        status.innerHTML =
        "Digite seu email.";

        return;
    }

    status.innerHTML =
    "Enviando email...";

    const {
        error
    } = await client.auth
    .resetPasswordForEmail(
        email
    );

    if(error){

        console.log(error);

        status.innerHTML =
        "Erro ao enviar email.";

        return;
    }

    status.innerHTML =
    "Email enviado!";
}

/* =========================
VOLTAR HOME
========================= */

function voltarHome(){

    window.location.href =
    'login.html';

}