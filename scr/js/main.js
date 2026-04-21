/* =============================
   Configuracao da aplicacao
   ============================= */

// Em producao (Render), usa mesma origem. Em dev fora da porta 3000, usa localhost:3000.
const estaEmAmbienteLocal = globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1";
const API_BASE = estaEmAmbienteLocal && globalThis.location.port !== "3000"
  ? "http://localhost:3000"
  : "";

// Chave usada para manter o usuario logado no navegador.
const STORAGE_USUARIO = "sos_anjo_usuario_logado";
const STORAGE_ADMIN = "sos_anjo_admin_logado";

// Chaves para configuracao do CallMeBot no navegador.
const STORAGE_CMB_TELEFONE = "sos_anjo_cmb_telefone";
const STORAGE_CMB_APIKEY   = "sos_anjo_cmb_apikey";
const STORAGE_EDICAO_USUARIO = "sos_anjo_edicao_usuario";
const STORAGE_ALERTAS_SYNC = "sos_anjo_alertas_sync";

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
// Botao de emergencia na tela inicial.
const botao = document.getElementById("btnEmergencia");
const botaoDesativarAlerta = document.getElementById("btnDesativarAlerta");
const audioAlerta = document.getElementById("audioAlerta");
// Botao para salvar cadastro de usuario.
const salvarBotao = document.getElementById("btnEntrar");
const idUsuarioEditar = document.getElementById("idUsuarioEditar");

// Campos e botoes da navbar de autenticacao.
const loginNome = document.getElementById("loginNome");
const loginSenha = document.getElementById("loginSenha");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const btnIrCadastro = document.getElementById("btnIrCadastro");
const btnIrCadastroPainel = document.getElementById("btnIrCadastroPainel");
const btnIrInicio = document.getElementById("btnIrInicio");
const btnIrAdmin = document.getElementById("btnIrAdmin");
const btnIrAlertas = document.getElementById("btnIrAlertas");
const statusLogin = document.getElementById("statusLogin");

// Elementos da tela admin (presentes apenas em admin.html).
const adminAviso = document.getElementById("adminAviso");
const adminBlocoCriacao = document.getElementById("adminBlocoCriacao");
const adminBlocoLogin = document.getElementById("adminBlocoLogin");
const adminPainel = document.getElementById("adminPainel");
const adminCriarNome = document.getElementById("adminCriarNome");
const adminCriarLocal = document.getElementById("adminCriarLocal");
const adminCriarSenha = document.getElementById("adminCriarSenha");
const btnCriarAdmin = document.getElementById("btnCriarAdmin");
const adminLoginNome = document.getElementById("adminLoginNome");
const adminLoginSenha = document.getElementById("adminLoginSenha");
const btnAdminLogin = document.getElementById("btnAdminLogin");
const btnAdminAtualizar = document.getElementById("btnAdminAtualizar");
const btnAdminLogout = document.getElementById("btnAdminLogout");
const adminUsuarioLogado = document.getElementById("adminUsuarioLogado");
const adminTabelaCorpo = document.getElementById("adminTabelaCorpo");
const adminLogsCorpo = document.getElementById("adminLogsCorpo");

/* =============================
   Estado da sessao
   ============================= */

// Estado em memoria do usuario atual; inicia tentando restaurar do localStorage.
let usuarioLogado = carregarSessaoUsuario();
let adminLogado = carregarSessaoAdmin();
let alertaSonoroAtivo = false;
let alertaAudioContext = null;
let alertaOscilador = null;
let alertaIntervaloTom = null;

function atualizarVisibilidadeBotaoAlerta() {
  if (!botaoDesativarAlerta) {
    return;
  }

  botaoDesativarAlerta.classList.toggle("oculto", !alertaSonoroAtivo);
}

function iniciarTomFallbackAlerta() {
  if (alertaOscilador) {
    return true;
  }

  try {
    const AudioContextClasse = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClasse) {
      return false;
    }

    alertaAudioContext = alertaAudioContext || new AudioContextClasse();
    const ganho = alertaAudioContext.createGain();
    alertaOscilador = alertaAudioContext.createOscillator();

    alertaOscilador.type = "sine";
    alertaOscilador.frequency.setValueAtTime(900, alertaAudioContext.currentTime);
    ganho.gain.setValueAtTime(0.12, alertaAudioContext.currentTime);

    alertaOscilador.connect(ganho);
    ganho.connect(alertaAudioContext.destination);
    alertaOscilador.start();

    alertaIntervaloTom = globalThis.setInterval(() => {
      if (!alertaOscilador || !alertaAudioContext) {
        return;
      }

      const agora = alertaAudioContext.currentTime;
      alertaOscilador.frequency.setValueAtTime(900, agora);
      alertaOscilador.frequency.setValueAtTime(650, agora + 0.2);
      alertaOscilador.frequency.setValueAtTime(900, agora + 0.4);
    }, 1500);

    return true;
  } catch (error_) {
    console.warn("Nao foi possivel iniciar tom de alerta alternativo:", error_);
    return false;
  }
}

