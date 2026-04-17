const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Inicializa o banco de dados
function inicializarBanco(caminhoBanco) {
  const pastaBanco = path.dirname(caminhoBanco);
  fs.mkdirSync(pastaBanco, { recursive: true });
  
  const banco = new sqlite3.Database(caminhoBanco);
  return banco;
}





// ===== FUNCOES DE QUERY =====

// Resolve um local apenas por id
function obterLocalPorId(banco, localId, callback) {
  const localIdNumerico = Number(localId);

  if (!Number.isInteger(localIdNumerico) || localIdNumerico <= 0) {
    callback(null, null);
    return;
  }

  banco.get('SELECT id, local FROM locais WHERE id = ?', [localIdNumerico], (erro, local) => {
    if (erro) {
      callback(erro, null);
      return;
    }
    callback(null, local || null);
  });
}

// Busca usuario com o nome do local ja resolvido via JOIN
function buscarUsuarioComLocalPorNome(banco, nome, callback) {
  banco.get(
    `SELECT u.id, u.nome, l.local AS local, u.admin, u.senha, u.local_id
     FROM usuarios u
     LEFT JOIN locais l ON l.id = u.local_id
     WHERE u.nome = ?`,
    [nome],
    callback
  );
}

// Lista usuarios com o local resolvido para exibicao no painel
function listarUsuariosComLocal(banco, callback) {
  banco.all(
    `SELECT u.id, u.nome, l.local AS local, u.admin, u.local_id
     FROM usuarios u
     LEFT JOIN locais l ON l.id = u.local_id
     ORDER BY u.nome COLLATE NOCASE ASC`,
    [],
    callback
  );
}

// Lista locais cadastrados
function listarLocais(banco, callback) {
  banco.all(
    `SELECT MIN(id) AS id, local
     FROM locais
     GROUP BY LOWER(TRIM(local))
     ORDER BY LOWER(TRIM(local)) ASC`,
    [],
    callback
  );
}

// Registra eventos de alerta no banco
function registrarLogAlerta(banco, { usuarioNome, usuarioLocal, status, detalhe }) {
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

// Lista logs de alertas
function listarLogsAlerta(banco, limite, callback) {
  banco.all(
    `SELECT id, usuario_nome, usuario_local, data_hora, status, detalhe
     FROM alerta_logs
     ORDER BY id DESC
     LIMIT ?`,
    [limite],
    callback
  );
}

// Lista alertas ativos
function listarAlertasAtivos(banco, callback) {
  banco.all(
    `SELECT id, usuario_nome, usuario_local, data_hora
     FROM alertas_ativos
     WHERE ativo = 1
     ORDER BY data_hora DESC`,
    [],
    callback
  );
}

// Insere um alerta ativo
function inserirAlertaAtivo(banco, { usuarioNome, usuarioLocal }) {
  banco.run(
    `INSERT INTO alertas_ativos (usuario_nome, usuario_local, data_hora, ativo)
     VALUES (?, ?, ?, 1)`,
    [usuarioNome, usuarioLocal, new Date().toISOString()],
    (erro) => {
      if (erro) {
        console.error('Falha ao registrar alerta ativo:', erro.message);
      }
    }
  );
}

// Desativa um alerta
function desativarAlerta(banco, alertaId, callback) {
  banco.get('SELECT id, ativo FROM alertas_ativos WHERE id = ?', [alertaId], (erroBusca, alerta) => {
    if (erroBusca) {
      callback(erroBusca, null);
      return;
    }
    if (!alerta) {
      callback(null, null);
      return;
    }
    if (Number(alerta.ativo) === 0) {
      callback(null, { jaDesativado: true, id: alertaId });
      return;
    }

    banco.run(
      'UPDATE alertas_ativos SET ativo = 0 WHERE id = ?',
      [alertaId],
      function (erroUpdate) {
        callback(erroUpdate, { id: alertaId });
      }
    );
  });
}

// Conta total de administradores
function contarAdmins(banco, callback) {
  banco.get('SELECT COUNT(*) AS total FROM usuarios WHERE admin = 1', [], (erro, linha) => {
    if (erro) {
      callback(erro, null);
      return;
    }
    const total = Number((linha && linha.total) || 0);
    callback(null, total);
  });
}

// Busca usuario por ID
function buscarUsuarioPorId(banco, id, callback) {
  banco.get('SELECT id, admin FROM usuarios WHERE id = ?', [id], callback);
}

// Atualiza perfil de usuario (admin/comum)
function atualizarPerfil(banco, usuarioId, novoAdmin, callback) {
  banco.run(
    'UPDATE usuarios SET admin = ? WHERE id = ?',
    [novoAdmin, usuarioId],
    function (erro) {
      callback(erro);
    }
  );
}

// Atualiza dados de usuario
function atualizarUsuario(banco, usuarioId, nome, localId, senhaHash, callback) {
  const sql = senhaHash
    ? 'UPDATE usuarios SET nome = ?, local_id = ?, senha = ? WHERE id = ?'
    : 'UPDATE usuarios SET nome = ?, local_id = ? WHERE id = ?';
  const params = senhaHash
    ? [nome, localId, senhaHash, usuarioId]
    : [nome, localId, usuarioId];

  banco.run(sql, params, function (erro) {
    callback(erro);
  });
}

// Remove usuario por ID
function removerUsuario(banco, usuarioId, callback) {
  banco.run('DELETE FROM usuarios WHERE id = ?', [usuarioId], function (erro) {
    callback(erro);
  });
}

// Insere novo usuario
function inserirUsuario(banco, nome, localId, senhaHash, isAdmin, callback) {
  const admin = isAdmin ? 1 : 0;
  banco.run(
    'INSERT INTO usuarios (nome, local_id, senha, admin) VALUES (?, ?, ?, ?)',
    [nome, localId, senhaHash, admin],
    function (erro) {
      callback(erro, this.lastID);
    }
  );
}

// Exporta as funcoes para uso em outros arquivos
module.exports = {
  inicializarBanco,
  obterLocalPorId,
  buscarUsuarioComLocalPorNome,
  listarUsuariosComLocal,
  listarLocais,
  registrarLogAlerta,
  listarLogsAlerta,
  listarAlertasAtivos,
  inserirAlertaAtivo,
  desativarAlerta,
  contarAdmins,
  buscarUsuarioPorId,
  atualizarPerfil,
  atualizarUsuario,
  removerUsuario,
  inserirUsuario,
};
