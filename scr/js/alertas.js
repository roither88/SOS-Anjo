/* =============================
   Configuracao da aplicacao
   ============================= */

const estaEmAmbienteLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_BASE = estaEmAmbienteLocal && window.location.port !== "3000"
  ? "http://localhost:3000"
  : "";

/* =============================
   Referencias de elementos DOM
   ============================= */

const btnIrInicio = document.getElementById("btnIrInicio");
const statusLogin = document.getElementById("statusLogin");
const totalAlertasTexto = document.getElementById("totalAlertasTexto");
const btnAtualizarAlertas = document.getElementById("btnAtualizarAlertas");
const alertasVazio = document.getElementById("alertasVazio");
const alertasContainer = document.getElementById("alertasContainer");
const alertasCorpo = document.getElementById("alertasCorpo");

/* =============================
   Funcoes principais
   ============================= */

// Atualiza o status de login na interface
function atualizarStatusLogin() {
  try {
    const usuario = localStorage.getItem("sos_anjo_usuario_logado");
    const usuarioObj = usuario ? JSON.parse(usuario) : null;
    
    if (statusLogin) {
      if (usuarioObj && usuarioObj.nome) {
        statusLogin.textContent = `Logado: ${usuarioObj.nome}`;
      } else {
        statusLogin.textContent = "Não logado";
      }
    }
  } catch (e) {
    if (statusLogin) {
      statusLogin.textContent = "Não logado";
    }
  }
}

// Busca alertas ativos do servidor
async function carregarAlertas() {
  try {
    const resposta = await fetch(`${API_BASE}/api/alertas/ativos`);
    
    if (!resposta.ok) {
      console.error("Erro ao buscar alertas:", resposta.status);
      mostrarMensagem("Erro ao carregar alertas", "erro");
      return;
    }

    const dados = await resposta.json();
    const alertas = dados.alertas || [];

    // Atualiza o total de alertas
    if (totalAlertasTexto) {
      const strong = totalAlertasTexto.querySelector("strong");
      if (strong) {
        strong.textContent = alertas.length;
      }
    }

    // Mostra/esconde container vazio
    if (alertas.length === 0) {
      if (alertasVazio) alertasVazio.classList.remove("oculto");
      if (alertasContainer) alertasContainer.classList.add("oculto");
      if (alertasCorpo) alertasCorpo.innerHTML = "";
      return;
    }

    if (alertasVazio) alertasVazio.classList.add("oculto");
    if (alertasContainer) alertasContainer.classList.remove("oculto");

    // Popula tabela
    if (alertasCorpo) {
      alertasCorpo.innerHTML = "";
      alertas.forEach((alerta) => {
        const linha = document.createElement("tr");
        
        const dataHora = new Date(alerta.data_hora);
        const dataFormatada = dataHora.toLocaleString("pt-BR");

        linha.innerHTML = `
          <td>${alerta.id}</td>
          <td>${alerta.usuario_nome || "N/A"}</td>
          <td>${alerta.usuario_local || "N/A"}</td>
          <td>${dataFormatada}</td>
          <td>
            <button class="btn-desativar" data-id="${alerta.id}">DESATIVAR</button>
          </td>
        `;

        alertasCorpo.appendChild(linha);
      });

      // Adiciona listeners aos botões de desativar
      document.querySelectorAll(".btn-desativar").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          desativarAlerta(id);
        });
      });
    }
  } catch (erro) {
    console.error("Erro ao carregar alertas:", erro);
    mostrarMensagem("Erro ao conectar com o servidor", "erro");
  }
}

// Desativa um alerta específico
async function desativarAlerta(id) {
  if (!confirm("Tem certeza que deseja desativar este alerta?")) {
    return;
  }

  try {
    const resposta = await fetch(`${API_BASE}/api/alertas/desativar/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!resposta.ok) {
      const erro = await resposta.json();
      mostrarMensagem(erro.erro || "Erro ao desativar alerta", "erro");
      return;
    }

    mostrarMensagem("Alerta desativado com sucesso", "sucesso");
    
    // Recarrega os alertas após desativar
    setTimeout(() => {
      carregarAlertas();
    }, 500);
  } catch (erro) {
    console.error("Erro ao desativar alerta:", erro);
    mostrarMensagem("Erro ao conectar com o servidor", "erro");
  }
}

// Mostra uma mensagem temporária ao usuário
function mostrarMensagem(texto, tipo = "info") {
  // Cria elemento de mensagem
  const mensagem = document.createElement("div");
  mensagem.className = `mensagem-flutuante mensagem-${tipo}`;
  mensagem.textContent = texto;
  mensagem.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: ${tipo === "sucesso" ? "#4CAF50" : tipo === "erro" ? "#f44336" : "#2196F3"};
    color: white;
    padding: 16px;
    border-radius: 4px;
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(mensagem);

  // Remove após 3 segundos
  setTimeout(() => {
    mensagem.style.animation = "slideOut 0.3s ease-out";
    setTimeout(() => mensagem.remove(), 300);
  }, 3000);
}

/* =============================
   Event Listeners
   ============================= */

// Volta para a página inicial
if (btnIrInicio) {
  btnIrInicio.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

// Atualiza alertas manualmente
if (btnAtualizarAlertas) {
  btnAtualizarAlertas.addEventListener("click", () => {
    carregarAlertas();
  });
}

/* =============================
   Inicializacao
   ============================= */

// Ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
  atualizarStatusLogin();
  carregarAlertas();

  // Atualiza alertas a cada 5 segundos
  setInterval(() => {
    carregarAlertas();
  }, 5000);
});
