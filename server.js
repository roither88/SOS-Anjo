const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const db = require('./src/banco');
const { processarRotas } = require('./src/rotas');
const { servirArquivo } = require('./src/estaticos');

const porta = process.env.PORT || 3000;
const caminhoBanco = path.join(__dirname, 'data', 'sos-anjo.db');

const banco = db.inicializarBanco(caminhoBanco);

// Cria o servidor HTTP principal da aplicacao
const servidor = http.createServer((req, res) => {
  const protocolo = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || `localhost:${porta}`;
  const urlRequisicao = new URL(req.url, `${protocolo}://${host}`);
  const ehApi = urlRequisicao.pathname.startsWith('/api/');

  // CORS para rotas de API
  if (ehApi) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  // Preflight CORS
  if (req.method === 'OPTIONS' && ehApi) {
    res.writeHead(204);
    res.end();
    return;
  }

  // Processar rotas de API
  if (processarRotas(req, res, urlRequisicao, banco)) {
    return;
  }

  // Servir arquivo estático se não for rota de API
  const caminhoSolicitado = urlRequisicao.pathname === '/' ? '/index.html' : urlRequisicao.pathname;
  const caminhoArquivo = path.normalize(path.join(__dirname, caminhoSolicitado));

  // Protecao contra path traversal
  if (!caminhoArquivo.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso negado.');
    return;
  }

  servirArquivo(res, caminhoArquivo);
});

// Inicia o servidor e mostra no terminal em qual endereco ele esta rodando
servidor.listen(porta, () => {
  console.log(`Servidor rodando em http://localhost:${porta}`);
});

// Em hospedagem gerenciada, fecha conexao com banco ao receber sinal de desligamento
process.on('SIGTERM', () => {
  banco.close(() => {
    process.exit(0);
  });
});