function pararTomFallbackAlerta() {
  if (alertaIntervaloTom) {
    globalThis.clearInterval(alertaIntervaloTom);
    alertaIntervaloTom = null;
  }

  if (alertaOscilador) {
    try {
      alertaOscilador.stop();
    } catch (error_) {
      console.debug("Oscilador de alerta ja estava parado:", error_);
    }
    alertaOscilador = null;
  }
}

async function ativarSomAlerta() {
  if (audioAlerta instanceof HTMLAudioElement) {
    audioAlerta.currentTime = 0;

    try {
      await audioAlerta.play();
      alertaSonoroAtivo = true;
      atualizarVisibilidadeBotaoAlerta();
      return;
    } catch (error_) {
      console.warn("Nao foi possivel reproduzir o arquivo de audio do alerta:", error_);
    }
  }

  alertaSonoroAtivo = iniciarTomFallbackAlerta();

  atualizarVisibilidadeBotaoAlerta();
}

function desativarSomAlerta() {
  if (audioAlerta instanceof HTMLAudioElement) {
    audioAlerta.pause();
    audioAlerta.currentTime = 0;
  }

  pararTomFallbackAlerta();
  alertaSonoroAtivo = false;
  atualizarVisibilidadeBotaoAlerta();
}

async function desativarAlertasAtivosDoUsuario() {
  if (!usuarioLogado?.nome) {
    return 0;
  }

  const response = await fetch(`${API_BASE}/api/alertas/ativos`);
  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Não foi possível consultar os alertas ativos.");
  }

  const nomeLogado = String(usuarioLogado.nome || "").trim().toLowerCase();
  const alertas = Array.isArray(resultado.alertas) ? resultado.alertas : [];
  const alertasDoUsuario = alertas.filter((item) => {
    const nomeAlerta = String(item.usuario_nome || "").trim().toLowerCase();
    return nomeAlerta === nomeLogado;
  });

  if (!alertasDoUsuario.length) {
    return 0;
  }

  const respostas = await Promise.all(alertasDoUsuario.map((item) => (
    fetch(`${API_BASE}/api/alertas/desativar/${encodeURIComponent(String(item.id))}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
  )));

  for (const respostaAtual of respostas) {
    if (!respostaAtual.ok) {
      const corpoErro = await respostaAtual.json().catch(() => ({}));
      throw new Error(corpoErro.erro || "Falha ao desativar alerta no painel.");
    }
  }

  return alertasDoUsuario.length;
}

async function aoClicarDesativarAlerta() {
  desativarSomAlerta();

  try {
    const totalDesativado = await desativarAlertasAtivosDoUsuario();
    localStorage.setItem(STORAGE_ALERTAS_SYNC, JSON.stringify({
      origem: "index",
      acao: "desativacao_usuario",
      ts: Date.now(),
      totalDesativado,
    }));

    await registrarEventoAlerta(
      "som_desativado_usuario",
      `Alarme desativado pelo usuário na tela inicial. Alertas desativados no painel: ${totalDesativado}.`
    );
  } catch (error_) {
    console.error("Falha ao sincronizar desativacao do alerta:", error_);
    alert(`O som foi desativado, mas houve falha ao sincronizar no painel: ${error_.message}`);
  }
}

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

// Carrega sessao do admin para manter acesso ao painel nesta maquina.
function carregarSessaoAdmin() {
  try {
    const valor = localStorage.getItem(STORAGE_ADMIN);
    return valor ? JSON.parse(valor) : null;
  } catch {
    return null;
  }
}

// Salva ou limpa sessao do administrador.
function salvarSessaoAdmin(usuarioAdmin) {
  adminLogado = usuarioAdmin;

  if (usuarioAdmin) {
    localStorage.setItem(STORAGE_ADMIN, JSON.stringify(usuarioAdmin));
    return;
  }

  localStorage.removeItem(STORAGE_ADMIN);
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
  atualizarControlesAutenticacao();
}

// Quando houver admin autenticado, espelha esse login na sessao principal do sistema.
function sincronizarSessaoUsuarioComAdmin() {
  if (!adminLogado) {
    return;
  }

  salvarSessaoUsuario({
    id: adminLogado.id,
    nome: adminLogado.nome,
    local: adminLogado.local || "",
    admin: 1,
  });
}

// Retorna true quando o usuario autenticado possui perfil de administrador.
function usuarioLogadoEhAdmin() {
  return Boolean(usuarioLogado && Number(usuarioLogado.admin) === 1);
}

// Quando houver usuario admin logado pela navbar, prepara sessao do painel admin.
function sincronizarSessaoAdminComUsuario() {
  if (adminLogado || !usuarioLogadoEhAdmin()) {
    return;
  }

  salvarSessaoAdmin({
    id: usuarioLogado.id,
    nome: usuarioLogado.nome,
    local: usuarioLogado.local || "",
    admin: 1,
  });
}

// Atualiza o chip visual de status: "Nao logado" ou "Logado: Nome".
function atualizarStatusLogin() {
  if (!statusLogin) {
    return;
  }

  if (usuarioLogado) {
    statusLogin.textContent = `Logado: Anjo ${usuarioLogado.nome}`;
    statusLogin.classList.add("ativo");
    return;
  }

  statusLogin.textContent = "Não logado";
  statusLogin.classList.remove("ativo");
}

// Mostra/esconde os campos de login conforme estado da sessao atual.
function atualizarControlesAutenticacao() {
  const estaLogado = Boolean(usuarioLogado);

  if (loginNome) {
    loginNome.classList.toggle("oculto", estaLogado);
    if (estaLogado) {
      loginNome.value = "";
    }
  }

  if (loginSenha) {
    loginSenha.classList.toggle("oculto", estaLogado);
    if (estaLogado) {
      loginSenha.value = "";
    }
  }

  if (btnLogin) {
    btnLogin.classList.toggle("oculto", estaLogado);
  }
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

// Carrega o usuario que sera editado na pagina dedicada.
function carregarEdicaoUsuario() {
  try {
    const valor = sessionStorage.getItem(STORAGE_EDICAO_USUARIO);
    return valor ? JSON.parse(valor) : null;
  } catch {
    return null;
  }
}

// Salva o usuario selecionado para edicao entre as paginas.
function salvarEstadoEdicaoUsuario(usuario) {
  if (usuario) {
    sessionStorage.setItem(STORAGE_EDICAO_USUARIO, JSON.stringify(usuario));
    return;
  }

  sessionStorage.removeItem(STORAGE_EDICAO_USUARIO);
}

// Preenche a pagina de edicao com os dados do usuario selecionado.
async function preencherPaginaEdicaoUsuario() {
  if (!idUsuarioEditar || !nome || !localizacao || !senhaCadastro) {
    return;
  }

  const usuarioEdicao = carregarEdicaoUsuario();
  if (!usuarioEdicao) {
    alert("Nenhum usuário foi selecionado para edição.");
    globalThis.location.href = "admin.html";
    return;
  }

  idUsuarioEditar.value = String(usuarioEdicao.id || "");
  nome.value = String(usuarioEdicao.nome || "");
  senhaCadastro.value = "";

  if (usuarioEdicao.local_id) {
    localizacao.value = String(usuarioEdicao.local_id);
  }
}

// Preenche os campos do formulario com os valores salvos (se existirem).
function preencherCamposCallMeBot() {
  const cfg = carregarConfigCallMeBot();
  if (cmbTelefone) cmbTelefone.value = cfg.telefone;
  if (cmbApiKey)   cmbApiKey.value   = cfg.apikey;
}

// Carrega a lista de locais cadastrados no backend para preencher um select.
async function carregarLocaisSelect(selectElement) {
  if (selectElement?.tagName !== "SELECT") {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/locais`);
    const resultado = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(resultado.erro || "Não foi possível carregar os locais.");
    }

    const locais = Array.isArray(resultado.locais) ? resultado.locais : [];
    selectElement.innerHTML = '<option value="">Selecione um local</option>';
    const locaisJaInseridos = new Set();

    locais.forEach((local) => {
      const option = document.createElement("option");
      const nomeLocal = String(local.local || local.nome || "").trim();
      const chaveLocal = nomeLocal.toLowerCase();

      if (!nomeLocal || locaisJaInseridos.has(chaveLocal)) {
        return;
      }

      locaisJaInseridos.add(chaveLocal);
      option.value = String(local.id || "").trim();
      option.textContent = nomeLocal;
      selectElement.appendChild(option);
    });
  } catch (error_) {
    console.warn("Falha ao carregar locais:", error_.message);
    selectElement.innerHTML = '<option value="">Selecione um local</option>';
  }
}

