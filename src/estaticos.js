// =============================================================================
// MÓDULO DE ARQUIVOS ESTÁTICOS
// Responsável por servir arquivos para o navegador (HTML, CSS, JS, imagens)
// =============================================================================

// Importa módulo para manipular o sistema de arquivos
const fs = require('fs');

// Importa módulo para trabalhar com caminhos de ficheiros
const path = require('path');

// Importa função que detecta o tipo correto de um arquivo
const { obterTipoMime } = require('./utilitarios');

// =============================================================================
// FUNÇÃO: servirArquivo
// Responsabilidade: Enviar um arquivo estático para o cliente via HTTP
// Parâmetros:
//   - res: Objeto de resposta HTTP (para enviar dados ao navegador)
//   - caminhoArquivo: Caminho completo do arquivo a ser servido
// =============================================================================
function servirArquivo(res, caminhoArquivo) {
  // Detecta o tipo MIME do arquivo (text/html, text/css, image/png, etc.)
  const tipoConteudo = obterTipoMime(caminhoArquivo);

  // Lê o arquivo de forma assincrona (não bloqueia o servidor)
  fs.readFile(caminhoArquivo, (erro, conteudo) => {
    // Trata erro se o arquivo não existir ou não puder ser lido
    if (erro) {
      // Envia resposta HTTP 404 (Não Encontrado)
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Arquivo nao encontrado.');
      return;
    }

    // Se chegou aqui, o arquivo foi lido com sucesso
    // Envia resposta HTTP 200 (OK) com os headers apropriados
    res.writeHead(200, {
      // Define o tipo de conteúdo (HTML, CSS, imagem, etc.)
      'Content-Type': tipoConteudo,
      // Define o tamanho do arquivo em bytes
      'Content-Length': conteudo.length,
    });

    // Envia o conteúdo do arquivo para o navegador
    res.end(conteudo);
  });
}

// Exporta a função para ser usada em outros módulos (como rotas.js)
module.exports = {
  servirArquivo,
};
