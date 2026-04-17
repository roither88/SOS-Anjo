const bcrypt = require('bcryptjs');
const path = require('path');

const SALT_ROUNDS = 10;

// Mapeamento de extensao de arquivo para tipo MIME
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

// Gera hash de senha com bcrypt
function gerarHashSenha(senhaTexto) {
  return bcrypt.hashSync(senhaTexto, SALT_ROUNDS);
}

// Valida senha contra hash bcrypt
function validarSenha(senhaInformada, senhaSalva) {
  if (!senhaSalva) {
    return false;
  }
  return bcrypt.compareSync(senhaInformada, senhaSalva);
}

// Normaliza entrada textual para evitar espacos sobrando
function normalizarTexto(valor) {
  return String(valor || '').trim();
}

// Funcao utilitaria para responder JSON de forma padronizada
function responderJson(res, codigoStatus, payload) {
  const corpo = JSON.stringify(payload);
  res.writeHead(codigoStatus, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corpo),
  });
  res.end(corpo);
}

// Le o corpo bruto da requisicao e tenta transformar em JSON
function lerCorpoJson(req) {
  return new Promise((resolve, reject) => {
    let dados = '';
    req.on('data', (chunk) => {
      dados += chunk;
    });
    req.on('end', () => {
      if (!dados) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(dados));
      } catch (erro) {
        reject(erro);
      }
    });
    req.on('error', reject);
  });
}

// Obtém o tipo MIME correto para um arquivo
function obterTipoMime(caminhoArquivo) {
  const extensao = path.extname(caminhoArquivo).toLowerCase();
  return tiposMime[extensao] || 'application/octet-stream';
}

// Valida se um valor é um ID válido (inteiro positivo)
function ehIdValido(id) {
  const idNumerico = Number(id);
  return Number.isInteger(idNumerico) && idNumerico > 0;
}

// Extrai localId de corpo (suporta localId ou local_id)
function obterLocalIdDoCorp(corpo) {
  return corpo.localId ?? corpo.local_id ?? null;
}

module.exports = {
  SALT_ROUNDS,
  tiposMime,
  gerarHashSenha,
  validarSenha,
  normalizarTexto,
  responderJson,
  lerCorpoJson,
  obterTipoMime,
  ehIdValido,
  obterLocalIdDoCorp,
};
