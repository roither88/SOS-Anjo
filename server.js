// Biblioteca nativa para manipular arquivos e pastas.
const fs = require('fs');

// Biblioteca nativa para montar caminhos de forma segura (Windows/Linux/macOS).
const path = require('path');

// Biblioteca nativa para criar servidor HTTP.
const http = require('http');

// Biblioteca nativa para fazer chamadas HTTPS (usada na rota de alerta).
const https = require('https');

// Classe URL para ler caminho e parametros da requisicao.
const { URL } = require('url');

// Driver SQLite para Node.js (verbose mostra logs de depuracao mais detalhados).
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Porta do servidor: usa a variavel de ambiente PORT se existir, senao 3000.
const porta = process.env.PORT || 3000;

// Define onde o banco ficara salvo dentro do projeto.
const pastaBanco = path.join(__dirname, 'data');
const caminhoBanco = path.join(pastaBanco, 'sos-anjo.db');

// Garante que a pasta do banco exista antes de abrir/criar o arquivo .db.
fs.mkdirSync(pastaBanco, { recursive: true });

// Abre (ou cria) o banco SQLite no caminho definido acima.
const banco = new sqlite3.Database(caminhoBanco);
const SALT_ROUNDS = 10;

// Detecta hash bcrypt para manter compatibilidade com registros antigos.
function ehHashBcrypt(valor) {
  return typeof valor === 'string' && /^\$2[aby]\$\d{2}\$/.test(valor);
}

// Gera hash de senha com bcrypt.
function gerarHashSenha(senhaTexto) {
  return bcrypt.hashSync(senhaTexto, SALT_ROUNDS);
}

// Valida senha contra hash bcrypt; aceita legado em texto puro e permite migracao.
function validarSenha(senhaInformada, senhaSalva) {
  if (!senhaSalva) {
    return false;
  }

  if (ehHashBcrypt(senhaSalva)) {
    return bcrypt.compareSync(senhaInformada, senhaSalva);
  }

  return senhaInformada === senhaSalva;
}

// Executa comandos de inicializacao do banco em sequencia.
banco.serialize(() => {
  // Cria a tabela de usuarios apenas se ela ainda nao existir.
  banco.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      local TEXT,
      senha TEXT,
      admin INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Em bancos antigos, adiciona a coluna admin caso ela ainda nao exista.
  banco.all('PRAGMA table_info(usuarios)', (erro, colunas) => {
    if (erro || !Array.isArray(colunas)) {
      console.error('Falha ao verificar estrutura da tabela usuarios:', erro);
      return;
    }

    const existeColunaAdmin = colunas.some((coluna) => coluna.name === 'admin');
    if (!existeColunaAdmin) {
      banco.run('ALTER TABLE usuarios ADD COLUMN admin INTEGER NOT NULL DEFAULT 0', (erroAlter) => {
        if (erroAlter) {
          console.error('Falha ao adicionar coluna admin:', erroAlter.message);
          return;
        }

        console.log('Coluna admin adicionada na tabela usuarios.');
      });
    }
  });

  // Tabela de logs para registrar quem acionou o botao de emergencia.
  banco.run(`
    CREATE TABLE IF NOT EXISTS alerta_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_nome TEXT NOT NULL,
      usuario_local TEXT,
      data_hora TEXT NOT NULL,
      status TEXT NOT NULL,
      detalhe TEXT
    )
  `);
});

// Registra eventos de alerta no banco para consulta no painel administrativo.
function registrarLogAlerta({ usuarioNome, usuarioLocal, status, detalhe }) {
  banco.run(
    `INSERT INTO alerta_logs (usuario_nome, usuario_local, data_hora, status, detalhe)
     VALUES (?, ?, ?, ?, ?)`,
    [
      String(usuarioNome || 'Nao informado').trim(),
      usuarioLocal ? String(usuarioLocal).trim() : null,
      new Date().toISOString(),
      String(status || 'desconhecido').trim(),
      detalhe ? String(detalhe).trim() : null,
    ],
    (erro) => {
      if (erro) {
        console.error('Falha ao gravar log de alerta:', erro.message);
      }
    }
  );
}

// Mapeamento de extensao de arquivo para tipo MIME (cabecalho Content-Type).
const tiposMime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