// Recarrega os selects de locais das telas de cadastro e admin.
async function carregarLocaisFormularios() {
  await Promise.all([
    carregarLocaisSelect(localizacao),
    carregarLocaisSelect(adminCriarLocal),
  ]);
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
    "Usuário: " + usuario + "\n" +
    "Local: " + localUsuario + "\n" +
    "Data/Hora: " + dataHora;

  // Chama o backend local, que repassa ao CallMeBot sem bloqueio de CORS.
  const response = await fetch(`${API_BASE}/api/alerta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telefone,
      apikey,
      texto,
      usuarioNome: usuario,
      usuarioLocal: localUsuario,
    }),
  });

  const resultado = await response.json().catch(() => ({}));
  const respostaTexto = String(resultado.resposta || "");
  console.log("Resposta CallMeBot:", respostaTexto);

  if (!response.ok) {
    throw new Error(resultado.erro || "Erro no servidor ao enviar alerta.");
  }

  // Verifica se o CallMeBot indicou erro na resposta HTML
  if (respostaTexto.toLowerCase().includes("invalid") || respostaTexto.toLowerCase().includes("error")) {
    throw new Error("CallMeBot rejeitou: " + respostaTexto.replaceAll(/<[^>]+>/g, " ").trim());
  }
}

// Registra no backend eventos de clique relacionados ao alerta.
async function registrarEventoAlerta(status, detalhe) {
  const usuarioNome = usuarioLogado?.nome || "Não autenticado";
  const usuarioLocal = usuarioLogado?.local || "Não informado";

  try {
    await fetch(`${API_BASE}/api/alerta/evento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuarioNome,
        usuarioLocal,
        status,
        detalhe,
      }),
    });
  } catch (error_) {
    console.warn("Falha ao registrar evento de alerta:", error_.message);
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
    console.warn("Servidor não disponível, usando dados da sessão:", err.message);
    return null;
  }
}

