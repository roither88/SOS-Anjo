/* =============================
   Configuracao da aplicacao
   ============================= */

// Se o frontend estiver fora da porta 3000 (ex.: Live Server 5500), usa a API em localhost:3000.
const API_BASE = window.location.port === "3000" ? "" : "http://localhost:3000";

// Chave usada para manter o usuario logado no navegador.
const STORAGE_USUARIO = "sos_anjo_usuario_logado";

// Chaves para configuracao do CallMeBot no navegador.
const STORAGE_CMB_TELEFONE = "sos_anjo_cmb_telefone";
const STORAGE_CMB_APIKEY   = "sos_anjo_cmb_apikey";

// Valores padrao do CallMeBot (usados se nada estiver salvo no navegador).
const CMB_TELEFONE_PADRAO = "554799107264";
const CMB_APIKEY_PADRAO   = "3518933";

/* =============================
   Referencias de elementos DOM
   ============================= */

// Campos de cadastro (presentes apenas na tela de cadastro).
const nome = document.getElementById("nome");
const localizacao = document.getElementById("local");
const senhaCadastro = document.getElementById("senha");

// Campos de configuracao do CallMeBot (presentes apenas na tela de cadastro).
const cmbTelefone = document.getElementById("cmbTelefone");
const cmbApiKey   = document.getElementById("cmbApiKey");

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
   Configuracao CallMeBot
   ============================= */

// Carrega as configuracoes do CallMeBot salvas no navegador.
function carregarConfigCallMeBot() {
  return {
    telefone: localStorage.getItem(STORAGE_CMB_TELEFONE) || CMB_TELEFONE_PADRAO,
    apikey:   localStorage.getItem(STORAGE_CMB_APIKEY)   || CMB_APIKEY_PADRAO,
  };
}

// Persiste as configuracoes do CallMeBot no navegador.
function salvarConfigCallMeBot(telefone, apikey) {
  localStorage.setItem(STORAGE_CMB_TELEFONE, telefone);
  localStorage.setItem(STORAGE_CMB_APIKEY,   apikey);
}

// Preenche os campos do formulario com os valores salvos (se existirem).
function preencherCamposCallMeBot() {
  const cfg = carregarConfigCallMeBot();
  if (cmbTelefone) cmbTelefone.value = cfg.telefone;
  if (cmbApiKey)   cmbApiKey.value   = cfg.apikey;
}

/* =============================
   Requisicoes HTTP (backend)
   ============================= */

// Envia alerta de panico via CallMeBot WhatsApp API.
async function dispararPanico(usuario, localUsuario) {
  const { telefone, apikey } = carregarConfigCallMeBot();

  if (!telefone || !apikey) {
    throw new Error("Configure o telefone e a API Key do CallMeBot na tela de Cadastro antes de usar o alerta.");
  }

  const dataHora = new Date().toLocaleString("pt-BR");
  // Usando \n real (nao \\n) para quebrar linhas corretamente no WhatsApp
  const texto = "ALERTA SOS-ANJO" + "\n" +
    "Usuario: " + usuario + "\n" +
    "Local: " + localUsuario + "\n" +
    "Data/Hora: " + dataHora;

  // Chama o backend local, que repassa ao CallMeBot sem bloqueio de CORS.
  const response = await fetch(`${API_BASE}/api/alerta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telefone, apikey, texto }),
  });

  const resultado = await response.json().catch(() => ({}));
  const respostaTexto = String(resultado.resposta || "");
  console.log("Resposta CallMeBot:", respostaTexto);

  if (!response.ok) {
    throw new Error(resultado.erro || "Erro no servidor ao enviar alerta.");
  }

  // Verifica se o CallMeBot indicou erro na resposta HTML
  if (respostaTexto.toLowerCase().includes("invalid") || respostaTexto.toLowerCase().includes("error")) {
    throw new Error("CallMeBot rejeitou: " + respostaTexto.replace(/<[^>]+>/g, " ").trim());
  }
}

// Busca no banco os dados do usuario logado para garantir nome e local atualizados.
// Retorna null se o servidor nao estiver disponivel ou o usuario nao for encontrado.
async function buscarUsuarioNoBanco(nomeUsuario) {
  try {
    const response = await fetch(`${API_BASE}/api/usuario?nome=${encodeURIComponent(nomeUsuario)}`);
    const resultado = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn("API retornou erro:", resultado.erro);
      return null;
    }

    return resultado;
  } catch (err) {
    console.warn("Servidor nao disponivel, usando dados da sessao:", err.message);
    return null;
  }
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
  console.log("Botao de emergencia clicado.");

  if (!exigirLogin()) {
    return;
  }

  try {
    // Tenta buscar dados atualizados do banco; se falhar, usa os dados da sessao.
    const usuarioBanco = await buscarUsuarioNoBanco(usuarioLogado.nome);
    const nomeFinal  = (usuarioBanco && usuarioBanco.nome)  || usuarioLogado.nome  || "Usuario";
    const localFinal = (usuarioBanco && usuarioBanco.local) || usuarioLogado.local || "Local nao informado";

    console.log("Disparando panico para:", nomeFinal, localFinal);
    await dispararPanico(nomeFinal, localFinal);
    alert("✅ Alerta enviado com sucesso para o WhatsApp!");
  } catch (erro) {
    console.error("Erro ao disparar emergencia:", erro);
    alert("❌ Erro ao enviar alerta: " + erro.message);
  }
}

// Handler do botao de salvar usuario na tela de cadastro.
async function aoClicarSalvarUsuario() {
  if (!exigirLogin()) {
    return;
  }

  // Salva configuracoes do CallMeBot se os campos estiverem presentes.
  const telefone = valorInput(cmbTelefone);
  const apikey   = valorInput(cmbApiKey);
  if (telefone && apikey) {
    salvarConfigCallMeBot(telefone, apikey);
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
preencherCamposCallMeBot();
registrarEventos();