// Funcao utilitaria para responder JSON de forma padronizada.
// res: objeto de resposta HTTP
// codigoStatus: ex. 200, 400, 500
// payload: objeto JavaScript que sera convertido para JSON
function responderJson(res, codigoStatus, payload) {
  const corpo = JSON.stringify(payload); // stringify Transforma o objeto JavaScript (payload) em texto JSON.

  // Define cabecalhos importantes da resposta.
  res.writeHead(codigoStatus, {  
    'Content-Type': 'application/json; charset=utf-8', //informa que a resposta é JSON em UTF-8.
    'Content-Length': Buffer.byteLength(corpo), //Calcula quantos bytes a string corpo ocupa de verdade.
  });

  // Finaliza enviando o JSON serializado.
  res.end(corpo);
}

// Le o corpo bruto da requisicao e tenta transformar em JSON.
// Retorna uma Promise para facilitar o uso com .then()/.catch().
function lerCorpoJson(req) {
  return new Promise((resolve, reject) => {
    // Aqui vamos acumulando os "pedacos" (chunks) que chegam pela rede.
    let dados = '';

    // Evento disparado varias vezes enquanto o corpo esta chegando.
    req.on('data', (chunk) => {
      dados += chunk;
    });

    // Evento disparado quando terminou de chegar tudo.
    req.on('end', () => {
      // Se nao vier corpo nenhum, devolve objeto vazio.
      if (!dados) {
        resolve({});
        return;
      }

      // Tenta converter string para JSON.
      try {
        resolve(JSON.parse(dados));
      } catch (erro) {
        // Se JSON estiver mal formatado, cai no reject.
        reject(erro);
      }
    });

    // Captura erro de transmissao da propria requisicao.
    req.on('error', reject);
  });
}

// Envia um arquivo estatico para o navegador (HTML, CSS, JS, imagem etc.).
function servirArquivo(res, caminhoArquivo) {
  // Descobre a extensao e escolhe o tipo MIME adequado.
  const extensao = path.extname(caminhoArquivo).toLowerCase();
  const tipoConteudo = tiposMime[extensao] || 'application/octet-stream';

  // Le o arquivo no disco.
  fs.readFile(caminhoArquivo, (erro, conteudo) => {
    // Se nao encontrou o arquivo (ou outro erro de leitura), retorna 404.
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Arquivo nao encontrado.');
      return;
    }

    // Se encontrou, devolve 200 com o tipo correto.
    res.writeHead(200, {
      'Content-Type': tipoConteudo,
      'Content-Length': conteudo.length,
    });

    // Envia o conteudo do arquivo para o cliente.
    res.end(conteudo);
  });
}

