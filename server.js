const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const sqlite3 = require('sqlite3').verbose();

// Porta usada pelo servidor local.
const port = process.env.PORT || 3000;

// O banco fica em /data para não misturar com os arquivos da interface.
const dbDir = path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'sos-anjo.db');

// Garante que a pasta do banco exista antes de abrir o arquivo SQLite.
fs.mkdirSync(dbDir, { recursive: true });

// Abre ou cria o banco SQLite.
const db = new sqlite3.Database(dbPath);

// Cria a tabela de usuários na primeira execução, se ela ainda não existir.
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      local TEXT,
      senha TEXT
    )
  `);
});

// Tipos básicos para servir os arquivos estáticos do projeto.
const mimeTypes = {
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

// Envia respostas JSON para a API.
function responderJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });

  res.end(body);
}

// Lê e envia o corpo JSON de uma requisição POST.
function lerCorpoJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';

    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (erro) {
        reject(erro);
      }
    });

    req.on('error', reject);
  });
}

// Serve arquivos do front-end, como index.html, CSS e JS.
function servirArquivo(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (erro, conteudo) => {
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Arquivo nao encontrado.');
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': conteudo.length,
    });

    res.end(conteudo);
  });
}

// Cria o servidor HTTP
const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);

  // Permite chamadas da interface aberta em outra porta (ex.: 5500).
  const isApi = urlObj.pathname.startsWith('/api/');
  if (isApi) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS' && isApi) {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/usuario?nome=...
  if (req.method === 'GET' && urlObj.pathname === '/api/usuario') {
    const nome = String(urlObj.searchParams.get('nome') || '').trim();

    if (!nome) {
      responderJson(res, 400, { erro: 'Informe o nome do usuario.' });
      return;
    }

    db.get(
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

  // POST /api/usuario
  if (req.method === 'POST' && urlObj.pathname === '/api/usuario') {
    lerCorpoJson(req)
      .then((body) => {
        const nome = String(body.nome || '').trim();
        const local = body.local ? String(body.local).trim() : null;
        const senha = body.senha ? String(body.senha).trim() : null;

        if (!nome) {
          responderJson(res, 400, { erro: 'Informe o nome do usuario.' });
          return;
        }

        // Salva o usuario no SQLite.
        db.run(
          'INSERT INTO usuarios (nome, local, senha) VALUES (?, ?, ?)',
          [nome, local, senha],
          function (erro) {
            if (erro) {
              responderJson(res, 500, { erro: 'Nao foi possivel salvar o usuario.' });
              return;
            }

            responderJson(res, 201, {
              id: this.lastID,
              nome,
              local,
            });
          }
        );
      })
      .catch(() => {
        responderJson(res, 400, { erro: 'Corpo JSON invalido.' });
      });
    return;
  }

  // POST /api/login
  if (req.method === 'POST' && urlObj.pathname === '/api/login') {
    lerCorpoJson(req)
      .then((body) => {
        const nome = String(body.nome || '').trim();
        const senha = String(body.senha || '').trim();

        if (!nome || !senha) {
          responderJson(res, 400, { erro: 'Informe nome e senha.' });
          return;
        }

        db.get(
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

  // Arquivos do front-end.
  const requestedPath = urlObj.pathname === '/' ? '/index.html' : urlObj.pathname;
  const filePath = path.normalize(path.join(__dirname, requestedPath));

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso negado.');
    return;
  }

  servirArquivo(res, filePath);
});

// Sobe o servidor local.
server.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});