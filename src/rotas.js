// =============================================================================
// MÓDULO DE ROTAS DA API
// Responsável por mapear URLs HTTP para funções que processam requisições
// Cada função verifica se a URL e o método HTTP correspondem a uma rota
// Se sim, processa e retorna uma resposta JSON; se não, retorna false
// =============================================================================

// Importa módulo HTTPS para fazer requisições externas (CallMeBot)
const https = require('https');

// Importa funções utilitárias (validação, hash, resposta JSON, etc.)
const {
  responderJson,      // Envia resposta em formato JSON com status HTTP
  lerCorpoJson,       // Lê e faz parse do corpo JSON da requisição
  gerarHashSenha,     // Converte senha em hash seguro
  validarSenha,       // Valida se a senha inserida corresponde ao hash
  ehIdValido,         // Valida se um ID é válido (número inteiro positivo)
  obterLocalIdDoCorp, // Extrai o local_id do corpo da requisição
} = require('./utilitarios');

// Importa módulo de banco de dados (SQLite)
const db = require('./banco');

// =============================================================================
// SEÇÃO 1: ROTAS PÚBLICAS (Não requerem autenticação)
// =============================================================================

// ========== ROTA: GET /api/health ==========
// Descrição: Verifica se o servidor está funcionando (health check)
// Retorna: { ok: true, ambiente: 'development|production' }
// Status HTTP: 200 (OK)
function rotaHealth(req, res, urlRequisicao) {
  // Verifica se é um GET para /api/health
  if (req.method === 'GET' && urlRequisicao.pathname === '/api/health') {
    // Retorna resposta de sucesso com informações do ambiente
    responderJson(res, 200, {
      ok: true,
      ambiente: process.env.NODE_ENV || 'development',
    });
    return true; // Rota foi processada
  }
  return false; // Esta não é a rota procurada
}

// ========== ROTA: GET /api/usuario?nome=NomeDoUsuario ==========
// Descrição: Busca um usuário pelo nome
// Query Params: nome (string, obrigatório)
// Retorna: { id, nome, local, local_id } ou erro
// Status HTTP: 200 (Encontrado), 400 (Parâmetro faltando), 404 (Não encontrado), 500 (Erro BD)
function rotaUsuario(req, res, urlRequisicao, banco) {
  // Verifica se é um GET para /api/usuario
  if (req.method === 'GET' && urlRequisicao.pathname === '/api/usuario') {
    // Extrai e valida o parâmetro 'nome' da URL
    const nome = String(urlRequisicao.searchParams.get('nome') || '').trim();

    // Se o nome não foi fornecido, retorna erro 400
    if (!nome) {
      responderJson(res, 400, { erro: 'Informe o nome do usuario.' });
      return true;
    }

    // Busca o usuário no banco de dados junto com sua localização
    db.buscarUsuarioComLocalPorNome(banco, nome, (erro, usuario) => {
      // Trata erro de acesso ao banco (500)
      if (erro) {
        responderJson(res, 500, { erro: 'Erro ao consultar o banco.' });
        return;
      }
      // Se o usuário não existe, retorna 404
      if (!usuario) {
        responderJson(res, 404, { erro: 'Usuario nao encontrado.' });
        return;
      }
      // Retorna o usuário encontrado com sucesso (200)
      responderJson(res, 200, usuario);
    });
    return true;
  }
  return false;
}

// ========== ROTA: GET /api/locais ==========
// Descrição: Lista todos os locais disponíveis no sistema
// Retorna: { total: number, locais: Array }
// Status HTTP: 200 (OK), 500 (Erro BD)
function rotaLocais(req, res, urlRequisicao, banco) {
  // Verifica se é um GET para /api/locais
  if (req.method === 'GET' && urlRequisicao.pathname === '/api/locais') {
    // Busca todos os locais do banco de dados
    db.listarLocais(banco, (erro, locais) => {
      // Trata erro de acesso ao banco
      if (erro) {
        responderJson(res, 500, { erro: 'Erro ao listar locais.' });
        return;
      }
      // Retorna a lista de locais com o total de registros
      responderJson(res, 200, {
        total: Array.isArray(locais) ? locais.length : 0,
        locais: locais || [],
      });
    });
    return true;
  }
  return false;
}

