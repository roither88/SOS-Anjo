/* =============================
   Configuracao da aplicacao
   ============================= */

// Token e nome do evento usados para acionar o webhook do IFTTT.
const TOKEN = "pFjgvmZFPgApgUO9ICO8NPvQpi0GnSNOLpTxJu-_Xek";
const EVENTO = "panico_acionado";

// Se o frontend estiver fora da porta 3000 (ex.: Live Server 5500), usa a API em localhost:3000.
const API_BASE = window.location.port === "3000" ? "" : "http://localhost:3000";

// Chave usada para manter o usuario logado no navegador.
const STORAGE_USUARIO = "sos_anjo_usuario_logado";

/* =============================
   Referencias de elementos DOM
   ============================= */

// Campos de cadastro (presentes apenas na tela de cadastro).
const nome = document.getElementById("nome");
const localizacao = document.getElementById("local");
const senhaCadastro = document.getElementById("senha");

// Botoes principais da tela inicial.
const botao = document.getElementById("btnEmergencia");
const desativarBotao = document.getElementById("btnDesativar");

// Botao para salvar cadastro de usuario.
const salvarBotao = document.getElementById("btnEntrar");

// Campos e botoes da navbar de autenticacao.
const loginNome = document.getElementById("loginNome");
const loginSenha = document.getElementById("loginSenha");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const btnIrCadastro = document.getElementById("btnIrCadastro");
const btnIrInicio = document.getElementById("btnIrInicio");
const statusLogin = document.getElementById("statusLogin");

/* =============================
   Estado da sessao
   ============================= */

// Estado em memoria do usuario atual; inicia tentando restaurar do localStorage.
let usuarioLogado = carregarSessaoUsuario();

// Retorna o valor de um input de forma segura (quando o elemento existe).
function valorInput(elemento) {
  return elemento ? elemento.value.trim() : "";
}

// Carrega sessao salva no navegador para manter login entre paginas.
function carregarSessaoUsuario() {
  try {
    const valor = localStorage.getItem(STORAGE_USUARIO);
    return valor ? JSON.parse(valor) : null;
  } catch {
    return null;
  }
}

// Persiste (ou limpa) a sessao e atualiza o texto visual da navbar.
function salvarSessaoUsuario(usuario) {
  usuarioLogado = usuario;

  if (usuario) {
    localStorage.setItem(STORAGE_USUARIO, JSON.stringify(usuario));
  } else {
    localStorage.removeItem(STORAGE_USUARIO);
  }

  atualizarStatusLogin();
}

// Atualiza o chip visual de status: "Nao logado" ou "Logado: Nome".
function atualizarStatusLogin() {
  if (!statusLogin) {
    return;
  }

  if (usuarioLogado) {
    statusLogin.textContent = `Logado: ${usuarioLogado.nome}`;
    statusLogin.classList.add("ativo");
    return;
  }

  statusLogin.textContent = "Não logado";
  statusLogin.classList.remove("ativo");
}

// Garante que a acao so continue se houver usuario autenticado.
function exigirLogin() {
  if (!usuarioLogado) {
    alert("Faça login primeiro.");
    return false;
  }

  return true;
}

/* =============================
   Requisicoes HTTP (backend)
   ============================= */

// Faz POST para o IFTTT e dispara o alerta de panico.
async function dispararPanico(usuario, localUsuario) {
  const url = `https://maker.ifttt.com/trigger/${EVENTO}/with/key/${TOKEN}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value1: usuario,
        value2: localUsuario,
        value3: new Date().toLocaleString("pt-BR"),
      }),
    });

    const texto = await response.text();
    console.log("Pânico disparado:", texto);
  } catch (err) {
    console.error("Erro ao disparar:", err.message);
  }
}

// Busca no banco os dados do usuario logado para garantir nome e local atualizados.
async function buscarUsuarioNoBanco(nomeUsuario) {
  const response = await fetch(`${API_BASE}/api/usuario?nome=${encodeURIComponent(nomeUsuario)}`);
  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Nao foi possivel consultar o usuario.");
  }

  return resultado;
}

// Cadastra um novo usuario no banco SQLite via API.
async function salvarUsuario() {
  const nomeUsuario = valorInput(nome);
  const localUsuario = valorInput(localizacao);
  const senhaUsuario = valorInput(senhaCadastro);

  if (!nomeUsuario) {
    alert("Informe o nome do usuario.");
    return;
  }

  const response = await fetch(`${API_BASE}/api/usuario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: nomeUsuario,
      local: localUsuario,
      senha: senhaUsuario,
    }),
  });

  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Nao foi possivel salvar o usuario.");
  }

  alert(`Usuario salvo: ${resultado.nome}`);
}

// Faz login consultando backend por nome e senha e salva sessao local.
async function fazerLogin() {
  const nomeUsuario = valorInput(loginNome);
  const senhaUsuario = valorInput(loginSenha);

  if (!nomeUsuario || !senhaUsuario) {
    alert("Informe nome e senha para login.");
    return;
  }

  const response = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: nomeUsuario, senha: senhaUsuario }),
  });

  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Nao foi possivel fazer login.");
  }

  salvarSessaoUsuario(resultado);
  alert(`Login realizado: ${resultado.nome}`);
}

/* =============================
   Handlers de eventos
   ============================= */

// Handler do botao de emergencia na tela principal.
async function aoClicarEmergencia() {
  if (!exigirLogin()) {
    return;
  }

  const usuarioBanco = await buscarUsuarioNoBanco(usuarioLogado.nome);
  const localFinal = usuarioBanco.local || usuarioLogado.local || "Local nao informado";

  await dispararPanico(usuarioBanco.nome, localFinal);
}

// Handler do botao de salvar usuario na tela de cadastro.
async function aoClicarSalvarUsuario() {
  if (!exigirLogin()) {
    return;
  }

  try {
    await salvarUsuario();
  } catch (erro) {
    console.error(erro);
    alert(erro.message);
  }
}

// Handler do botao de desativar alerta.
function aoClicarDesativar() {
  if (!exigirLogin()) {
    return;
  }

  alert("Alerta desativado.");
}

// Handler do botao de login da navbar.
async function aoClicarLogin() {
  try {
    await fazerLogin();
  } catch (erro) {
    console.error(erro);
    alert(erro.message);
  }
}

// Handler do botao de logout da navbar.
function aoClicarLogout() {
  salvarSessaoUsuario(null);
  alert("Sessão encerrada.");
}

// Navega para tela de cadastro.
function aoClicarIrCadastro() {
  window.location.href = "cadastro.html";
}

// Navega para tela inicial.
function aoClicarIrInicio() {
  window.location.href = "index.html";
}

/* =============================
   Inicializacao
   ============================= */

// Conecta eventos somente para os elementos que existem na pagina atual.
function registrarEventos() {
  if (botao) {
    botao.addEventListener("click", aoClicarEmergencia);
  }

  if (salvarBotao) {
    salvarBotao.addEventListener("click", aoClicarSalvarUsuario);
  }

  if (desativarBotao) {
    desativarBotao.addEventListener("click", aoClicarDesativar);
  }

  if (btnLogin) {
    btnLogin.addEventListener("click", aoClicarLogin);
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", aoClicarLogout);
  }

  if (btnIrCadastro) {
    btnIrCadastro.addEventListener("click", aoClicarIrCadastro);
  }

  if (btnIrInicio) {
    btnIrInicio.addEventListener("click", aoClicarIrInicio);
  }
}

// Atualiza a interface com o estado atual e ativa os listeners.
atualizarStatusLogin();
registrarEventos();
