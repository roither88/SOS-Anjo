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

// Porta do servidor: usa a variavel de ambiente PORT se existir, senao 3000.
const porta = process.env.PORT || 3000;

// Define onde o banco ficara salvo dentro do projeto.
const pastaBanco = path.join(__dirname, 'data');
const caminhoBanco = path.join(pastaBanco, 'sos-anjo.db');

// Garante que a pasta do banco exista antes de abrir/criar o arquivo .db.
fs.mkdirSync(pastaBanco, { recursive: true });

// Abre (ou cria) o banco SQLite no caminho definido acima.
const banco = new sqlite3.Database(caminhoBanco);

// Executa comandos de inicializacao do banco em sequencia.
banco.serialize(() => {
  // Cria a tabela de usuarios apenas se ela ainda nao existir.
  banco.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      local TEXT,
      senha TEXT
    )
  `);
});

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
  const corpo = JSON.stringify(payload);

  // Define cabecalhos importantes da resposta.
  res.writeHead(codigoStatus, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corpo),
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

        if (!nome) {
          responderJson(res, 400, { erro: 'Informe o nome do usuario.' });
          return;
        }

        // Insere registro na tabela usuarios.
        banco.run(
          'INSERT INTO usuarios (nome, local, senha) VALUES (?, ?, ?)',
          [nome, local, senha],
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

        // Busca combinacao exata de nome e senha.
        banco.get(
          'SELECT id, nome, local FROM usuarios WHERE nome = ? AND senha = ?',
          [nome, senha],
          (erro, usuario) => {
            if (erro) {
              responderJson(res, 500, { erro: 'Erro ao consultar o banco.' });
              return;
            }

            if (!usuario) {
              responderJson(res, 401, { erro: 'Nome ou senha invalidos.' });
              return;
            }

            responderJson(res, 200, usuario);
          }
        );
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