// ========== ROTA: POST /api/usuario ==========
// Descrição: Cadastra um novo usuário comum no sistema
// Body: { nome, local_id, senha (opcional) }
// Retorna: { id, nome, local, local_id }
// Status HTTP: 201 (Criado), 400 (Dados inválidos), 500 (Erro BD), 409 (Conflito)
function rotaCadastroUsuario(req, res, urlRequisicao, banco) {
  // Verifica se é um POST para /api/usuario
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/usuario') {
    // Lê o corpo JSON da requisição
    lerCorpoJson(req)
      .then((corpo) => {
        // Extrai e valida os dados do corpo
        const nome = String(corpo.nome || '').trim();
        const localEntrada = obterLocalIdDoCorp(corpo);
        const senha = corpo.senha ? String(corpo.senha).trim() : null;
        const senhaHash = senha ? gerarHashSenha(senha) : null; // Hash da senha (bcrypt-like)

        // Valida se o nome foi fornecido
        if (!nome) {
          responderJson(res, 400, { erro: 'Informe o nome do usuario.' });
          return;
        }

        // Busca o local selecionado no banco para confirmar que existe
        db.obterLocalPorId(banco, localEntrada, (erroLocal, localSelecionado) => {
          if (erroLocal) {
            responderJson(res, 500, { erro: 'Erro ao consultar o local selecionado.' });
            return;
          }

          // Valida se o local existe
          if (!localSelecionado) {
            responderJson(res, 400, { erro: 'Selecione um local valido.' });
            return;
          }

          // Insere o novo usuário no banco com status de não-admin (false)
          db.inserirUsuario(banco, nome, localSelecionado.id, senhaHash, false, (erro, id) => {
            if (erro) {
              responderJson(res, 500, { erro: 'Nao foi possivel salvar o usuario.' });
              return;
            }

            // Retorna os dados do novo usuário criado (status 201 = Created)
            responderJson(res, 201, {
              id,
              nome,
              local: localSelecionado.local,
              local_id: localSelecionado.id,
            });
          });
        });
      })
      .catch(() => {
        // Se o JSON for inválido, retorna 400
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return true;
  }
  return false;
}

// ========== ROTA: POST /api/alerta ==========
// Descrição: Envia um alerta via WhatsApp através da API CallMeBot
// Body: { telefone, apikey, texto }
// Retorna: { ok: true, resposta: string }
// Status HTTP: 200 (Enviado), 400 (Dados inválidos), 500 (Erro CallMeBot)
function rotaAlerta(req, res, urlRequisicao) {
  // Verifica se é um POST para /api/alerta
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/alerta') {
    // Lê o corpo JSON da requisição
    lerCorpoJson(req)
      .then((corpo) => {
        // Extrai os dados necessários para enviar o alerta via WhatsApp
        const telefone = String(corpo.telefone || '').trim();
        const apikey = String(corpo.apikey || '').trim();
        const texto = String(corpo.texto || '').trim();

        // Valida se todos os dados foram fornecidos
        if (!telefone || !apikey || !texto) {
          responderJson(res, 400, { erro: 'Informe telefone, apikey e texto.' });
          return;
        }

        // Codifica a mensagem para a URL (espaços e caracteres especiais)
        const mensagem = encodeURIComponent(texto);
        // Monta a URL de requisição para a API CallMeBot
        const urlDestino = `https://api.callmebot.com/whatsapp.php?phone=${telefone}&text=${mensagem}&apikey=${apikey}`;

        // Faz uma requisição HTTPS para a API CallMeBot
        https.get(urlDestino, (respostaCallMeBot) => {
          let dadosRetorno = ''; // Acumula os dados da resposta

          // Recebe os dados em chunks (pedaços) e os acumula
          respostaCallMeBot.on('data', (chunk) => {
            dadosRetorno += chunk;
          });

          // Quando a resposta termina, envia o resultado ao cliente
          respostaCallMeBot.on('end', () => {
            console.log('CallMeBot:', dadosRetorno);
            responderJson(res, 200, { ok: true, resposta: dadosRetorno });
          });
        }).on('error', (erro) => {
          // Trata erros na comunicação com CallMeBot
          console.error('Erro CallMeBot:', erro.message);
          responderJson(res, 500, { erro: 'Falha ao contatar o CallMeBot.' });
        });
      })
      .catch(() => {
        // Se o JSON for inválido
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return true;
  }
  return false;
}

// =============================================================================
// SEÇÃO 2: ROTAS DE ALERTA (Gerenciam alertas do sistema)
// =============================================================================

// ========== ROTA: GET /api/admin/logs-alerta?limit=5&page=1 ===========

function rotaLogsAlerta(req, res, urlRequisicao, banco) {
  if (req.method === 'GET' && urlRequisicao.pathname === '/api/admin/logs-alerta') {
    const limiteBruto = Number(urlRequisicao.searchParams.get('limit') || 20);
    const limite = Number.isInteger(limiteBruto) && limiteBruto > 0
      ? Math.min(limiteBruto, 100)
      : 20;
    const paginaBruta = Number(urlRequisicao.searchParams.get('page') || 1);
    const paginaSolicitada = Number.isInteger(paginaBruta) && paginaBruta > 0 ? paginaBruta : 1;

    db.contarLogsAlerta(banco, (erroContagem, totalLogs) => {
      if (erroContagem) {
        responderJson(res, 500, { erro: 'Erro ao contar logs de alerta.' });
        return;
      }

      const totalPaginas = Math.max(1, Math.ceil(totalLogs / limite));
      const paginaAtual = Math.min(paginaSolicitada, totalPaginas);
      const offset = (paginaAtual - 1) * limite;

      db.listarLogsAlerta(banco, limite, offset, (erro, logs) => {
        if (erro) {
          responderJson(res, 500, { erro: 'Erro ao listar logs de alerta.' });
          return;
        }

        responderJson(res, 200, {
          total: totalLogs,
          limite,
          paginaAtual,
          totalPaginas,
          logs: logs || [],
        });
      });
    });
    return true;
  }
  return false;
}

// ========== ROTA: POST /api/alerta/evento ==========
// Descrição: Registra um evento de alerta no sistema
// Body: { usuarioNome, usuarioLocal, status, detalhe }
// Nota: Se status contém 'EMERGENCIA', 'ALERTA' ou 'BOTAO_EMERGENCIA', insere alerta ativo
// Retorna: { ok: true }
// Status HTTP: 201 (Criado), 400 (Dados inválidos)
function rotaEventoAlerta(req, res, urlRequisicao, banco) {
  // Verifica se é um POST para /api/alerta/evento
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/alerta/evento') {
    // Lê o corpo JSON da requisição
    lerCorpoJson(req)
      .then((corpo) => {
        // Extrai dados com valores padrão se não forem fornecidos
        const usuarioNome = String(corpo.usuarioNome || '').trim() || 'Nao informado';
        const usuarioLocal = String(corpo.usuarioLocal || '').trim() || null;
        const status = String(corpo.status || '').trim() || 'evento';
        const detalhe = String(corpo.detalhe || '').trim() || null;

        // Registra o evento de alerta no log (histórico)
        db.registrarLogAlerta(banco, {
          usuarioNome,
          usuarioLocal,
          status,
          detalhe,
        });

        // Verifica se o usuário está autenticado
        const usuarioAutenticado = usuarioNome !== 'Nao informado' && usuarioNome !== 'Nao autenticado';
        // Converte status para maiúsculas para comparação
        const statusUpper = status.toUpperCase();
        // Se é uma emergência real, insere como alerta ativo
        if (usuarioAutenticado && (statusUpper.includes('EMERGENCIA') || statusUpper.includes('ALERTA') || statusUpper.includes('BOTAO_EMERGENCIA'))) {
          db.inserirAlertaAtivo(banco, { usuarioNome, usuarioLocal });
        }

        // Retorna sucesso (201 = Created)
        responderJson(res, 201, { ok: true });
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return true;
  }
  return false;
}

// ========== ROTA: GET /api/alertas/ativos ==========
// Descrição: Lista todos os alertas ativos no momento
// Retorna: { total: number, alertas: Array }
// Status HTTP: 200 (OK), 500 (Erro BD)
function rotaAlertasAtivos(req, res, urlRequisicao, banco) {
  // Verifica se é um GET para /api/alertas/ativos
  if (req.method === 'GET' && urlRequisicao.pathname === '/api/alertas/ativos') {
    // Busca todos os alertas que estão ativos (não foram desativados)
    db.listarAlertasAtivos(banco, (erro, alertas) => {
      if (erro) {
        responderJson(res, 500, { erro: 'Erro ao listar alertas.' });
        return;
      }

      // Retorna a lista de alertas ativos
      responderJson(res, 200, {
        total: Array.isArray(alertas) ? alertas.length : 0,
        alertas: alertas || [],
      });
    });
    return true;
  }
  return false;
}

// ========== ROTA: POST /api/alertas/desativar/:id ==========
// Descrição: Desativa um alerta específico pelo seu ID
// URL Params: id (número inteiro do alerta)
// Retorna: { id, mensagem: string }
// Status HTTP: 200 (OK), 400 (ID inválido), 404 (Alerta não encontrado), 500 (Erro BD)
function rotaDesativarAlerta(req, res, urlRequisicao, banco) {
  // Verifica se é um POST para /api/alertas/desativar/:id (padrão dinâmico)
  if (req.method === 'POST' && urlRequisicao.pathname.startsWith('/api/alertas/desativar/')) {
    // Extrai o ID do alerta da URL
    const id = urlRequisicao.pathname.replace('/api/alertas/desativar/', '').trim();
    const alertaId = Number(id);

    // Valida se o ID é um número válido
    if (!ehIdValido(alertaId)) {
      responderJson(res, 400, { erro: 'ID de alerta invalido.' });
      return true;
    }

    // Desativa o alerta no banco de dados
    db.desativarAlerta(banco, alertaId, (erro, resultado) => {
      if (erro) {
        responderJson(res, 500, { erro: 'Erro ao consultar alerta.' });
        return;
      }

      // Se o alerta não existe
      if (!resultado) {
        responderJson(res, 404, { erro: 'Alerta nao encontrado.' });
        return;
      }

      // Se o alerta já estava desativado
      if (resultado.jaDesativado) {
        responderJson(res, 200, {
          id: alertaId,
          mensagem: 'Alerta ja estava desativado.',
        });
        return;
      }

      // Se foi desativado com sucesso
      responderJson(res, 200, {
        id: alertaId,
        mensagem: 'Alerta desativado com sucesso.',
      });
    });
    return true;
  }
  return false;
}

// =============================================================================
// SEÇÃO 3: ROTAS DE LOGIN E AUTENTICAÇÃO
// =============================================================================

// ========== ROTA: POST /api/login ==========
// Descrição: Autentica um usuário comum (não-admin)
// Body: { nome, senha }
// Retorna: { id, nome, local, admin }
// Status HTTP: 200 (Autenticado), 400 (Dados inválidos), 401 (Credenciais inválidas), 500 (Erro BD)
function rotaLogin(req, res, urlRequisicao, banco) {
  // Verifica se é um POST para /api/login
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/login') {
    // Lê o corpo JSON com as credenciais
    lerCorpoJson(req)
      .then((corpo) => {
        // Extrai nome e senha
        const nome = String(corpo.nome || '').trim();
        const senha = String(corpo.senha || '').trim();

        // Valida se ambos foram fornecidos
        if (!nome || !senha) {
          responderJson(res, 400, { erro: 'Informe nome e senha.' });
          return;
        }

        // Busca o usuário no banco de dados
        db.buscarUsuarioComLocalPorNome(banco, nome, (erro, usuario) => {
          if (erro) {
            responderJson(res, 500, { erro: 'Erro ao consultar o banco.' });
            return;
          }

          // Verifica se o usuário existe e a senha está correta
          if (!usuario || !validarSenha(senha, usuario.senha)) {
            // Não especifica se é nome ou senha para maior segurança
            responderJson(res, 401, { erro: 'Nome ou senha invalidos.' });
            return;
          }

          // Retorna os dados do usuário autenticado
          responderJson(res, 200, {
            id: usuario.id,
            nome: usuario.nome,
            local: usuario.local,
            admin: Number(usuario.admin) === 1 ? 1 : 0, // Converte para 0 ou 1
          });
        });
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return true;
  }
  return false;
}

// =============================================================================
// SEÇÃO 4: ROTAS ADMINISTRATIVAS (Gerenciam admins, usuários e sistema)
// =============================================================================

// ========== ROTA: GET /api/admin/status ==========
// Descrição: Verifica se já existe algum administrador cadastrado
// Retorna: { temAdmin: boolean, totalAdmins: number }
// Status HTTP: 200 (OK), 500 (Erro BD)
function rotaAdminStatus(req, res, urlRequisicao, banco) {
  // Verifica se é um GET para /api/admin/status
  if (req.method === 'GET' && urlRequisicao.pathname === '/api/admin/status') {
    // Conta o total de administradores no sistema
    db.contarAdmins(banco, (erro, totalAdmins) => {
      if (erro) {
        responderJson(res, 500, { erro: 'Erro ao consultar administradores.' });
        return;
      }

      // Retorna se tem admin e quantos existem
      responderJson(res, 200, {
        temAdmin: totalAdmins > 0,
        totalAdmins,
      });
    });
    return true;
  }
  return false;
}

// ========== ROTA: POST /api/admin/criar-inicial ==========
// Descrição: Cria o PRIMEIRO administrador do sistema (apenas se não houver nenhum)
// Body: { nome, local_id, senha }
// Retorna: { id, nome, local, local_id, admin: 1 }
// Status HTTP: 201 (Criado), 400 (Dados inválidos), 409 (Já existe admin), 500 (Erro BD)
function rotaCriarAdminInicial(req, res, urlRequisicao, banco) {
  // Verifica se é um POST para /api/admin/criar-inicial
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/admin/criar-inicial') {
    // Lê o corpo JSON com dados do novo admin
    lerCorpoJson(req)
      .then((corpo) => {
        // Extrai dados
        const nome = String(corpo.nome || '').trim();
        const localEntrada = obterLocalIdDoCorp(corpo);
        const senha = String(corpo.senha || '').trim();
        const senhaHash = senha ? gerarHashSenha(senha) : ''; // Hash da senha

        // Valida se nome e senha foram fornecidos
        if (!nome || !senha) {
          responderJson(res, 400, { erro: 'Informe nome e senha do administrador.' });
          return;
        }

        // Verifica se já existe algum administrador
        db.contarAdmins(banco, (erroCount, totalAdmins) => {
          if (erroCount) {
            responderJson(res, 500, { erro: 'Erro ao validar administradores existentes.' });
            return;
          }

          // Protege: só permite criar o primeiro admin
          if (totalAdmins > 0) {
            responderJson(res, 409, { erro: 'Ja existe administrador cadastrado.' });
            return;
          }

          // Busca o local selecionado
          db.obterLocalPorId(banco, localEntrada, (erroLocal, localSelecionado) => {
            if (erroLocal) {
              responderJson(res, 500, { erro: 'Erro ao resolver o local do administrador.' });
              return;
            }

            // Valida se o local existe
            if (!localSelecionado) {
              responderJson(res, 400, { erro: 'Selecione um local valido.' });
              return;
            }

            // Insere o novo administrador (true = é admin)
            db.inserirUsuario(banco, nome, localSelecionado.id, senhaHash, true, (erro, id) => {
              if (erro) {
                responderJson(res, 500, { erro: 'Nao foi possivel criar o administrador.' });
                return;
              }

              // Retorna os dados do novo admin criado (201 = Created)
              responderJson(res, 201, {
                id,
                nome,
                local: localSelecionado.local,
                local_id: localSelecionado.id,
                admin: 1,
              });
            });
          });
        });
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return true;
  }
  return false;
}

// ========== ROTA: POST /api/admin/login ==========
// Descrição: Autentica um usuário administrador
// Body: { nome, senha }
// Retorna: { id, nome, local, admin: 1 }
// Status HTTP: 200 (Autenticado), 400 (Dados inválidos), 401 (Credenciais inválidas), 500 (Erro BD)
function rotaAdminLogin(req, res, urlRequisicao, banco) {
  // Verifica se é um POST para /api/admin/login
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/admin/login') {
    // Lê o corpo JSON com credenciais
    lerCorpoJson(req)
      .then((corpo) => {
        // Extrai nome e senha
        const nome = String(corpo.nome || '').trim();
        const senha = String(corpo.senha || '').trim();

        // Valida se ambos foram fornecidos
        if (!nome || !senha) {
          responderJson(res, 400, { erro: 'Informe nome e senha.' });
          return;
        }

        // Query para buscar admin com nome especificado (u.admin = 1)
        banco.get(
          `SELECT u.id, u.nome, l.local AS local, u.admin, u.senha, u.local_id
           FROM usuarios u
           LEFT JOIN locais l ON l.id = u.local_id
           WHERE u.nome = ? AND u.admin = 1`, // Importante: filtra apenas admins
          [nome],
          (erro, usuario) => {
            if (erro) {
              responderJson(res, 500, { erro: 'Erro ao consultar o banco.' });
              return;
            }

            // Verifica se o usuário é admin e se a senha está correta
            if (!usuario || !validarSenha(senha, usuario.senha)) {
              responderJson(res, 401, { erro: 'Credenciais invalidas ou sem permissao de administrador.' });
              return;
            }

            // Retorna os dados do admin autenticado
            responderJson(res, 200, {
              id: usuario.id,
              nome: usuario.nome,
              local: usuario.local,
              admin: Number(usuario.admin) === 1 ? 1 : 0,
            });
          }
        );
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return true;
  }
  return false;
}

// ========== ROTA: GET /api/admin/usuarios ==========
// Descrição: Lista todos os usuários cadastrados no sistema
// Retorna: { total: number, usuarios: Array }
// Status HTTP: 200 (OK), 500 (Erro BD)
function rotaListarUsuarios(req, res, urlRequisicao, banco) {
  // Verifica se é um GET para /api/admin/usuarios
  if (req.method === 'GET' && urlRequisicao.pathname === '/api/admin/usuarios') {
    // Busca todos os usuários com suas localizações
    db.listarUsuariosComLocal(banco, (erro, usuarios) => {
      if (erro) {
        responderJson(res, 500, { erro: 'Erro ao listar usuarios.' });
        return;
      }

      // Retorna a lista de usuários com o total
      responderJson(res, 200, {
        total: Array.isArray(usuarios) ? usuarios.length : 0,
        usuarios: usuarios || [],
      });
    });
    return true;
  }
  return false;
}

// ========== ROTA: POST /api/admin/usuario/perfil ==========
// Descrição: Promove/Rebaixa um usuário para/de administrador
// Body: { id, admin (0 ou 1) }
// Retorna: { id, admin, mensagem: string }
// Status HTTP: 200 (OK), 400 (ID inválido), 404 (Usuário não encontrado), 409 (Conflito), 500 (Erro BD)
// Proteção: Não permite remover o último administrador do sistema
function rotaAtualizarPerfilUsuario(req, res, urlRequisicao, banco) {
  // Verifica se é um POST para /api/admin/usuario/perfil
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/admin/usuario/perfil') {
    // Lê o corpo JSON
    lerCorpoJson(req)
      .then((corpo) => {
        // Extrai o ID do usuário e o novo status de admin
        const usuarioId = Number(corpo.id);
        const novoAdmin = Number(corpo.admin) === 1 ? 1 : 0; // Garante que seja 0 ou 1

        // Valida o ID
        if (!ehIdValido(usuarioId)) {
          responderJson(res, 400, { erro: 'Informe um id de usuario valido.' });
          return;
        }

        // Busca o usuário no banco de dados
        db.buscarUsuarioPorId(banco, usuarioId, (erroBusca, usuarioAlvo) => {
          if (erroBusca) {
            responderJson(res, 500, { erro: 'Erro ao consultar usuario.' });
            return;
          }

          // Se o usuário não existe
          if (!usuarioAlvo) {
            responderJson(res, 404, { erro: 'Usuario nao encontrado.' });
            return;
          }

          // Se o perfil já está com o novo valor
          if (Number(usuarioAlvo.admin) === novoAdmin) {
            responderJson(res, 200, {
              id: usuarioId,
              admin: novoAdmin,
              mensagem: 'Perfil ja estava atualizado.',
            });
            return;
          }

          // PROTEÇÃO: Impede remover o último administrador do sistema
          if (Number(usuarioAlvo.admin) === 1 && novoAdmin === 0) {
            // Se quer remover um admin (rebaixar), verifica se há mais admins
            db.contarAdmins(banco, (erroCount, totalAdmins) => {
              if (erroCount) {
                responderJson(res, 500, { erro: 'Erro ao validar quantidade de administradores.' });
                return;
              }

              // Se este é o único admin, não permite remover
              if (totalAdmins <= 1) {
                responderJson(res, 409, { erro: 'Nao e permitido remover o ultimo administrador do sistema.' });
                return;
              }

              // Pode remover, pois existem outros admins
              db.atualizarPerfil(banco, usuarioId, novoAdmin, (erroUpdate) => {
                if (erroUpdate) {
                  responderJson(res, 500, { erro: 'Nao foi possivel atualizar o perfil.' });
                  return;
                }

                responderJson(res, 200, {
                  id: usuarioId,
                  admin: novoAdmin,
                  mensagem: novoAdmin === 1 ? 'Usuario promovido para administrador.' : 'Usuario rebaixado para perfil comum.',
                });
              });
            });
            return;
          }

          // Se não é um caso especial, atualiza normalmente
          db.atualizarPerfil(banco, usuarioId, novoAdmin, (erroUpdate) => {
            if (erroUpdate) {
              responderJson(res, 500, { erro: 'Nao foi possivel atualizar o perfil.' });
              return;
            }

            responderJson(res, 200, {
              id: usuarioId,
              admin: novoAdmin,
              mensagem: novoAdmin === 1 ? 'Usuario promovido para administrador.' : 'Usuario rebaixado para perfil comum.',
            });
          });
        });
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return true;
  }
  return false;
}

// ========== ROTA: POST /api/admin/usuario/atualizar ==========
// Descrição: Atualiza dados de um usuário (nome, local, senha)
// Body: { id, nome, local_id, senha (opcional) }
// Retorna: { id, nome, local, local_id, mensagem }
// Status HTTP: 200 (OK), 400 (Dados inválidos), 404 (Não encontrado), 409 (Conflito), 500 (Erro BD)
function rotaAtualizarUsuario(req, res, urlRequisicao, banco) {
  // Verifica se é um POST para /api/admin/usuario/atualizar
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/admin/usuario/atualizar') {
    // Lê o corpo JSON com dados a atualizar
    lerCorpoJson(req)
      .then((corpo) => {
        // Extrai dados
        const usuarioId = Number(corpo.id);
        const nome = String(corpo.nome || '').trim();
        const localEntrada = obterLocalIdDoCorp(corpo);
        const senha = corpo.senha ? String(corpo.senha).trim() : ''; // Senha é opcional

        // Valida o ID
        if (!ehIdValido(usuarioId)) {
          responderJson(res, 400, { erro: 'Informe um id de usuario valido.' });
          return;
        }

        // Valida o nome
        if (!nome) {
          responderJson(res, 400, { erro: 'Informe um nome valido para o usuario.' });
          return;
        }

        // Gera hash da nova senha se fornecida
        const senhaHash = senha ? gerarHashSenha(senha) : null;

        // Valida o local
        db.obterLocalPorId(banco, localEntrada, (erroLocal, localSelecionado) => {
          if (erroLocal) {
            responderJson(res, 500, { erro: 'Erro ao resolver o local do usuario.' });
            return;
          }

          // Se o local não existe
          if (!localSelecionado) {
            responderJson(res, 400, { erro: 'Selecione um local valido.' });
            return;
          }

          // Busca o usuário para validar que existe
          db.buscarUsuarioPorId(banco, usuarioId, (erroBusca, usuario) => {
            if (erroBusca) {
              responderJson(res, 500, { erro: 'Erro ao consultar usuario.' });
              return;
            }

            // Se não existe
            if (!usuario) {
              responderJson(res, 404, { erro: 'Usuario nao encontrado.' });
              return;
            }

            // Atualiza o usuário no banco
            db.atualizarUsuario(banco, usuarioId, nome, localSelecionado.id, senhaHash, (erroUpdate) => {
              // Verifica se houve erro de constraint (nome duplicado)
              if (erroUpdate) {
                if (erroUpdate.code === 'SQLITE_CONSTRAINT') {
                  responderJson(res, 409, { erro: 'Ja existe usuario com este nome.' });
                  return;
                }

                responderJson(res, 500, { erro: 'Nao foi possivel atualizar o usuario.' });
                return;
              }

              // Retorna os dados atualizados
              responderJson(res, 200, {
                id: usuarioId,
                nome,
                local: localSelecionado.local,
                local_id: localSelecionado.id,
                mensagem: 'Usuario atualizado com sucesso.',
              });
            });
          });
        });
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return true;
  }
  return false;
}

// ========== ROTA: POST /api/admin/usuario/remover ==========
// Descrição: Remove um usuário do sistema
// Body: { id }
// Retorna: { id, mensagem: string }
// Status HTTP: 200 (OK), 400 (ID inválido), 404 (Não encontrado), 409 (Conflito), 500 (Erro BD)
// Proteção: Não permite remover o último administrador do sistema
function rotaRemoverUsuario(req, res, urlRequisicao, banco) {
  // Verifica se é um POST para /api/admin/usuario/remover
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/admin/usuario/remover') {
    // Lê o corpo JSON
    lerCorpoJson(req)
      .then((corpo) => {
        // Extrai o ID do usuário a remover
        const usuarioId = Number(corpo.id);

        // Valida o ID
        if (!ehIdValido(usuarioId)) {
          responderJson(res, 400, { erro: 'Informe um id de usuario valido.' });
          return;
        }

        // Busca o usuário para obter informações antes de deletar
        db.buscarUsuarioPorId(banco, usuarioId, (erroBusca, usuarioAlvo) => {
          if (erroBusca) {
            responderJson(res, 500, { erro: 'Erro ao consultar usuario.' });
            return;
          }

          // Se o usuário não existe
          if (!usuarioAlvo) {
            responderJson(res, 404, { erro: 'Usuario nao encontrado.' });
            return;
          }

          // PROTEÇÃO: Se é um admin, verifica se pode ser removido
          if (Number(usuarioAlvo.admin) === 1) {
            db.contarAdmins(banco, (erroCount, totalAdmins) => {
              if (erroCount) {
                responderJson(res, 500, { erro: 'Erro ao validar quantidade de administradores.' });
                return;
              }

              // Protege o último admin
              if (totalAdmins <= 1) {
                responderJson(res, 409, { erro: 'Nao e permitido remover o ultimo administrador do sistema.' });
                return;
              }

              // Pode remover pois existem outros admins
              db.removerUsuario(banco, usuarioId, (erroDelete) => {
                if (erroDelete) {
                  responderJson(res, 500, { erro: 'Nao foi possivel remover o usuario.' });
                  return;
                }

                responderJson(res, 200, {
                  id: usuarioId,
                  mensagem: 'Usuario removido com sucesso.',
                });
              });
            });
            return;
          }

          // Se não é admin, remove normalmente
          db.removerUsuario(banco, usuarioId, (erroDelete) => {
            if (erroDelete) {
              responderJson(res, 500, { erro: 'Nao foi possivel remover o usuario.' });
              return;
            }

            responderJson(res, 200, {
              id: usuarioId,
              mensagem: 'Usuario removido com sucesso.',
            });
          });
        });
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return true;
  }
  return false;
}

// =============================================================================
// FUNÇÃO PRINCIPAL: PROCESSADOR DE ROTAS
// Responsabilidade: Verificar as rotas na ordem correta e processar a requisição
// Padrão: Cada função verifica se a requisição corresponde à sua rota
//         Se sim, processa e retorna true; se não, retorna false
// Ordem de Processamento: Rotas públicas → Rotas com banco de dados
// =============================================================================

// ========== FUNÇÃO: processarRotas() ==========
// Descrição: Função principal que testa todas as rotas contra a requisição
// Parâmetros:
//   - req: Objeto da requisição HTTP
//   - res: Objeto da resposta HTTP
//   - urlRequisicao: URL parseada com pathname e searchParams
//   - banco: Conexão com banco de dados SQLite
// Retorna: true se uma rota foi processada, false se nenhuma rota correspondeu
function processarRotas(req, res, urlRequisicao, banco) {
  // ===== ROTAS PÚBLICAS (Não requerem banco de dados) =====
  if (rotaHealth(req, res, urlRequisicao)) return true;  // GET /api/health
  if (rotaAlerta(req, res, urlRequisicao)) return true;  // POST /api/alerta

  // ===== ROTAS COM BANCO DE DADOS =====
  // Rotas de usuário
  if (rotaUsuario(req, res, urlRequisicao, banco)) return true;           // GET /api/usuario?nome=...
  if (rotaLocais(req, res, urlRequisicao, banco)) return true;            // GET /api/locais
  if (rotaCadastroUsuario(req, res, urlRequisicao, banco)) return true;   // POST /api/usuario
  
  // Rotas de alerta
  if (rotaLogsAlerta(req, res, urlRequisicao, banco)) return true;        // GET /api/admin/logs-alerta
  if (rotaEventoAlerta(req, res, urlRequisicao, banco)) return true;      // POST /api/alerta/evento
  if (rotaAlertasAtivos(req, res, urlRequisicao, banco)) return true;     // GET /api/alertas/ativos
  if (rotaDesativarAlerta(req, res, urlRequisicao, banco)) return true;   // POST /api/alertas/desativar/:id
  
  // Rotas de login
  if (rotaLogin(req, res, urlRequisicao, banco)) return true;             // POST /api/login
  
  // Rotas administrativas
  if (rotaAdminStatus(req, res, urlRequisicao, banco)) return true;                        // GET /api/admin/status
  if (rotaCriarAdminInicial(req, res, urlRequisicao, banco)) return true;                 // POST /api/admin/criar-inicial
  if (rotaAdminLogin(req, res, urlRequisicao, banco)) return true;                        // POST /api/admin/login
  if (rotaListarUsuarios(req, res, urlRequisicao, banco)) return true;                    // GET /api/admin/usuarios
  if (rotaAtualizarPerfilUsuario(req, res, urlRequisicao, banco)) return true;            // POST /api/admin/usuario/perfil
  if (rotaAtualizarUsuario(req, res, urlRequisicao, banco)) return true;                  // POST /api/admin/usuario/atualizar
  if (rotaRemoverUsuario(req, res, urlRequisicao, banco)) return true;                    // POST /api/admin/usuario/remover

  // Se nenhuma rota API foi encontrada, retorna false para que o servidor
  // tente servir um arquivo estático (HTML, CSS, JS, imagem, etc.)
  return false;
}

// Exporta a função principal para ser usada em server.js
module.exports = {
  processarRotas,
};
