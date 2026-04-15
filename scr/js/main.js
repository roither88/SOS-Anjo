/* =============================
   Configuracao da aplicacao
   ============================= */

// Em producao (Render), usa mesma origem. Em dev fora da porta 3000, usa localhost:3000.
const estaEmAmbienteLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_BASE = estaEmAmbienteLocal && window.location.port !== "3000"
  ? "http://localhost:3000"
  : "";

// Chave usada para manter o usuario logado no navegador.
const STORAGE_USUARIO = "sos_anjo_usuario_logado";
const STORAGE_ADMIN = "sos_anjo_admin_logado";

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
const btnIrAdmin = document.getElementById("btnIrAdmin");
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
    throw new Error("CallMeBot rejeitou: " + respostaTexto.replace(/<[^>]+>/g, " ").trim());
  }
}

// Registra no backend eventos de clique relacionados ao alerta.
async function registrarEventoAlerta(status, detalhe) {
  const usuarioNome = (usuarioLogado && usuarioLogado.nome) || "Nao autenticado";
  const usuarioLocal = (usuarioLogado && usuarioLogado.local) || "Nao informado";

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
  } catch (erro) {
    console.warn("Falha ao registrar evento de alerta:", erro.message);
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

// Consulta se existe administrador cadastrado no banco.
async function buscarStatusAdmin() {
  const response = await fetch(`${API_BASE}/api/admin/status`);
  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Nao foi possivel consultar o status de administrador.");
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
    throw new Error(resultado.erro || "Nao foi possivel criar o administrador inicial.");
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
    throw new Error(resultado.erro || "Nao foi possivel autenticar administrador.");
  }

  return resultado;
}

// Carrega a lista de usuarios para o painel administrativo.
async function listarUsuariosAdmin() {
  const response = await fetch(`${API_BASE}/api/admin/usuarios`);
  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Nao foi possivel carregar os usuarios.");
  }

  return Array.isArray(resultado.usuarios) ? resultado.usuarios : [];
}

// Busca os ultimos logs de acionamento do botao de emergencia.
async function listarLogsAlertaAdmin(limite = 20) {
  const response = await fetch(`${API_BASE}/api/admin/logs-alerta?limit=${encodeURIComponent(limite)}`);
  const resultado = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(resultado.erro || "Nao foi possivel carregar os logs de alerta.");
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
    throw new Error(resultado.erro || "Nao foi possivel atualizar o perfil do usuario.");
  }

  return resultado;
}

// Atualiza os dados de um usuario (nome, local e opcionalmente senha).
async function atualizarUsuarioAdmin(idUsuario, nomeUsuario, localUsuario, novaSenha) {
  const body = {
    id: idUsuario,
    nome: nomeUsuario,
    local: localUsuario,
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
    throw new Error(resultado.erro || "Nao foi possivel atualizar os dados do usuario.");
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
    throw new Error(resultado.erro || "Nao foi possivel remover o usuario.");
  }

  return resultado;
}

/* =============================
   Handlers de eventos
   ============================= */