// Cria o servidor HTTP principal da aplicacao.
const servidor = http.createServer((req, res) => {
  // Monta um objeto URL completo para facilitar a leitura da rota e parametros.
  const urlRequisicao = new URL(req.url, `http://${req.headers.host}`);

  // Verifica se a rota e de API (/api/...) para aplicar CORS apenas nela.
  const ehApi = urlRequisicao.pathname.startsWith('/api/');

  // CORS permite que o front-end em outra porta (ex.: Live Server 5500) chame a API.
  if (ehApi) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  // Requisicoes OPTIONS sao o "preflight" do CORS.
  if (req.method === 'OPTIONS' && ehApi) {
    res.writeHead(204);
    res.end();
    return;
  }

  // Rota: GET /api/usuario?nome=...
  // Busca um usuario pelo nome e devolve id, nome e local.
  if (req.method === 'GET' && urlRequisicao.pathname === '/api/usuario') {
    const nome = String(urlRequisicao.searchParams.get('nome') || '').trim();

    // Validacao basica: nome obrigatorio.
    if (!nome) {
      responderJson(res, 400, { erro: 'Informe o nome do usuario.' });
      return;
    }

    // Consulta no banco usando parametro para evitar SQL Injection.
    banco.get(
      'SELECT id, nome, local FROM usuarios WHERE nome = ?',
      [nome],
      (erro, usuario) => {
        if (erro) {
          responderJson(res, 500, { erro: 'Erro ao consultar o banco.' });
          return;
        }

        if (!usuario) {
          responderJson(res, 404, { erro: 'Usuario nao encontrado.' });
          return;
        }

        responderJson(res, 200, usuario);
      }
    );
    return;
  }

  // Rota: POST /api/usuario
  // Cadastra um novo usuario no banco.
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/usuario') {
    lerCorpoJson(req)
      .then((corpo) => {
        // Extrai e higieniza os campos enviados pelo front-end.
        const nome = String(corpo.nome || '').trim();
        const local = corpo.local ? String(corpo.local).trim() : null;
        const senha = corpo.senha ? String(corpo.senha).trim() : null;
        const senhaHash = senha ? gerarHashSenha(senha) : null;

        if (!nome) {
          responderJson(res, 400, { erro: 'Informe o nome do usuario.' });
          return;
        }

        // Insere registro na tabela usuarios.
        banco.run(
          'INSERT INTO usuarios (nome, local, senha) VALUES (?, ?, ?)',
          [nome, local, senhaHash],
          function (erro) {
            if (erro) {
              responderJson(res, 500, { erro: 'Nao foi possivel salvar o usuario.' });
              return;
            }

            // this.lastID contem o id gerado automaticamente pelo SQLite.
            responderJson(res, 201, {
              id: this.lastID,
              nome,
              local,
            });
          }
        );
      })
      .catch(() => {
        // Se o JSON vier invalido, responde erro de requisicao.
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return;
  }

  // Rota: POST /api/alerta
  // Encaminha mensagem para o CallMeBot no servidor (evita bloqueio de CORS no navegador).
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/alerta') {
    lerCorpoJson(req)
      .then((corpo) => {
        // Campos esperados para enviar WhatsApp pelo CallMeBot.
        const telefone = String(corpo.telefone || '').trim();
        const apikey = String(corpo.apikey || '').trim();
        const texto = String(corpo.texto || '').trim();

        if (!telefone || !apikey || !texto) {
          responderJson(res, 400, { erro: 'Informe telefone, apikey e texto.' });
          return;
        }

        // Codifica texto para URL (espaco, acento e caracteres especiais).
        const mensagem = encodeURIComponent(texto);
        const urlDestino = `https://api.callmebot.com/whatsapp.php?phone=${telefone}&text=${mensagem}&apikey=${apikey}`;

        // Faz chamada GET para a API do CallMeBot.
        https.get(urlDestino, (respostaCallMeBot) => {
          let dadosRetorno = '';

          // Acumula resposta da API externa.
          respostaCallMeBot.on('data', (chunk) => {
            dadosRetorno += chunk;
          });

          // Quando terminar, retorna ao front-end o resultado recebido.
          respostaCallMeBot.on('end', () => {
            console.log('CallMeBot:', dadosRetorno);
            responderJson(res, 200, { ok: true, resposta: dadosRetorno });
          });
        }).on('error', (erro) => {
          // Erro de rede/chamada externa.
          console.error('Erro CallMeBot:', erro.message);
          responderJson(res, 500, { erro: 'Falha ao contatar o CallMeBot.' });
        });
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return;
  }

  // Rota: GET /api/admin/logs-alerta?limit=20
  // Retorna os ultimos logs de acionamento do botao de emergencia.
  if (req.method === 'GET' && urlRequisicao.pathname === '/api/admin/logs-alerta') {
    const limiteBruto = Number(urlRequisicao.searchParams.get('limit') || 20);
    const limite = Number.isInteger(limiteBruto) && limiteBruto > 0
      ? Math.min(limiteBruto, 100)
      : 20;

    banco.all(
      `SELECT id, usuario_nome, usuario_local, data_hora, status, detalhe
       FROM alerta_logs
       ORDER BY id DESC
       LIMIT ?`,
      [limite],
      (erro, logs) => {
        if (erro) {
          responderJson(res, 500, { erro: 'Erro ao listar logs de alerta.' });
          return;
        }

        responderJson(res, 200, {
          total: Array.isArray(logs) ? logs.length : 0,
          logs: logs || [],
        });
      }
    );
    return;
  }

  // Rota: POST /api/alerta/evento
  // Registra eventos de interface (clique no botao de emergencia/desativar alerta).
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/alerta/evento') {
    lerCorpoJson(req)
      .then((corpo) => {
        const usuarioNome = String(corpo.usuarioNome || '').trim() || 'Nao informado';
        const usuarioLocal = String(corpo.usuarioLocal || '').trim() || null;
        const status = String(corpo.status || '').trim() || 'evento';
        const detalhe = String(corpo.detalhe || '').trim() || null;

        registrarLogAlerta({
          usuarioNome,
          usuarioLocal,
          status,
          detalhe,
        });

        responderJson(res, 201, { ok: true });
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return;
  }

  // Rota: POST /api/login
  // Valida nome e senha do usuario.
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/login') {
    lerCorpoJson(req)
      .then((corpo) => {
        const nome = String(corpo.nome || '').trim();
        const senha = String(corpo.senha || '').trim();

        if (!nome || !senha) {
          responderJson(res, 400, { erro: 'Informe nome e senha.' });
          return;
        }

        // Busca por nome e valida senha com bcrypt (ou formato antigo em texto puro).
        banco.get(
          'SELECT id, nome, local, admin, senha FROM usuarios WHERE nome = ?',
          [nome],
          (erro, usuario) => {
            if (erro) {
              responderJson(res, 500, { erro: 'Erro ao consultar o banco.' });
              return;
            }

            if (!usuario || !validarSenha(senha, usuario.senha)) {
              responderJson(res, 401, { erro: 'Nome ou senha invalidos.' });
              return;
            }

            // Migra senha antiga (texto puro) para hash no primeiro login valido.
            if (usuario.senha && !ehHashBcrypt(usuario.senha)) {
              const novoHash = gerarHashSenha(senha);
              banco.run('UPDATE usuarios SET senha = ? WHERE id = ?', [novoHash, usuario.id]);
            }

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
    return;
  }

  // Rota: GET /api/admin/status
  // Informa se ja existe ao menos um usuario administrador.
  if (req.method === 'GET' && urlRequisicao.pathname === '/api/admin/status') {
    banco.get(
      'SELECT COUNT(*) AS total FROM usuarios WHERE admin = 1',
      [],
      (erro, linha) => {
        if (erro) {
          responderJson(res, 500, { erro: 'Erro ao consultar administradores.' });
          return;
        }

        const totalAdmins = Number((linha && linha.total) || 0);
        responderJson(res, 200, {
          temAdmin: totalAdmins > 0,
          totalAdmins,
        });
      }
    );
    return;
  }

  // Rota: POST /api/admin/criar-inicial
  // Cria o primeiro admin apenas quando nao existe nenhum administrador.
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/admin/criar-inicial') {
    lerCorpoJson(req)
      .then((corpo) => {
        const nome = String(corpo.nome || '').trim();
        const local = corpo.local ? String(corpo.local).trim() : null;
        const senha = String(corpo.senha || '').trim();
        const senhaHash = senha ? gerarHashSenha(senha) : '';

        if (!nome || !senha) {
          responderJson(res, 400, { erro: 'Informe nome e senha do administrador.' });
          return;
        }

        banco.get('SELECT COUNT(*) AS total FROM usuarios WHERE admin = 1', [], (erroCount, linha) => {
          if (erroCount) {
            responderJson(res, 500, { erro: 'Erro ao validar administradores existentes.' });
            return;
          }

          const totalAdmins = Number((linha && linha.total) || 0);
          if (totalAdmins > 0) {
            responderJson(res, 409, { erro: 'Ja existe administrador cadastrado.' });
            return;
          }

          banco.run(
            'INSERT INTO usuarios (nome, local, senha, admin) VALUES (?, ?, ?, 1)',
            [nome, local, senhaHash],
            function (erroInsert) {
              if (erroInsert) {
                responderJson(res, 500, { erro: 'Nao foi possivel criar o administrador.' });
                return;
              }

              responderJson(res, 201, {
                id: this.lastID,
                nome,
                local,
                admin: 1,
              });
            }
          );
        });
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return;
  }

  // Rota: POST /api/admin/login
  // Autentica apenas usuarios com permissao de administrador.
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/admin/login') {
    lerCorpoJson(req)
      .then((corpo) => {
        const nome = String(corpo.nome || '').trim();
        const senha = String(corpo.senha || '').trim();

        if (!nome || !senha) {
          responderJson(res, 400, { erro: 'Informe nome e senha.' });
          return;
        }

        banco.get(
          'SELECT id, nome, local, admin, senha FROM usuarios WHERE nome = ? AND admin = 1',
          [nome],
          (erro, usuario) => {
            if (erro) {
              responderJson(res, 500, { erro: 'Erro ao consultar o banco.' });
              return;
            }

            if (!usuario || !validarSenha(senha, usuario.senha)) {
              responderJson(res, 401, { erro: 'Credenciais invalidas ou sem permissao de administrador.' });
              return;
            }

            // Migra senha antiga (texto puro) para hash no primeiro login admin valido.
            if (usuario.senha && !ehHashBcrypt(usuario.senha)) {
              const novoHash = gerarHashSenha(senha);
              banco.run('UPDATE usuarios SET senha = ? WHERE id = ?', [novoHash, usuario.id]);
            }

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
    return;
  }

  // Rota: GET /api/admin/usuarios
  // Lista usuarios para exibir no painel administrativo.
  if (req.method === 'GET' && urlRequisicao.pathname === '/api/admin/usuarios') {
    banco.all(
      'SELECT id, nome, local, admin FROM usuarios ORDER BY nome COLLATE NOCASE ASC',
      [],
      (erro, usuarios) => {
        if (erro) {
          responderJson(res, 500, { erro: 'Erro ao listar usuarios.' });
          return;
        }

        responderJson(res, 200, {
          total: Array.isArray(usuarios) ? usuarios.length : 0,
          usuarios: usuarios || [],
        });
      }
    );
    return;
  }

  // Rota: POST /api/admin/usuario/perfil
  // Promove ou rebaixa um usuario no campo admin (1 = admin, 0 = comum).
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/admin/usuario/perfil') {
    lerCorpoJson(req)
      .then((corpo) => {
        const usuarioId = Number(corpo.id);
        const novoAdmin = Number(corpo.admin) === 1 ? 1 : 0;

        if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
          responderJson(res, 400, { erro: 'Informe um id de usuario valido.' });
          return;
        }

        banco.get('SELECT id, admin FROM usuarios WHERE id = ?', [usuarioId], (erroBusca, usuarioAlvo) => {
          if (erroBusca) {
            responderJson(res, 500, { erro: 'Erro ao consultar usuario.' });
            return;
          }

          if (!usuarioAlvo) {
            responderJson(res, 404, { erro: 'Usuario nao encontrado.' });
            return;
          }

          if (Number(usuarioAlvo.admin) === novoAdmin) {
            responderJson(res, 200, {
              id: usuarioId,
              admin: novoAdmin,
              mensagem: 'Perfil ja estava atualizado.',
            });
            return;
          }

          const concluirAtualizacao = () => {
            banco.run(
              'UPDATE usuarios SET admin = ? WHERE id = ?',
              [novoAdmin, usuarioId],
              function (erroUpdate) {
                if (erroUpdate) {
                  responderJson(res, 500, { erro: 'Nao foi possivel atualizar o perfil.' });
                  return;
                }

                responderJson(res, 200, {
                  id: usuarioId,
                  admin: novoAdmin,
                  mensagem: novoAdmin === 1 ? 'Usuario promovido para administrador.' : 'Usuario rebaixado para perfil comum.',
                });
              }
            );
          };

          // Protege o sistema para nunca ficar sem nenhum admin.
          if (Number(usuarioAlvo.admin) === 1 && novoAdmin === 0) {
            banco.get('SELECT COUNT(*) AS total FROM usuarios WHERE admin = 1', [], (erroCount, linha) => {
              if (erroCount) {
                responderJson(res, 500, { erro: 'Erro ao validar quantidade de administradores.' });
                return;
              }

              const totalAdmins = Number((linha && linha.total) || 0);
              if (totalAdmins <= 1) {
                responderJson(res, 409, { erro: 'Nao e permitido remover o ultimo administrador do sistema.' });
                return;
              }

              concluirAtualizacao();
            });
            return;
          }

          concluirAtualizacao();
        });
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return;
  }

  // Rota: POST /api/admin/usuario/atualizar
  // Atualiza nome, local e opcionalmente senha de um usuario.
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/admin/usuario/atualizar') {
    lerCorpoJson(req)
      .then((corpo) => {
        const usuarioId = Number(corpo.id);
        const nome = String(corpo.nome || '').trim();
        const local = corpo.local ? String(corpo.local).trim() : null;
        const senha = corpo.senha ? String(corpo.senha).trim() : '';

        if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
          responderJson(res, 400, { erro: 'Informe um id de usuario valido.' });
          return;
        }

        if (!nome) {
          responderJson(res, 400, { erro: 'Informe um nome valido para o usuario.' });
          return;
        }

        const senhaHash = senha ? gerarHashSenha(senha) : null;

        const concluirAtualizacao = () => {
          banco.get('SELECT id FROM usuarios WHERE id = ?', [usuarioId], (erroBusca, usuario) => {
            if (erroBusca) {
              responderJson(res, 500, { erro: 'Erro ao consultar usuario.' });
              return;
            }

            if (!usuario) {
              responderJson(res, 404, { erro: 'Usuario nao encontrado.' });
              return;
            }

            const sql = senhaHash
              ? 'UPDATE usuarios SET nome = ?, local = ?, senha = ? WHERE id = ?'
              : 'UPDATE usuarios SET nome = ?, local = ? WHERE id = ?';
            const params = senhaHash
              ? [nome, local, senhaHash, usuarioId]
              : [nome, local, usuarioId];

            banco.run(sql, params, function (erroUpdate) {
              if (erroUpdate) {
                if (erroUpdate.code === 'SQLITE_CONSTRAINT') {
                  responderJson(res, 409, { erro: 'Ja existe usuario com este nome.' });
                  return;
                }

                responderJson(res, 500, { erro: 'Nao foi possivel atualizar o usuario.' });
                return;
              }

              responderJson(res, 200, {
                id: usuarioId,
                nome,
                local,
                mensagem: 'Usuario atualizado com sucesso.',
              });
            });
          });
        };

        concluirAtualizacao();
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return;
  }

  // Rota: POST /api/admin/usuario/remover
  // Remove usuario por id com protecao para nao remover o ultimo admin.
  if (req.method === 'POST' && urlRequisicao.pathname === '/api/admin/usuario/remover') {
    lerCorpoJson(req)
      .then((corpo) => {
        const usuarioId = Number(corpo.id);

        if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
          responderJson(res, 400, { erro: 'Informe um id de usuario valido.' });
          return;
        }

        banco.get('SELECT id, admin FROM usuarios WHERE id = ?', [usuarioId], (erroBusca, usuarioAlvo) => {
          if (erroBusca) {
            responderJson(res, 500, { erro: 'Erro ao consultar usuario.' });
            return;
          }

          if (!usuarioAlvo) {
            responderJson(res, 404, { erro: 'Usuario nao encontrado.' });
            return;
          }

          const concluirRemocao = () => {
            banco.run('DELETE FROM usuarios WHERE id = ?', [usuarioId], function (erroDelete) {
              if (erroDelete) {
                responderJson(res, 500, { erro: 'Nao foi possivel remover o usuario.' });
                return;
              }

              responderJson(res, 200, {
                id: usuarioId,
                mensagem: 'Usuario removido com sucesso.',
              });
            });
          };

          if (Number(usuarioAlvo.admin) === 1) {
            banco.get('SELECT COUNT(*) AS total FROM usuarios WHERE admin = 1', [], (erroCount, linha) => {
              if (erroCount) {
                responderJson(res, 500, { erro: 'Erro ao validar quantidade de administradores.' });
                return;
              }

              const totalAdmins = Number((linha && linha.total) || 0);
              if (totalAdmins <= 1) {
                responderJson(res, 409, { erro: 'Nao e permitido remover o ultimo administrador do sistema.' });
                return;
              }

              concluirRemocao();
            });
            return;
          }

          concluirRemocao();
        });
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return;
  }

  // Se nao caiu em nenhuma rota de API, tenta servir arquivo estatico do front-end.
  // Quando a rota e '/', devolve a pagina inicial.
  const caminhoSolicitado = urlRequisicao.pathname === '/' ? '/index.html' : urlRequisicao.pathname;

  // Normaliza e monta caminho absoluto para evitar inconsistencias.
  const caminhoArquivo = path.normalize(path.join(__dirname, caminhoSolicitado));

  // Protecao contra "path traversal" (tentativa de acessar arquivos fora do projeto).
  if (!caminhoArquivo.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso negado.');
    return;
  }

  // Entrega o arquivo solicitado ao navegador.
  servirArquivo(res, caminhoArquivo);
});

// Inicia o servidor e mostra no terminal em qual endereco ele esta rodando.
servidor.listen(porta, () => {
  console.log(`Servidor rodando em http://localhost:${porta}`);
});