// Cadastra um novo usuario no banco SQLite via API.
async function salvarUsuario() {
  const nomeUsuario = valorInput(nome);
  const localIdUsuario = Number(valorInput(localizacao));
  const senhaUsuario = valorInput(senhaCadastro);

  if (!nomeUsuario) {
    alert("Informe o nome do usuário.");
    return;
  }

  if (!Number.isInteger(localIdUsuario) || localIdUsuario <= 0) {
    alert("Selecione um local válido.");
    return;
  }

  const response = await fetch(`${API_BASE}/api/usuario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: nomeUsuario,
      localId: localIdUsuario,
      senha: senhaUsuario,
    }),
  });

  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Não foi possível salvar o usuário.");
  }

  alert(`Usuário salvo: ${resultado.nome}`);
}

// Salva alteracoes de um usuario na pagina de edicao.
async function salvarEdicaoUsuarioFormulario() {
  if (!idUsuarioEditar) {
    return;
  }

  const usuarioId = Number(valorInput(idUsuarioEditar));
  const nomeUsuario = valorInput(nome);
  const localIdUsuario = Number(valorInput(localizacao));
  const senhaUsuario = valorInput(senhaCadastro);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    alert("Usuário de edição inválido.");
    return;
  }

  if (!nomeUsuario) {
    alert("Informe o nome do usuário.");
    return;
  }

  if (!Number.isInteger(localIdUsuario) || localIdUsuario <= 0) {
    alert("Selecione um local válido.");
    return;
  }

  const resultado = await atualizarUsuarioAdmin(usuarioId, nomeUsuario, localIdUsuario, senhaUsuario);
  salvarEstadoEdicaoUsuario(null);
  alert(resultado.mensagem || "Usuário atualizado com sucesso.");
  globalThis.location.href = "admin.html";
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
    throw new Error(resultado.erro || "Não foi possível fazer login.");
  }

  salvarSessaoUsuario(resultado);

  if (Number(resultado.admin) === 1) {
    salvarSessaoAdmin({
      id: resultado.id,
      nome: resultado.nome,
      local: resultado.local || "",
      admin: 1,
    });
  } else {
    salvarSessaoAdmin(null);
  }

  alert(`Login realizado: ${resultado.nome}`);
}

// Consulta se existe administrador cadastrado no banco.
async function buscarStatusAdmin() {
  const response = await fetch(`${API_BASE}/api/admin/status`);
  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Não foi possível consultar o status de administrador.");
  }

  return resultado;
}

// Cria o primeiro administrador do sistema quando ainda nao existe nenhum.
async function criarAdminInicial() {
  const nomeUsuario = valorInput(adminCriarNome);
  const localUsuario = valorInput(adminCriarLocal);
  const senhaUsuario = valorInput(adminCriarSenha);

  if (!nomeUsuario || !senhaUsuario) {
    alert("Informe nome e senha para criar o administrador.");
    return null;
  }

  const response = await fetch(`${API_BASE}/api/admin/criar-inicial`, {
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
    throw new Error(resultado.erro || "Não foi possível criar o administrador inicial.");
  }

  return resultado;
}

// Faz login exclusivo de administrador para liberar a tela de painel.
async function fazerLoginAdmin() {
  const nomeUsuario = valorInput(adminLoginNome);
  const senhaUsuario = valorInput(adminLoginSenha);

  if (!nomeUsuario || !senhaUsuario) {
    alert("Informe nome e senha do administrador.");
    return null;
  }

  const response = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: nomeUsuario, senha: senhaUsuario }),
  });

  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Não foi possível autenticar administrador.");
  }

  return resultado;
}

// Carrega a lista de usuarios para o painel administrativo.
async function listarUsuariosAdmin() {
  const response = await fetch(`${API_BASE}/api/admin/usuarios`);
  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Não foi possível carregar os usuários.");
  }

  return Array.isArray(resultado.usuarios) ? resultado.usuarios : [];
}

// Busca os ultimos logs de acionamento do botao de emergencia.
async function listarLogsAlertaAdmin(limite = 20) {
  const response = await fetch(`${API_BASE}/api/admin/logs-alerta?limit=${encodeURIComponent(limite)}`);
  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Não foi possível carregar os logs de alerta.");
  }

  return Array.isArray(resultado.logs) ? resultado.logs : [];
}

// Atualiza perfil administrativo de um usuario no backend.
async function atualizarPerfilAdmin(idUsuario, admin) {
  const response = await fetch(`${API_BASE}/api/admin/usuario/perfil`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: idUsuario, admin }),
  });

  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Não foi possível atualizar o perfil do usuário.");
  }

  return resultado;
}

// Atualiza os dados de um usuario (nome, local e opcionalmente senha).
async function atualizarUsuarioAdmin(idUsuario, nomeUsuario, localUsuario, novaSenha) {
  const body = {
    id: idUsuario,
    nome: nomeUsuario,
    localId: localUsuario,
  };

  if (novaSenha) {
    body.senha = novaSenha;
  }

  const response = await fetch(`${API_BASE}/api/admin/usuario/atualizar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Não foi possível atualizar os dados do usuário.");
  }

  return resultado;
}

