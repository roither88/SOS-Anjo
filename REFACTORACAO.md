# Refatoração do Servidor

## 📋 Resumo da Refatoração

Seu `server.js` foi refatorado de **1000+ linhas** em um arquivo único para una **arquitetura modular bem organizada**.

### Antes ❌
- 1 arquivo gigante com tudo misturado
- Difícil de manter e debugar
- Código repetido

### Depois ✅
- 4 módulos bem organizados
- Código limpo e modular
- Fácil de manter e estender
- Apenas **~60 linhas** no server.js principal

---

## 📁 Estrutura de Arquivos

```
SOS-Anjo/
├── server.js              (↓ Reduzido de 1200 para ~60 linhas)
├── src/
│   ├── utilitarios.js    (Funções utilitárias: senha, JSON, validação)
│   ├── banco.js          (Lógica de banco de dados: queries, migrações)
│   ├── rotas.js          (Todas as 18 rotas da API)
│   └── estaticos.js      (Serviço de arquivos estáticos)
└── data/
    └── sos-anjo.db       (banco de dados SQLite)
```

---

## 🎯 O que foi separado

### [src/utilitarios.js](src/utilitarios.js)
Funções utilitárias reutilizáveis:
- `gerarHashSenha()` / `validarSenha()` → Segurança
- `responderJson()` → Padrão de resposta HTTP
- `lerCorpoJson()` → Parse de requisições
- `ehIdValido()` → Validações
- `obterLocalIdDoCorp()` → Helpers

### [src/banco.js](src/banco.js)
Toda lógica de banco de dados:
- `inicializarBanco()` → Setup inicial + migrações
- `buscarUsuarioComLocalPorNome()` → Queries de usuário
- `listarLocais()` → Operações de locais
- `registrarLogAlerta()` → Operações de alerta
- `atualizarUsuario()` / `atualizarPerfil()` → Updates
- 18+ funções de database

### [src/rotas.js](src/rotas.js)
Todas as 18 rotas da API:
- **Rotas públicas**: `/api/health`, `/api/usuario`, `/api/locais`, `/api/alerta`
- **Rotas de alerta**: `/api/alerta/evento`, `/api/alertas/ativos`, `/api/alertas/desativar`
- **Rotas de login**: `/api/login`, `/api/admin/login`, `/api/admin/crear-inicial`
- **Rotas admin**: `/api/admin/usuarios`, `/api/admin/usuario/perfil`, etc.

Cada rota é uma função isolada que retorna `true` se foi processada.

### [src/estaticos.js](src/estaticos.js)
Serviço de arquivos estáticos:
- `servirArquivo()` → Entrega HTML, CSS, JS, imagens

---

## 💡 Benefícios da Refatoração

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Linhas no server.js** | 1200+ | ~60 |
| **Número de arquivos** | 1 | 5 |
| **Legibilidade** | 😞 Caótica | 😊 Clara |
| **Manutenção** | Difícil | Fácil |
| **Reutilização** | Baixa | Alta |
| **Testes** | Impossível | Possível |
| **Escalabilidade** | Limitada | Excelente |

---

## 🚀 Como Usar

### Iniciar o servidor
```bash
node server.js
```

### Estrutura do server.js
```javascript
// 1. Importações (5 linhas)
const http = require('http');
const db = require('./src/banco');
const { processarRotas } = require('./src/rotas');
// ...

// 2. Inicialização (2 linhas)
const banco = db.inicializarBanco(caminhoBanco);

// 3. Criar servidor (40 linhas)
const servidor = http.createServer((req, res) => {
  // CORS e preflight
  // Processar rotas: processarRotas(req, res, urlRequisicao, banco)
  // Servir arquivos estáticos
});

// 4. Listening (5 linhas)
servidor.listen(porta, () => { ... });
```

---

## 🔌 Sistema de Rotas

As rotas são processadas em cascata em `src/rotas.js`:

```javascript
// Cada função retorna true se processou a rota
if (rotaHealth(req, res, urlRequisicao)) return;
if (rotaAlerta(req, res, urlRequisicao)) return;
if (rotaUsuario(req, res, urlRequisicao, banco)) return;
// ... mais rotas ...
if (rotaRemoverUsuario(req, res, urlRequisicao, banco)) return;

// Se nenhuma rota foi encontrada, server.js serve arquivo estático
```

---

## 🔐 Segurança Preservada

Todas as proteções originais foram mantidas:
- ✅ Validação de SQL Injection (prepared statements)
- ✅ Hash de senhas com bcrypt
- ✅ Proteção contra path traversal
- ✅ CORS em rotas de API
- ✅ Proteção para não remover último admin

---

## 📝 Funcionalidades Preservadas

Todas as 18 rotas da API continuam funcionando:
- ✅ Autenticação de usuários
- ✅ Gerenciamento de usuários
- ✅ Alertas de emergência
- ✅ Logs de alerta
- ✅ Painel administrativo
- ✅ Integração com WhatsApp (CallMeBot)

---

## 🎓 Próximos Passos (Opcional)

Se quiser melhorar ainda mais:

1. **Usar Express.js** → Rotas mais limpas com middleware
2. **Adicionar testes** → Jest ou Mocha (a modularização facilita)
3. **Validação com Joi/Yup** → Validar entrada de dados
4. **Async/Await** → Substituir callbacks por promises
5. **Documentação Swagger** → Auto-documentar API

---

✨ **Refatoração concluída com sucesso!**