// Handler do botao de emergencia na tela principal.
async function aoClicarEmergencia() {
  console.log("Botao de emergencia clicado.");

  await registrarEventoAlerta(
    "botao_emergencia_clicado",
    usuarioLogado ? "Clique no botao de emergencia." : "Clique sem usuario autenticado."
  );

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
  registrarEventoAlerta(
    "alerta_desativado",
    usuarioLogado ? "Clique no botao desativar alerta." : "Desativacao sem usuario autenticado."
  );

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
  salvarSessaoAdmin(null);
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

// Navega para a tela de administracao.
function aoClicarIrAdmin() {
  window.location.href = "admin.html";
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
    adminTabelaCorpo.innerHTML = '<tr><td colspan="5">Nenhum usuario cadastrado.</td></tr>';
    return;
  }

  usuarios.forEach((usuario) => {
    const linha = document.createElement("tr");
    const eAdmin = Number(usuario.admin) === 1;
    const perfil = eAdmin ? "Administrador" : "Usuario";
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
            data-nome="${String(usuario.nome || "").replace(/"/g, "&quot;")}"
            data-local="${String(usuario.local || "").replace(/"/g, "&quot;")}"
          >EDITAR</button>
          <button
            class="botao-navbar secundario admin-acao-remover"
            data-id="${usuario.id}"
            data-nome="${String(usuario.nome || "").replace(/"/g, "&quot;")}"
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
  } catch (erroLogs) {
    console.error("Falha ao carregar logs de alerta:", erroLogs);
    renderizarLogsAlertaAdmin([]);
  }

  if (adminUsuarioLogado) {
    adminUsuarioLogado.textContent = `Administrador logado: ${adminLogado.nome}`;
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

    if (adminLogado) {
      sincronizarSessaoUsuarioComAdmin();
      exibirBlocoAdmin(adminPainel);
      await atualizarPainelAdmin();
      return;
    }

    exibirBlocoAdmin(adminBlocoLogin);
    mostrarAvisoAdmin("Entre com nome e senha de administrador.");
  } catch (erro) {
    console.error(erro);
    mostrarAvisoAdmin(erro.message, "erro");
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
  } catch (erro) {
    console.error(erro);
    mostrarAvisoAdmin(erro.message, "erro");
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
  } catch (erro) {
    console.error(erro);
    mostrarAvisoAdmin(erro.message, "erro");
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
  } catch (erro) {
    console.error(erro);
    mostrarAvisoAdmin(erro.message, "erro");
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
    const idUsuario = Number(botaoPerfil.getAttribute("data-id"));
    const novoAdmin = Number(botaoPerfil.getAttribute("data-admin")) === 1 ? 1 : 0;

    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      mostrarAvisoAdmin("Usuario invalido para atualizacao de perfil.", "erro");
      return;
    }

    try {
      const resultado = await atualizarPerfilAdmin(idUsuario, novoAdmin);
      await atualizarPainelAdmin();
      if (resultado && resultado.mensagem) {
        mostrarAvisoAdmin(resultado.mensagem, "sucesso");
      }
    } catch (erro) {
      console.error(erro);
      mostrarAvisoAdmin(erro.message, "erro");
    }

    return;
  }

  const botaoEditar = alvo.closest(".admin-acao-editar");
  if (botaoEditar) {
    const idUsuario = Number(botaoEditar.getAttribute("data-id"));
    const nomeAtual = String(botaoEditar.getAttribute("data-nome") || "").trim();
    const localAtual = String(botaoEditar.getAttribute("data-local") || "").trim();

    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      mostrarAvisoAdmin("Usuario invalido para edicao.", "erro");
      return;
    }

    const novoNomeBruto = window.prompt("Novo nome do usuario:", nomeAtual);
    if (novoNomeBruto === null) {
      return;
    }

    const novoNome = novoNomeBruto.trim();
    if (!novoNome) {
      mostrarAvisoAdmin("O nome do usuario nao pode ficar vazio.", "erro");
      return;
    }

    const novoLocalBruto = window.prompt("Novo local do usuario:", localAtual);
    if (novoLocalBruto === null) {
      return;
    }

    const novoLocal = novoLocalBruto.trim();
    let novaSenha = "";

    const alterarSenha = window.confirm("Deseja alterar a senha deste usuario?");
    if (alterarSenha) {
      const novaSenhaBruta = window.prompt("Digite a nova senha:", "");
      if (novaSenhaBruta === null) {
        return;
      }

      novaSenha = novaSenhaBruta.trim();
      if (!novaSenha) {
        mostrarAvisoAdmin("A nova senha nao pode ficar vazia.", "erro");
        return;
      }
    }

    try {
      const resultado = await atualizarUsuarioAdmin(idUsuario, novoNome, novoLocal, novaSenha);
      await atualizarPainelAdmin();
      if (resultado && resultado.mensagem) {
        mostrarAvisoAdmin(resultado.mensagem, "sucesso");
      }
    } catch (erro) {
      console.error(erro);
      mostrarAvisoAdmin(erro.message, "erro");
    }

    return;
  }

  const botaoRemover = alvo.closest(".admin-acao-remover");
  if (botaoRemover) {
    const idUsuario = Number(botaoRemover.getAttribute("data-id"));
    const nomeUsuario = String(botaoRemover.getAttribute("data-nome") || "Usuario");

    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      mostrarAvisoAdmin("Usuario invalido para remocao.", "erro");
      return;
    }

    const confirmou = window.confirm(`Deseja remover o usuario ${nomeUsuario}?`);
    if (!confirmou) {
      return;
    }

    try {
      const resultado = await removerUsuarioAdmin(idUsuario);
      await atualizarPainelAdmin();
      if (resultado && resultado.mensagem) {
        mostrarAvisoAdmin(resultado.mensagem, "sucesso");
      }
    } catch (erro) {
      console.error(erro);
      mostrarAvisoAdmin(erro.message, "erro");
    }
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

  if (btnIrAdmin) {
    btnIrAdmin.addEventListener("click", aoClicarIrAdmin);
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
preencherCamposCallMeBot();
registrarEventos();
inicializarPaginaAdmin();