// Remove um usuario por id.
async function removerUsuarioAdmin(idUsuario) {
  const response = await fetch(`${API_BASE}/api/admin/usuario/remover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: idUsuario }),
  });

  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Não foi possível remover o usuário.");
  }

  return resultado;
}

/* =============================
   Handlers de eventos
   ============================= */

// Handler do botao de emergencia na tela principal.
async function aoClicarEmergencia() {
  console.log("Botão de emergência clicado.");

  await registrarEventoAlerta(
    "botao_emergencia_clicado",
    usuarioLogado ? "Clique no botão de emergência." : "Clique sem usuário autenticado."
  );

  if (!exigirLogin()) {
    return;
  }

  // Inicia o som no contexto direto do clique para evitar bloqueio de autoplay.
  await ativarSomAlerta();

  try {
    // Tenta buscar dados atualizados do banco; se falhar, usa os dados da sessao.
    const usuarioBanco = await buscarUsuarioNoBanco(usuarioLogado.nome);
    const nomeFinal  = usuarioBanco?.nome || usuarioLogado.nome || "Usuário";
    const localFinal = usuarioBanco?.local || usuarioLogado.local || "Local não informado";

    console.log("Disparando panico para:", nomeFinal, localFinal);
    await dispararPanico(nomeFinal, localFinal);
    alert("✅ Alerta enviado com sucesso para o WhatsApp!");
  } catch (error_) {
    console.error("Erro ao disparar emergencia:", error_);
    alert("❌ Erro ao enviar alerta: " + error_.message);
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
    if (idUsuarioEditar?.value) {
      await salvarEdicaoUsuarioFormulario();
      return;
    }

    await salvarUsuario();
  } catch (error_) {
    console.error(error_);
    alert(error_.message);
  }
}

// Handler do botao de login da navbar.
async function aoClicarLogin() {
  try {
    await fazerLogin();
  } catch (error_) {
    console.error(error_);
    alert(error_.message);
  }
}

// Handler do botao de logout da navbar.
function aoClicarLogout() {
  salvarSessaoUsuario(null);
  salvarSessaoAdmin(null);
  alert("Sessão encerrada.");
}

// Navega para tela de cadastro.
function aoClicarIrCadastro() {
  globalThis.location.href = "cadastro.html";
}

// Navega para tela inicial.
function aoClicarIrInicio() {
  globalThis.location.href = "index.html";
}

// Navega para a tela de administracao.
function aoClicarIrAdmin() {
  sincronizarSessaoAdminComUsuario();
  globalThis.location.href = "admin.html";
}

// Navega para o painel de alertas.
function aoClicarIrAlertas() {
  globalThis.location.href = "alertas.html";
}

// Ajusta texto de aviso na tela administrativa com cor semantica.
function mostrarAvisoAdmin(mensagem, tipo = "neutro") {
  if (!adminAviso) {
    return;
  }

  adminAviso.textContent = mensagem;
  adminAviso.classList.remove("erro", "sucesso");

  if (tipo === "erro") {
    adminAviso.classList.add("erro");
    return;
  }

  if (tipo === "sucesso") {
    adminAviso.classList.add("sucesso");
  }
}

// Exibe apenas o bloco solicitado dentro da pagina admin.
function exibirBlocoAdmin(bloco) {
  if (adminBlocoCriacao) adminBlocoCriacao.classList.add("oculto");
  if (adminBlocoLogin) adminBlocoLogin.classList.add("oculto");
  if (adminPainel) adminPainel.classList.add("oculto");

  if (bloco) {
    bloco.classList.remove("oculto");
  }
}

// Renderiza as linhas da tabela de usuarios no painel.
function renderizarUsuariosAdmin(usuarios) {
  if (!adminTabelaCorpo) {
    return;
  }

  adminTabelaCorpo.innerHTML = "";

  if (!usuarios.length) {
    adminTabelaCorpo.innerHTML = '<tr><td colspan="5">Nenhum usuário cadastrado.</td></tr>';
    return;
  }

  usuarios.forEach((usuario) => {
    const linha = document.createElement("tr");
    const eAdmin = Number(usuario.admin) === 1;
    const perfil = eAdmin ? "Administrador" : "Usuário";
    const acaoTexto = eAdmin ? "REBAIXAR" : "PROMOVER";
    const novoPerfil = eAdmin ? 0 : 1;

    linha.innerHTML = `
      <td>${usuario.id}</td>
      <td>${usuario.nome || "-"}</td>
      <td>${usuario.local || "-"}</td>
      <td>${perfil}</td>
      <td>
        <div class="admin-acoes-linha">
          <button
            class="botao-navbar admin-acao-perfil"
            data-id="${usuario.id}"
            data-admin="${novoPerfil}"
          >${acaoTexto}</button>
          <button
            class="botao-navbar secundario admin-acao-editar"
            data-id="${usuario.id}"
            data-nome="${String(usuario.nome || "").replaceAll('"', "&quot;")}"
            data-local="${String(usuario.local || "").replaceAll('"', "&quot;")}"
            data-local-id="${usuario.local_id ?? ""}"
          >EDITAR</button>
          <button
            class="botao-navbar secundario admin-acao-remover"
            data-id="${usuario.id}"
            data-nome="${String(usuario.nome || "").replaceAll('"', "&quot;")}"
          >REMOVER</button>
        </div>
      </td>
    `;

    adminTabelaCorpo.appendChild(linha);
  });
}

// Renderiza a lista de logs no painel administrativo.
function renderizarLogsAlertaAdmin(logs) {
  if (!adminLogsCorpo) {
    return;
  }

  adminLogsCorpo.innerHTML = "";

  if (!logs.length) {
    adminLogsCorpo.innerHTML = '<tr><td colspan="5">Nenhum log de acionamento encontrado.</td></tr>';
    return;
  }

  logs.forEach((item) => {
    const linha = document.createElement("tr");
    const data = item.data_hora
      ? new Date(item.data_hora).toLocaleString("pt-BR")
      : "-";
    const status = String(item.status || "-").toUpperCase();

    linha.innerHTML = `
      <td>${item.id ?? "-"}</td>
      <td>${item.usuario_nome || "-"}</td>
      <td>${item.usuario_local || "-"}</td>
      <td>${data}</td>
      <td>${status}</td>
    `;

    adminLogsCorpo.appendChild(linha);
  });
}

// Atualiza lista de usuarios e cabecalho do painel.
async function atualizarPainelAdmin() {
  if (!adminLogado) {
    return;
  }

  const usuarios = await listarUsuariosAdmin();
  renderizarUsuariosAdmin(usuarios);

  try {
    const logs = await listarLogsAlertaAdmin(20);
    renderizarLogsAlertaAdmin(logs);
  } catch (error_) {
    console.error("Falha ao carregar logs de alerta:", error_);
    renderizarLogsAlertaAdmin([]);
  }

  if (adminUsuarioLogado) {
    adminUsuarioLogado.textContent = `Administrador logado: Anjo ${adminLogado.nome}`;
  }

  mostrarAvisoAdmin("Painel atualizado.", "sucesso");
}

// Inicializa fluxo da pagina admin: criar primeiro admin, login ou painel.
async function inicializarPaginaAdmin() {
  if (!adminAviso) {
    return;
  }

  try {
    const status = await buscarStatusAdmin();

    if (!status.temAdmin) {
      exibirBlocoAdmin(adminBlocoCriacao);
      mostrarAvisoAdmin("Nenhum administrador cadastrado. Crie o primeiro para liberar o painel.");
      return;
    }

    sincronizarSessaoAdminComUsuario();

    if (adminLogado) {
      sincronizarSessaoUsuarioComAdmin();
      exibirBlocoAdmin(adminPainel);
      await atualizarPainelAdmin();
      return;
    }

    exibirBlocoAdmin(adminBlocoLogin);
    mostrarAvisoAdmin("Entre com nome e senha de administrador.");
  } catch (error_) {
    console.error(error_);
    mostrarAvisoAdmin(error_.message, "erro");
  }
}

// Cria o primeiro admin e entra diretamente no painel.
async function aoClicarCriarAdmin() {
  try {
    const adminCriado = await criarAdminInicial();
    if (!adminCriado) {
      return;
    }

    salvarSessaoAdmin(adminCriado);
    sincronizarSessaoUsuarioComAdmin();
    exibirBlocoAdmin(adminPainel);
    await atualizarPainelAdmin();
  } catch (error_) {
    console.error(error_);
    mostrarAvisoAdmin(error_.message, "erro");
  }
}

// Realiza login admin e abre painel com a listagem de usuarios.
async function aoClicarAdminLogin() {
  try {
    const adminAutenticado = await fazerLoginAdmin();
    if (!adminAutenticado) {
      return;
    }

    salvarSessaoAdmin(adminAutenticado);
    sincronizarSessaoUsuarioComAdmin();
    exibirBlocoAdmin(adminPainel);
    await atualizarPainelAdmin();
  } catch (error_) {
    console.error(error_);
    mostrarAvisoAdmin(error_.message, "erro");
  }
}

// Encerra a sessao admin e retorna para login/admin setup.
async function aoClicarAdminLogout() {
  salvarSessaoAdmin(null);
  await inicializarPaginaAdmin();
}

// Atualiza manualmente os dados exibidos no painel.
async function aoClicarAdminAtualizar() {
  try {
    await atualizarPainelAdmin();
  } catch (error_) {
    console.error(error_);
    mostrarAvisoAdmin(error_.message, "erro");
  }
}

async function processarAcaoPerfilAdmin(botaoPerfil) {
  const idUsuario = Number(botaoPerfil.dataset.id);
  const novoAdmin = Number(botaoPerfil.dataset.admin) === 1 ? 1 : 0;

  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    mostrarAvisoAdmin("Usuário inválido para atualização de perfil.", "erro");
    return;
  }

  try {
    const resultado = await atualizarPerfilAdmin(idUsuario, novoAdmin);
    await atualizarPainelAdmin();
    if (resultado?.mensagem) {
      mostrarAvisoAdmin(resultado.mensagem, "sucesso");
    }
  } catch (error_) {
    console.error(error_);
    mostrarAvisoAdmin(error_.message, "erro");
  }
}

function processarAcaoEditarAdmin(botaoEditar) {
  const idUsuario = Number(botaoEditar.dataset.id);
  const nomeAtual = String(botaoEditar.dataset.nome || "").trim();
  const localAtual = String(botaoEditar.dataset.local || "").trim();
  const localIdAtual = Number(botaoEditar.dataset.localId || 0);

  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    mostrarAvisoAdmin("Usuário inválido para edição.", "erro");
    return;
  }

  salvarEstadoEdicaoUsuario({
    id: idUsuario,
    nome: nomeAtual,
    local: localAtual,
    local_id: Number.isInteger(localIdAtual) && localIdAtual > 0 ? localIdAtual : null,
  });

  globalThis.location.href = "editar.html";
}

async function processarAcaoRemoverAdmin(botaoRemover) {
  const idUsuario = Number(botaoRemover.dataset.id);
  const nomeUsuario = String(botaoRemover.dataset.nome || "Usuário");

  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    mostrarAvisoAdmin("Usuário inválido para remoção.", "erro");
    return;
  }

  const confirmou = globalThis.confirm(`Deseja remover o usuário ${nomeUsuario}?`);
  if (!confirmou) {
    return;
  }

  try {
    const resultado = await removerUsuarioAdmin(idUsuario);
    await atualizarPainelAdmin();
    if (resultado?.mensagem) {
      mostrarAvisoAdmin(resultado.mensagem, "sucesso");
    }
  } catch (error_) {
    console.error(error_);
    mostrarAvisoAdmin(error_.message, "erro");
  }
}

// Processa clique nos botoes de promover/rebaixar dentro da tabela.
async function aoClicarAcaoPerfilAdmin(evento) {
  const alvo = evento.target;
  if (!(alvo instanceof HTMLElement)) {
    return;
  }

  const botaoPerfil = alvo.closest(".admin-acao-perfil");
  if (botaoPerfil) {
    await processarAcaoPerfilAdmin(botaoPerfil);
    return;
  }

  const botaoEditar = alvo.closest(".admin-acao-editar");
  if (botaoEditar) {
    processarAcaoEditarAdmin(botaoEditar);
    return;
  }

  const botaoRemover = alvo.closest(".admin-acao-remover");
  if (botaoRemover) {
    await processarAcaoRemoverAdmin(botaoRemover);
  }
}

/* =============================
   Inicializacao
   ============================= */

// Conecta eventos somente para os elementos que existem na pagina atual.
function registrarEventos() {
  if (botao) {
    botao.addEventListener("click", aoClicarEmergencia);
  }

  if (botaoDesativarAlerta) {
    botaoDesativarAlerta.addEventListener("click", aoClicarDesativarAlerta);
  }

  if (salvarBotao) {
    salvarBotao.addEventListener("click", aoClicarSalvarUsuario);
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

  if (btnIrCadastroPainel) {
    btnIrCadastroPainel.addEventListener("click", aoClicarIrCadastro);
  }

  if (btnIrInicio) {
    btnIrInicio.addEventListener("click", aoClicarIrInicio);
  }

  if (btnIrAdmin) {
    btnIrAdmin.addEventListener("click", aoClicarIrAdmin);
  }

  if (btnIrAlertas) {
    btnIrAlertas.addEventListener("click", aoClicarIrAlertas);
  }

  if (btnCriarAdmin) {
    btnCriarAdmin.addEventListener("click", aoClicarCriarAdmin);
  }

  if (btnAdminLogin) {
    btnAdminLogin.addEventListener("click", aoClicarAdminLogin);
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener("click", aoClicarAdminLogout);
  }

  if (btnAdminAtualizar) {
    btnAdminAtualizar.addEventListener("click", aoClicarAdminAtualizar);
  }

  if (adminTabelaCorpo) {
    adminTabelaCorpo.addEventListener("click", aoClicarAcaoPerfilAdmin);
  }
}

// Atualiza a interface com o estado atual e ativa os listeners.
atualizarStatusLogin();
atualizarControlesAutenticacao();
atualizarVisibilidadeBotaoAlerta();
preencherCamposCallMeBot();
registrarEventos();
inicializarPaginaAdmin();

carregarLocaisFormularios().then(() => {
  if (idUsuarioEditar?.value !== undefined) {
    preencherPaginaEdicaoUsuario();
  }
});
